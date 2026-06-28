/**
 * Spec 9: Settings page — show_progress_bar toggle
 *
 * Covers:
 *  - /settings/plugin/redmine_checklist accessible to admin
 *  - toggling show_progress_bar OFF hides the progress bar on issue page
 *  - toggling back ON restores it
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { resetChecklist, seedChecklist } from './reset';

const SETTINGS_URL = '/settings/plugin/redmine_checklist';
const ISSUE_URL = `/issues/${ISSUE_ID}`;

test.beforeEach(() => {
  resetChecklist(ISSUE_ID);
  // Seed items so progress bar has something to show
  seedChecklist(ISSUE_ID, ['Settings test task']);
});

test('admin: settings page accessible and shows plugin options', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(SETTINGS_URL);

  // Settings form should be present
  await expect(page.locator('#settings_show_progress_bar')).toBeVisible();
  await expect(page.locator('#settings_affect_done_ratio')).toBeVisible();

  expect(failedRequests.filter(r => r.includes('checklist')), 'failed checklist requests').toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors').toEqual([]);

  await logout(page);
});

test('admin: disabling show_progress_bar hides bar on issue, re-enabling restores it', async ({ page }) => {
  const { failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');

  // First ensure the progress bar is enabled (check it on the issue page)
  await page.goto(SETTINGS_URL);
  const progressBarCheckbox = page.locator('#settings_show_progress_bar');
  // Ensure it is checked (enabled)
  if (!(await progressBarCheckbox.isChecked())) {
    await progressBarCheckbox.check();
    await page.locator('input[type="submit"]').click();
    await page.waitForLoadState('networkidle');
  }

  // Verify progress bar visible on issue page
  await page.goto(ISSUE_URL);
  await expect(page.locator('.checklist-progress-bar')).toBeVisible({ timeout: 7000 });

  // Now disable progress bar in settings
  await page.goto(SETTINGS_URL);
  await progressBarCheckbox.uncheck();
  await page.locator('input[type="submit"]').click();
  await page.waitForLoadState('networkidle');

  // Verify progress bar hidden on issue page
  await page.goto(ISSUE_URL);
  await expect(page.locator('.checklist-progress-bar')).not.toBeAttached({ timeout: 7000 });
  // But badge should still be visible
  await expect(page.locator('.checklist-badge')).toBeVisible();

  // Re-enable progress bar
  await page.goto(SETTINGS_URL);
  await progressBarCheckbox.check();
  await page.locator('input[type="submit"]').click();
  await page.waitForLoadState('networkidle');

  // Verify progress bar visible again
  await page.goto(ISSUE_URL);
  await expect(page.locator('.checklist-progress-bar')).toBeVisible({ timeout: 7000 });

  expect(failedRequests.filter(r => r.includes('checklist')), 'failed checklist requests').toEqual([]);
  await logout(page);
});
