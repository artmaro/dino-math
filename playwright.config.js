import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: /.*\.spec\.js/,
    testIgnore: /prod\.spec\.js/, // PROD-смоук запускать отдельно: npx playwright test tests/prod.spec.js
    timeout: 180000,
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: 'http://localhost:8000',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure'
    },
    webServer: {
        command: 'python3 -m http.server 8000',
        port: 8000,
        reuseExistingServer: true,
        timeout: 5000
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
    ]
});
