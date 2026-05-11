import { test, expect } from '@playwright/test';

const PROD_URL = 'http://186.246.31.240/';

// Тест что задеплоенная версия реально грузится и рендерит мир.
test('PROD: index loads', async ({ page }) => {
    const failed = [];
    page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    page.on('pageerror', e => failed.push(`pageerror: ${e.message}`));

    await page.goto(PROD_URL);
    await expect(page.locator('#screen-start')).toHaveClass(/active/);
    await page.click('#btn-start');
    await page.locator('.level-card').first().click();
    await page.waitForFunction(() => {
        const g = window.__game;
        return g && g.scene.getScene('Game')?.chests?.length === 10;
    }, null, { timeout: 120000 });

    await page.setViewportSize({ width: 1600, height: 900 });
    await page.screenshot({ path: 'test-results/prod-look.png' });
    expect(failed, `failed requests/errors: ${failed.join('\n')}`).toEqual([]);
});
