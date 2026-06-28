/**
 * Issue #3: Inline edit of item/section title
 *
 * Regression spec:
 * 1. Seed one item. Click its edit control (✎). Change text to "Edited". Press Enter.
 *    Assert: row now shows "Edited" AND DB subject == 'Edited' (verified via rails runner).
 * 2. Test Esc cancels — original text unchanged.
 * 3. Test editing a section label works the same way.
 * 4. Assert no console errors / failed checklist requests.
 */
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { resetChecklist, seedChecklist } from './reset';

const ISSUE_URL = `/issues/${ISSUE_ID}`;
const DC = 'docker compose -f docker-compose.yml -f docker-compose.local.yml';
const DEVC = '/home/ibaou/workspace/redmine-devcontainer';

function getItemSubject(issueId: string | number, index = 0): string {
  // Returns the subject of the checklist item at given ordered index
  const ruby = `puts Issue.find(${issueId}).checklist_items.ordered.to_a[${index}]&.subject.to_s`;
  const out = execSync(`${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(ruby)}`, {
    cwd: DEVC,
  }).toString().trim();
  // Filter zsh noise
  return out.split('\n').filter(l => !l.startsWith('setValue') && !l.startsWith('valueFor') && !l.startsWith('/usr/local')).join('').trim();
}

test.beforeEach(() => {
  resetChecklist(ISSUE_ID);
});

// ---------------------------------------------------------------------------
// Edit an item title and press Enter to save
// ---------------------------------------------------------------------------
test('inline edit: click edit control, change text, Enter saves — DOM and DB updated', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);

  seedChecklist(ISSUE_ID, ['Original subject']);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const list = page.locator('#checklist-items');
  await expect(list.locator('.checklist-item')).toHaveCount(1, { timeout: 7000 });

  // Hover to reveal the actions toolbar
  const itemRow = list.locator('.checklist-item').first();
  await itemRow.hover();

  // Click the edit control
  const editBtn = itemRow.locator('.checklist-edit').first();
  await expect(editBtn).toBeAttached();
  await editBtn.click();

  // An inline input should appear in the row
  const editInput = itemRow.locator('.checklist-edit-input');
  await expect(editInput).toBeVisible({ timeout: 5000 });

  // The input is pre-filled with the current subject
  await expect(editInput).toHaveValue('Original subject');

  // Clear and type new text
  await editInput.fill('Edited subject');
  await editInput.press('Enter');

  // Wait for the row to be re-rendered with the new text (update.js.erb replaces the li)
  await expect(list.locator('.checklist-item-text').first()).toHaveText('Edited subject', { timeout: 7000 });

  // Verify DB state via rails runner
  const dbSubject = getItemSubject(ISSUE_ID, 0);
  expect(dbSubject, 'DB subject must be updated').toBe('Edited subject');

  // Edit input is gone (row was replaced)
  await expect(list.locator('.checklist-edit-input')).toHaveCount(0);

  // Persist on reload
  await page.reload();
  await expect(page.locator('.checklist-item-text').first()).toHaveText('Edited subject');

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

// ---------------------------------------------------------------------------
// Escape cancels the edit — original text unchanged
// ---------------------------------------------------------------------------
test('inline edit: Escape cancels, original text restored, DB unchanged', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);

  seedChecklist(ISSUE_ID, ['Unchanged subject']);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const list = page.locator('#checklist-items');
  await expect(list.locator('.checklist-item')).toHaveCount(1, { timeout: 7000 });

  const itemRow = list.locator('.checklist-item').first();
  await itemRow.hover();

  // Click edit
  await itemRow.locator('.checklist-edit').first().click();

  const editInput = itemRow.locator('.checklist-edit-input');
  await expect(editInput).toBeVisible({ timeout: 5000 });

  // Type something new but press Escape
  await editInput.fill('Attempt to change');
  await editInput.press('Escape');

  // Input should be gone and original text restored
  await expect(list.locator('.checklist-edit-input')).toHaveCount(0, { timeout: 5000 });
  await expect(list.locator('.checklist-item-text').first()).toHaveText('Unchanged subject');

  // DB unchanged
  const dbSubject = getItemSubject(ISSUE_ID, 0);
  expect(dbSubject, 'DB subject must be unchanged after Escape').toBe('Unchanged subject');

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

// ---------------------------------------------------------------------------
// Edit a section label
// ---------------------------------------------------------------------------
test('inline edit: section label can be edited and saved', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Create a section via the button
  const input = page.locator('.checklist-new-item-input');
  await input.fill('Original Section');
  await page.click('#checklist-add-section-btn');

  const list = page.locator('#checklist-items');
  await expect(list.locator('.checklist-section')).toHaveCount(1, { timeout: 7000 });

  const sectionRow = list.locator('.checklist-section').first();
  await sectionRow.hover();

  // Click edit control on the section
  const editBtn = sectionRow.locator('.checklist-edit').first();
  await expect(editBtn).toBeAttached();
  await editBtn.click();

  const editInput = sectionRow.locator('.checklist-edit-input');
  await expect(editInput).toBeVisible({ timeout: 5000 });
  await expect(editInput).toHaveValue('Original Section');

  await editInput.fill('Renamed Section');
  await editInput.press('Enter');

  // Section should be re-rendered with new label
  await expect(list.locator('.checklist-section .checklist-section-label').first())
    .toHaveText('Renamed Section', { timeout: 7000 });

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

// ---------------------------------------------------------------------------
// Edit control is visible for manage tier only
// ---------------------------------------------------------------------------
test('cl_viewer: no edit control visible', async ({ page }) => {
  seedChecklist(ISSUE_ID, ['View only item']);
  await login(page, 'cl_viewer', 'Test1234!');
  await page.goto(ISSUE_URL);

  await expect(page.locator('#checklist-panel')).toBeVisible();
  await expect(page.locator('.checklist-edit')).not.toBeAttached();

  await logout(page);
});

test('cl_checker: no edit control visible', async ({ page }) => {
  seedChecklist(ISSUE_ID, ['Checker item']);
  await login(page, 'cl_checker', 'Test1234!');
  await page.goto(ISSUE_URL);

  await expect(page.locator('#checklist-panel')).toBeVisible();
  await expect(page.locator('.checklist-edit')).not.toBeAttached();

  await logout(page);
});
