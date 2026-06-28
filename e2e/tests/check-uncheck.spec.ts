/**
 * Spec 4: Check / uncheck items
 *
 * Covers:
 *  - cl_checker CAN toggle done/undone
 *  - manage tier (admin) CAN toggle
 *  - toggling adds/removes .is-done class (strikethrough)
 *  - progress badge updates live
 *  - state persists on page reload
 *  - Unchecking reverts to undone state
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { resetChecklist, seedChecklist } from './reset';

const ISSUE_URL = `/issues/${ISSUE_ID}`;

test.beforeEach(() => {
  resetChecklist(ISSUE_ID);
  seedChecklist(ISSUE_ID, ['Task Alpha', 'Task Beta']);
});

test('admin: check item adds is-done, updates progress, persists on reload', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Initially 0/2
  const badge = page.locator('.checklist-badge');
  await expect(badge).toContainText('0/2');

  // Locate the first item's checkbox
  const firstRow = page.locator('#checklist-items .checklist-item').first();
  const checkbox = firstRow.locator('.checklist-checkbox');
  await expect(checkbox).not.toBeChecked();
  await expect(firstRow).not.toHaveClass(/is-done/);

  // Check it
  await checkbox.click();

  // Wait for AJAX done response to update DOM
  await expect(firstRow).toHaveClass(/is-done/, { timeout: 7000 });
  await expect(badge).toContainText('1/2');

  // Persist on reload
  await page.reload();
  const reloadedRow = page.locator('#checklist-items .checklist-item').first();
  await expect(reloadedRow).toHaveClass(/is-done/);
  await expect(page.locator('.checklist-badge')).toContainText('1/2');

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

test('admin: uncheck item removes is-done, reverts progress', async ({ page }) => {
  const { failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Check item first
  const firstRow = page.locator('#checklist-items .checklist-item').first();
  const checkbox = firstRow.locator('.checklist-checkbox');
  await checkbox.click();
  await expect(firstRow).toHaveClass(/is-done/, { timeout: 7000 });
  await expect(page.locator('.checklist-badge')).toContainText('1/2');

  // Now uncheck
  await checkbox.click();
  await expect(firstRow).not.toHaveClass(/is-done/, { timeout: 7000 });
  await expect(page.locator('.checklist-badge')).toContainText('0/2');

  // Persist
  await page.reload();
  const reloadedRow = page.locator('#checklist-items .checklist-item').first();
  await expect(reloadedRow).not.toHaveClass(/is-done/);
  await expect(page.locator('.checklist-badge')).toContainText('0/2');

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  await logout(page);
});

test('cl_checker: can check and uncheck items', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'cl_checker', 'Test1234!');
  await page.goto(ISSUE_URL);

  const badge = page.locator('.checklist-badge');
  await expect(badge).toContainText('0/2');

  const firstRow = page.locator('#checklist-items .checklist-item').first();
  const checkbox = firstRow.locator('.checklist-checkbox');
  await expect(checkbox).not.toBeDisabled();

  // Check
  await checkbox.click();
  await expect(firstRow).toHaveClass(/is-done/, { timeout: 7000 });
  await expect(badge).toContainText('1/2');

  // Uncheck
  await checkbox.click();
  await expect(firstRow).not.toHaveClass(/is-done/, { timeout: 7000 });
  await expect(badge).toContainText('0/2');

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});
