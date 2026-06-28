/**
 * Spec 2: Add item (manage tier) — AJAX create, no full reload, input clears,
 *          progress badge updates, persists on reload.
 *
 * Spec 3: Add section — renders as .checklist-section, no checkbox, excluded
 *          from progress count. THEN add an item — verifies two-button UI keeps
 *          each button's static label and next Enter creates an ITEM not a section.
 *
 * Spec 7: Validation — empty subject rejected, inline error shown, no row added.
 *
 * NOTE: The old single-button + "Add section" link UI has been replaced with TWO
 * explicit static buttons:
 *   #checklist-add-item-btn  → always adds an item (is_section=0)
 *   #checklist-add-section-btn → always adds a section (is_section=1)
 * The hidden field #checklist-is-section is set by JS before submitting the form.
 * Pressing Enter in the input also adds an item.
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { resetChecklist, seedChecklist } from './reset';

const ISSUE_URL = `/issues/${ISSUE_ID}`;

test.beforeEach(() => {
  resetChecklist(ISSUE_ID);
});

// ---------------------------------------------------------------------------
// Add item via "Add item" button
// ---------------------------------------------------------------------------
test('add item: row appears without full reload, input clears, progress updates', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // No items yet — progress badge should be absent (nil stats)
  const panel = page.locator('#checklist-panel');
  await expect(panel).toBeVisible();
  const list = page.locator('#checklist-items');

  // Type subject and submit via "Add item" button
  const input = page.locator('.checklist-new-item-input');
  await input.fill('My new task');

  // Track navigation — there should be NONE (AJAX only)
  let navigated = false;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigated = true;
  });

  await page.click('#checklist-add-item-btn');

  // Wait for the new row to appear
  await expect(list.locator('.checklist-item')).toHaveCount(1, { timeout: 7000 });

  // Verify no page navigation happened
  expect(navigated, 'full page reload must not happen').toBe(false);

  // Input cleared
  await expect(input).toHaveValue('');

  // Row text matches and is an ITEM (has checkbox, NOT a section)
  await expect(list.locator('.checklist-item-text').first()).toHaveText('My new task');
  await expect(list.locator('.checklist-item').first()).not.toHaveClass(/checklist-section/);
  await expect(list.locator('.checklist-item .checklist-checkbox').first()).toBeAttached();

  // Progress badge shows 0/1
  const badge = page.locator('.checklist-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('0/1');

  // Persist on reload
  await page.reload();
  await expect(page.locator('#checklist-items .checklist-item')).toHaveCount(1);
  await expect(page.locator('.checklist-item-text').first()).toHaveText('My new task');

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

// ---------------------------------------------------------------------------
// Add item via Enter key
// ---------------------------------------------------------------------------
test('add item via Enter: creates item (not section), buttons keep static labels', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const list = page.locator('#checklist-items');
  const input = page.locator('.checklist-new-item-input');

  // Verify button labels are static
  await expect(page.locator('#checklist-add-item-btn')).toHaveText('Add item');
  await expect(page.locator('#checklist-add-section-btn')).toHaveText('Add section');

  // Fill and press Enter
  await input.fill('Enter task');
  await input.press('Enter');

  // Should be an item (not section)
  await expect(list.locator('.checklist-item')).toHaveCount(1, { timeout: 7000 });
  const row = list.locator('.checklist-item').first();
  await expect(row).not.toHaveClass(/checklist-section/);
  await expect(row.locator('.checklist-checkbox')).toBeAttached();
  await expect(row.locator('.checklist-item-text')).toHaveText('Enter task');

  // Button labels unchanged
  await expect(page.locator('#checklist-add-item-btn')).toHaveText('Add item');
  await expect(page.locator('#checklist-add-section-btn')).toHaveText('Add section');

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

// ---------------------------------------------------------------------------
// Add section then item — the core regression test for issue #2
// ---------------------------------------------------------------------------
test('add-section-then-item: section is section, subsequent Enter creates item, buttons stay static', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');

  // Pre-seed one regular item so we have a progress denominator to compare
  seedChecklist(ISSUE_ID, ['Existing task']);

  await page.goto(ISSUE_URL);

  const badge = page.locator('.checklist-badge');
  await expect(badge).toContainText('0/1');

  const list = page.locator('#checklist-items');
  const input = page.locator('.checklist-new-item-input');

  // --- Step 1: click "Add section", type "Sec A", click "Add section" button ---
  await expect(page.locator('#checklist-add-section-btn')).toHaveText('Add section');
  await input.fill('Sec A');
  await page.click('#checklist-add-section-btn');

  // Wait for section row to appear
  await expect(list.locator('.checklist-section')).toHaveCount(1, { timeout: 7000 });

  // Section has no checkbox → confirms is_section=1
  const sectionRow = list.locator('.checklist-section').first();
  await expect(sectionRow.locator('.checklist-checkbox')).toHaveCount(0);
  await expect(sectionRow.locator('.checklist-section-label')).toHaveText('Sec A');

  // Progress denominator still 1 (section excluded)
  await expect(badge).toContainText('0/1');

  // Buttons still have static labels after section creation
  await expect(page.locator('#checklist-add-item-btn')).toHaveText('Add item');
  await expect(page.locator('#checklist-add-section-btn')).toHaveText('Add section');

  // --- Step 2: immediately type "Task B" and press Enter → must be an ITEM ---
  await input.fill('Task B');
  await input.press('Enter');

  // Wait for new row — total items = 3 (Existing task + Sec A + Task B)
  await expect(list.locator('.checklist-item')).toHaveCount(3, { timeout: 7000 });

  // The newly added row (last) must be an ITEM, not a section
  const lastRow = list.locator('.checklist-item').last();
  await expect(lastRow).not.toHaveClass(/checklist-section/);
  await expect(lastRow.locator('.checklist-checkbox')).toBeAttached();
  await expect(lastRow.locator('.checklist-item-text')).toHaveText('Task B');

  // Progress should be 0/2 now (Existing task + Task B count; Sec A excluded)
  await expect(badge).toContainText('0/2');

  // Buttons still static after all interactions
  await expect(page.locator('#checklist-add-item-btn')).toHaveText('Add item');
  await expect(page.locator('#checklist-add-section-btn')).toHaveText('Add section');

  // Persist on reload
  await page.reload();
  await expect(page.locator('#checklist-items .checklist-section')).toHaveCount(1);
  await expect(page.locator('#checklist-items .checklist-item')).toHaveCount(3); // 2 tasks + 1 section

  // After reload the badge should still be 0/2
  await expect(page.locator('.checklist-badge')).toContainText('0/2');

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

// ---------------------------------------------------------------------------
// Validation: empty subject
// ---------------------------------------------------------------------------
test('validation: empty subject shows inline error, no row added', async ({ page }) => {
  const { failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const list = page.locator('#checklist-items');
  const initialCount = await list.locator('.checklist-item').count();

  // Submit with empty input via "Add item" button
  await page.click('#checklist-add-item-btn');

  // Inline error should appear
  await expect(page.locator('.checklist-inline-error')).toBeVisible({ timeout: 7000 });

  // No new row
  await expect(list.locator('.checklist-item')).toHaveCount(initialCount);

  // Page still intact — add form still present
  await expect(page.locator('#checklist-add-form')).toBeVisible();

  // Buttons still static
  await expect(page.locator('#checklist-add-item-btn')).toHaveText('Add item');
  await expect(page.locator('#checklist-add-section-btn')).toHaveText('Add section');

  // The failedRequests check: the 422 from the server is expected here
  // but should not be a network error (just a handled AJAX error response).
  // The error.js.erb is rendered, not a true failure.
  await logout(page);
});
