import { test } from '@playwright/test';

async function bootGame(page, levelIdx = 0) {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/');
    await page.click('#btn-start');
    await page.locator('.level-card').nth(levelIdx).click();
    await page.waitForFunction(() => {
        const g = window.__game;
        if (!g) return false;
        const scene = g.scene.getScene('Game');
        return !!(scene && scene.chests && scene.chests.length === 10 && scene.dino);
    }, null, { timeout: 8000 });
    await page.waitForTimeout(500);
}

test('capture gameplay screenshot', async ({ page }) => {
    await bootGame(page);
    await page.screenshot({ path: 'test-results/current-look.png', fullPage: false });
});

test('capture mobile start screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/mobile-start.png', fullPage: false });
});

test('capture mobile levels menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.click('#btn-start');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/mobile-levels.png', fullPage: false });
});

test('capture mobile portrait screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 portrait
    await page.goto('/');
    await page.click('#btn-start');
    await page.locator('.level-card').first().click();
    await page.waitForFunction(() => {
        const g = window.__game;
        if (!g) return false;
        const scene = g.scene.getScene('Game');
        return !!(scene && scene.chests && scene.chests.length === 10 && scene.dino);
    }, null, { timeout: 8000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/mobile-portrait.png', fullPage: false });
});

test('capture mobile landscape screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 }); // iPhone 14 landscape
    await page.goto('/');
    await page.click('#btn-start');
    await page.locator('.level-card').first().click();
    await page.waitForFunction(() => {
        const g = window.__game;
        if (!g) return false;
        const scene = g.scene.getScene('Game');
        return !!(scene && scene.chests && scene.chests.length === 10 && scene.dino);
    }, null, { timeout: 8000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/mobile-landscape.png', fullPage: false });
});

test('capture levels menu screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/');
    await page.click('#btn-start');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/levels-menu.png', fullPage: false });
});

test('capture cave area screenshot', async ({ page }) => {
    await bootGame(page);
    // Телепортируем динозавра поближе к пещере, чтобы камера показала её
    await page.evaluate(() => {
        const s = window.__game.scene.getScene('Game');
        s.dinoLogicalX = s.cameras.main ? 1200 : 1200;
        s.dinoLogicalY = 600; // чуть выше центра ромба, ближе к пещере
        s.followTarget.x = s.dinoLogicalX;
        s.followTarget.y = s.dinoLogicalY;
        s.cameras.main.centerOn(s.dinoLogicalX, s.dinoLogicalY);
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/cave-look.png', fullPage: false });
});
