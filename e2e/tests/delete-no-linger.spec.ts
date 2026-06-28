/**
 * Issue #1: Delete tooltip lingers
 *
 * Regression spec:
 * 1. Assert delete links use aria-label and have NO title attribute.
 * 2. Assert drag handles use aria-label and have NO title attribute.
 * 3. Create 5 items, delete all 5 one-by-one via AJAX.
 *    Assert 0 rows remain and no stray .checklist-item / error nodes.
 * 4. Assert no console errors / failed checklist requests throughout.
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { resetChecklist, seedChecklist } from './reset';

const ISSUE_URL = `/issues/${ISSUE_ID}`;

test.beforeEach(() => {
  resetChecklist(ISSUE_ID);
});

test('delete links use aria-label and have no title attribute', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');

  seedChecklist(ISSUE_ID, ['Item A']);

  await page.goto(ISSUE_URL);

  const list = page.locator('#checklist-items');
  await expect(list.locator('.checklist-item')).toHaveCount(1, { timeout: 7000 });

  // Delete link must have aria-label, must NOT have title
  const deleteLink = list.locator('.checklist-delete').first();
  await expect(deleteLink).toBeAttached();

  const ariaLabel = await deleteLink.getAttribute('aria-label');
  expect(ariaLabel, 'delete link must have aria-label').toBeTruthy();

  const titleAttr = await deleteLink.getAttribute('title');
  expect(titleAttr, 'delete link must NOT have a title attribute').toBeNull();

  // Drag handle must have aria-label, must NOT have title
  const handle = list.locator('.checklist-handle').first();
  await expect(handle).toBeAttached();

  const handleAriaLabel = await handle.getAttribute('aria-label');
  expect(handleAriaLabel, 'drag handle must have aria-label').toBeTruthy();

  const handleTitle = await handle.getAttribute('title');
  expect(handleTitle, 'drag handle must NOT have a title attribute').toBeNull();

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

test('delete 5 items one-by-one: 0 rows remain, no stray nodes or errors', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');

  seedChecklist(ISSUE_ID, ['Del 1', 'Del 2', 'Del 3', 'Del 4', 'Del 5']);

  await page.goto(ISSUE_URL);

  const list = page.locator('#checklist-items');
  await expect(list.locator('.checklist-item')).toHaveCount(5, { timeout: 7000 });

  // Track navigation (must not occur)
  let navigated = false;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigated = true;
  });

  // Delete all 5 one-by-one; always target the first remaining item
  for (let i = 5; i >= 1; i--) {
    const firstItem = list.locator('.checklist-item').first();
    await firstItem.hover();
    await firstItem.locator('.checklist-delete').click();
    await expect(list.locator('.checklist-item')).toHaveCount(i - 1, { timeout: 7000 });
  }

  // Verify zero rows remain
  await expect(list.locator('.checklist-item')).toHaveCount(0);

  // No stray .checklist-item nodes anywhere in the panel
  await expect(page.locator('#checklist-panel .checklist-item')).toHaveCount(0);

  expect(navigated, 'must not page-navigate').toBe(false);

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

test('section delete link uses aria-label and has no title', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Create a section via the "Add section" button
  const input = page.locator('.checklist-new-item-input');
  await input.fill('Test Section');
  await page.click('#checklist-add-section-btn');

  const list = page.locator('#checklist-items');
  await expect(list.locator('.checklist-section')).toHaveCount(1, { timeout: 7000 });

  // Check the section's delete link
  const sectionDeleteLink = list.locator('.checklist-section .checklist-delete').first();
  await expect(sectionDeleteLink).toBeAttached();

  const ariaLabel = await sectionDeleteLink.getAttribute('aria-label');
  expect(ariaLabel, 'section delete link must have aria-label').toBeTruthy();

  const titleAttr = await sectionDeleteLink.getAttribute('title');
  expect(titleAttr, 'section delete link must NOT have a title attribute').toBeNull();

  // Also verify section handle
  const sectionHandle = list.locator('.checklist-section .checklist-handle').first();
  const handleAriaLabel = await sectionHandle.getAttribute('aria-label');
  expect(handleAriaLabel, 'section drag handle must have aria-label').toBeTruthy();
  const handleTitle = await sectionHandle.getAttribute('title');
  expect(handleTitle, 'section drag handle must NOT have a title').toBeNull();

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});
