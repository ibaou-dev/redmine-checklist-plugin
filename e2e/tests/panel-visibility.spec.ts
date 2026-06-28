/**
 * Spec 1: Panel visibility and tier-based affordance gating
 *
 * Covers:
 *  - #checklist-panel rendered for all four users
 *  - #checklist-add-form present ONLY for manage tiers (admin, cl_manager)
 *  - checkboxes disabled for cl_viewer, enabled for cl_checker / cl_manager
 *  - Clean render (no console errors, no failed checklist requests) for each user
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { resetChecklist, seedChecklist } from './reset';

const ISSUE_URL = `/issues/${ISSUE_ID}`;

test.beforeEach(() => {
  resetChecklist(ISSUE_ID);
  // Seed one item so checkboxes appear
  seedChecklist(ISSUE_ID, ['Panel visibility task']);
});

test('admin: panel visible, add-form present, checkbox enabled', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  await expect(page.locator('#checklist-panel')).toBeVisible();
  await expect(page.locator('#checklist-add-form')).toBeVisible();

  const checkbox = page.locator('.checklist-checkbox').first();
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeDisabled();

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  // Filter spurious chrome extension console errors
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

test('cl_manager: panel visible, add-form present, checkbox enabled', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'cl_manager', 'Test1234!');
  await page.goto(ISSUE_URL);

  await expect(page.locator('#checklist-panel')).toBeVisible();
  await expect(page.locator('#checklist-add-form')).toBeVisible();

  const checkbox = page.locator('.checklist-checkbox').first();
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeDisabled();

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

test('cl_checker: panel visible, NO add-form, checkbox enabled', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'cl_checker', 'Test1234!');
  await page.goto(ISSUE_URL);

  await expect(page.locator('#checklist-panel')).toBeVisible();
  // No add form for checker (can't manage)
  await expect(page.locator('#checklist-add-form')).not.toBeAttached();

  const checkbox = page.locator('.checklist-checkbox').first();
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeDisabled();

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

test('cl_viewer: panel visible, NO add-form, checkbox DISABLED', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'cl_viewer', 'Test1234!');
  await page.goto(ISSUE_URL);

  await expect(page.locator('#checklist-panel')).toBeVisible();
  // No add form for viewer
  await expect(page.locator('#checklist-add-form')).not.toBeAttached();

  const checkbox = page.locator('.checklist-checkbox').first();
  await expect(checkbox).toBeVisible();
  await expect(checkbox).toBeDisabled();

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});
