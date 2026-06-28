import { defineConfig, devices } from '@playwright/test';

// E2E config for the redmine_checklist plugin.
// Targets the live dev Redmine on http://localhost:4000 and drives the host's
// installed Google Chrome (channel: 'chrome') over the DevTools protocol.
export default defineConfig({
  testDir: './tests',
  outputDir: './artifacts/test-results',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: './artifacts/report', open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
});
