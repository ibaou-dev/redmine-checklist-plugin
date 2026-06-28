/**
 * Spec 5: Delete item (manage tier)
 *
 * Covers:
 *  - delete control removes the row via AJAX (no full reload)
 *  - progress badge updates
 *  - deletion persists on page reload
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { resetChecklist, seedChecklist } from './reset';

const ISSUE_URL = `/issues/${ISSUE_ID}`;

test.beforeEach(() => {
  resetChecklist(ISSUE_ID);
  seedChecklist(ISSUE_ID, ['Task to keep', 'Task to delete']);
});

test('admin: delete removes row via AJAX, updates progress, persists', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Verify 2 items initially
  const list = page.locator('#checklist-items');
  await expect(list.locator('.checklist-item')).toHaveCount(2);
  const badge = page.locator('.checklist-badge');
  await expect(badge).toContainText('0/2');

  // Track navigation (should not occur)
  let navigated = false;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigated = true;
  });

  // Delete the second item
  const secondRow = list.locator('.checklist-item').nth(1);
  await secondRow.locator('.checklist-delete').click();

  // Row should disappear via AJAX
  await expect(list.locator('.checklist-item')).toHaveCount(1, { timeout: 7000 });
  expect(navigated, 'must not navigate').toBe(false);

  // Progress updates to 0/1
  await expect(badge).toContainText('0/1');

  // Persist on reload
  await page.reload();
  await expect(page.locator('#checklist-items .checklist-item')).toHaveCount(1);
  await expect(page.locator('.checklist-badge')).toContainText('0/1');
  await expect(page.locator('.checklist-item-text').first()).toHaveText('Task to keep');

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

test('admin: deleting a done item updates progress correctly', async ({ page }) => {
  const { failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Check the second item first
  const list = page.locator('#checklist-items');
  const secondRow = list.locator('.checklist-item').nth(1);
  await secondRow.locator('.checklist-checkbox').click();
  await expect(page.locator('.checklist-badge')).toContainText('1/2', { timeout: 7000 });

  // Now delete it
  await secondRow.locator('.checklist-delete').click();
  await expect(list.locator('.checklist-item')).toHaveCount(1, { timeout: 7000 });

  // After deleting the 1 done item out of 2, we should have 0/1
  await expect(page.locator('.checklist-badge')).toContainText('0/1');

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  await logout(page);
});
