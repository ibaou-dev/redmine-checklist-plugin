/**
 * Issue #4: Section visual grouping (flat model)
 *
 * Regression spec:
 * Verifies that non-section items are rendered with CSS padding-left
 * (visually indented) while section rows remain flush-left.
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { resetChecklist, seedChecklist } from './reset';

const ISSUE_URL = `/issues/${ISSUE_ID}`;

test.beforeEach(() => {
  resetChecklist(ISSUE_ID);
});

test('items are indented; section headers are flush-left', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');

  seedChecklist(ISSUE_ID, ['Regular item 1', 'Regular item 2']);

  await page.goto(ISSUE_URL);

  // Also add a section via the UI
  const input = page.locator('.checklist-new-item-input');
  await input.fill('A Section Header');
  await page.click('#checklist-add-section-btn');

  const list = page.locator('#checklist-items');
  await expect(list.locator('.checklist-item')).toHaveCount(3, { timeout: 7000 });
  await expect(list.locator('.checklist-section')).toHaveCount(1);

  // Non-section items must have a padding-left > 0 (CSS indentation)
  const regularItem = list.locator('.checklist-item:not(.checklist-section)').first();
  const regularPaddingLeft = await regularItem.evaluate((el) => {
    return parseFloat(window.getComputedStyle(el).paddingLeft);
  });
  expect(regularPaddingLeft, 'regular items must have padding-left > 0 (indented)').toBeGreaterThan(0);

  // Section header must have padding-left equal to or less than the item
  // (section rows are flush-left — no extra indent)
  const sectionRow = list.locator('.checklist-section').first();
  const sectionPaddingLeft = await sectionRow.evaluate((el) => {
    return parseFloat(window.getComputedStyle(el).paddingLeft);
  });
  // Section should have LESS left padding than items (sections are flush-left)
  // Our CSS: items get 1.25em padding-left; sections don't get the extra indent
  expect(sectionPaddingLeft, 'section rows must have less left-padding than regular items')
    .toBeLessThan(regularPaddingLeft);

  // Sections have .checklist-section class; items do not
  await expect(sectionRow).toHaveClass(/checklist-section/);
  await expect(regularItem).not.toHaveClass(/checklist-section/);

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

test('items added after a section are indented', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const list = page.locator('#checklist-items');
  const input = page.locator('.checklist-new-item-input');

  // Add a section first
  await input.fill('My Section');
  await page.click('#checklist-add-section-btn');
  await expect(list.locator('.checklist-section')).toHaveCount(1, { timeout: 7000 });

  // Add an item after the section
  await input.fill('Item under section');
  await page.click('#checklist-add-item-btn');
  await expect(list.locator('.checklist-item')).toHaveCount(2, { timeout: 7000 });

  // The item (non-section) must be indented
  const item = list.locator('.checklist-item:not(.checklist-section)').first();
  const itemPadding = await item.evaluate((el) => {
    return parseFloat(window.getComputedStyle(el).paddingLeft);
  });
  expect(itemPadding, 'item added after section must be indented').toBeGreaterThan(0);

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});
