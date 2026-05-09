import { test, expect } from '@playwright/test';

// Помощник: ждём, пока GameScene не запустится и не сгенерит мир.
async function waitForGameSceneReady(page, timeout = 8000) {
    return await page.waitForFunction(() => {
        const g = window.__game;
        if (!g) return false;
        const scene = g.scene.getScene('Game');
        return !!(scene && scene.chests && scene.chests.length === 10 && scene.dino);
    }, null, { timeout });
}

test.describe('Dino Math game — smoke', () => {
    let consoleErrors = [];
    let pageErrors = [];

    test.beforeEach(async ({ page }) => {
        consoleErrors = [];
        pageErrors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => pageErrors.push(err.message));
    });

    test('start screen loads without errors', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#screen-start')).toHaveClass(/active/);
        await expect(page.locator('h1')).toContainText('Анкилозавр');
        await expect(page.locator('#btn-start')).toBeVisible();
        await page.waitForTimeout(400);
        expect(pageErrors).toEqual([]);
    });

    test('clicking start mounts a Phaser canvas', async ({ page }) => {
        await page.goto('/');
        await page.click('#btn-start');
        await expect(page.locator('#screen-play')).toHaveClass(/active/);

        const canvas = page.locator('#world canvas');
        await expect(canvas).toBeVisible({ timeout: 5000 });
        const box = await canvas.boundingBox();
        expect(box.width).toBeGreaterThan(50);
        expect(box.height).toBeGreaterThan(50);
    });

    test('GameScene generates world: dino, 10 chests, decorations', async ({ page }) => {
        await page.goto('/');
        await page.click('#btn-start');
        await waitForGameSceneReady(page);

        const summary = await page.evaluate(() => {
            const scene = window.__game.scene.getScene('Game');
            return {
                chestCount: scene.chests.length,
                openedCount: scene.chests.filter(c => c.opened).length,
                decorationsCount: scene.decorations.length,
                hasDino: !!scene.dino,
                dinoX: scene.dinoLogicalX,
                dinoY: scene.dinoLogicalY,
                fruits: scene.fruits,
                correctAnswers: scene.correctAnswers
            };
        });

        expect(summary.chestCount).toBe(10);
        expect(summary.openedCount).toBe(0);
        expect(summary.decorationsCount).toBeGreaterThan(20);
        expect(summary.hasDino).toBe(true);
        expect(summary.fruits).toBe(0);
        expect(summary.correctAnswers).toBe(0);

        expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([]);
        expect(consoleErrors, `console error: ${consoleErrors.join(' | ')}`).toEqual([]);
    });

    test('all 12 SVG textures are loaded', async ({ page }) => {
        await page.goto('/');
        await page.click('#btn-start');
        await waitForGameSceneReady(page);

        const textures = await page.evaluate(() => {
            const game = window.__game;
            const expected = ['ankylo', 'pine', 'oak', 'bush', 'rockSmall', 'flower',
                              'boulder', 'log', 'bridge', 'chest-closed', 'chest-open', 'cave', 'particle'];
            return expected.map(key => ({ key, exists: game.textures.exists(key) }));
        });

        for (const t of textures) {
            expect(t.exists, `texture "${t.key}" must be loaded`).toBe(true);
        }
    });

    test('arrow keys move the dino', async ({ page }) => {
        await page.goto('/');
        await page.click('#btn-start');
        await waitForGameSceneReady(page);

        const before = await page.evaluate(() => {
            const s = window.__game.scene.getScene('Game');
            return { x: s.dinoLogicalX, y: s.dinoLogicalY };
        });

        await page.keyboard.down('ArrowUp');
        await page.waitForTimeout(500);
        await page.keyboard.up('ArrowUp');
        await page.waitForTimeout(100);

        const after = await page.evaluate(() => {
            const s = window.__game.scene.getScene('Game');
            return { x: s.dinoLogicalX, y: s.dinoLogicalY };
        });

        expect(after.y, 'dino should have moved up').toBeLessThan(before.y);
    });

    test('walking up to a chest opens the question modal', async ({ page }) => {
        await page.goto('/');
        await page.click('#btn-start');
        await waitForGameSceneReady(page);

        // Телепортируем дино прямо к первому сундуку (детерминированно)
        await page.evaluate(() => {
            const s = window.__game.scene.getScene('Game');
            const c = s.chests[0];
            // Поставить рядом, чтобы триггер дистанции сработал на следующем тике
            s.dinoLogicalX = c.x + 10;
            s.dinoLogicalY = c.y + 10;
            s.followTarget.x = s.dinoLogicalX;
            s.followTarget.y = s.dinoLogicalY;
        });

        // Ждём, пока модалка появится
        await expect(page.locator('#modal-question')).toHaveClass(/active/, { timeout: 3000 });
        await expect(page.locator('#question-text')).not.toBeEmpty();

        const buttonCount = await page.locator('.answer-btn').count();
        expect(buttonCount).toBe(3);
    });

    test('audio: oscillator fires on correct answer', async ({ page }) => {
        await page.goto('/');

        // До запуска подменяем AudioContext, чтобы считать вызовы createOscillator
        await page.addInitScript(() => {
            window.__oscCalls = 0;
            const origAC = window.AudioContext || window.webkitAudioContext;
            if (!origAC) return;
            const Patched = function (...args) {
                const ctx = new origAC(...args);
                const orig = ctx.createOscillator.bind(ctx);
                ctx.createOscillator = function () {
                    window.__oscCalls = (window.__oscCalls || 0) + 1;
                    return orig();
                };
                return ctx;
            };
            window.AudioContext = Patched;
            window.webkitAudioContext = Patched;
        });
        await page.reload();

        await page.click('#btn-start');
        await waitForGameSceneReady(page);

        const correctAnswer = await page.evaluate(() => {
            const s = window.__game.scene.getScene('Game');
            const c = s.chests[0];
            s.dinoLogicalX = c.x + 10;
            s.dinoLogicalY = c.y + 10;
            s.followTarget.x = s.dinoLogicalX;
            s.followTarget.y = s.dinoLogicalY;
            return c.correctAnswer;
        });

        await expect(page.locator('#modal-question')).toHaveClass(/active/, { timeout: 3000 });
        const before = await page.evaluate(() => window.__oscCalls || 0);
        await page.locator('.answer-btn', { hasText: String(correctAnswer) }).click();
        await page.waitForTimeout(700);

        const result = await page.evaluate(() => ({
            ctxState: window.__audioCtx?.state,
            oscDelta: (window.__oscCalls || 0) - 0,
            ctxExists: !!window.__audioCtx
        }));

        expect(result.ctxExists, 'AudioContext should be created').toBe(true);
        expect(result.ctxState, 'AudioContext should be running').toBe('running');
        // playSuccess создаёт 4 осциллятора
        expect(result.oscDelta - before).toBeGreaterThanOrEqual(4);
    });

    test('correct answer awards a fruit and closes modal', async ({ page }) => {
        await page.goto('/');
        await page.click('#btn-start');
        await waitForGameSceneReady(page);

        // Узнаём правильный ответ для первого сундука
        const correctAnswer = await page.evaluate(() => {
            const s = window.__game.scene.getScene('Game');
            const c = s.chests[0];
            // Телепортируемся к сундуку
            s.dinoLogicalX = c.x + 10;
            s.dinoLogicalY = c.y + 10;
            s.followTarget.x = s.dinoLogicalX;
            s.followTarget.y = s.dinoLogicalY;
            return c.correctAnswer;
        });

        // Ждём модалку
        await expect(page.locator('#modal-question')).toHaveClass(/active/, { timeout: 3000 });

        // Кликаем правильный ответ
        await page.locator('.answer-btn', { hasText: String(correctAnswer) }).click();

        // Через короткое время модалка должна закрыться, фрукты увеличиться
        await page.waitForTimeout(700);

        const state = await page.evaluate(() => {
            const s = window.__game.scene.getScene('Game');
            return { fruits: s.fruits, correctAnswers: s.correctAnswers };
        });
        expect(state.fruits).toBe(1);
        expect(state.correctAnswers).toBe(1);

        await expect(page.locator('#modal-question')).not.toHaveClass(/active/);
    });
});
