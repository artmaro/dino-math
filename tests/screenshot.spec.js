import { test } from '@playwright/test';

async function bootGame(page) {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/');
    await page.click('#btn-start');
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
