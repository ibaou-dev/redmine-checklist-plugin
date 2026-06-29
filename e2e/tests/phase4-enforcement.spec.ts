/**
 * Phase 4 E2E Spec: mandatory enforcement + per-item details
 *
 * Covers:
 *  1. Enforcement: with enforcement enabled for a status, changing an issue to
 *     that status is BLOCKED while a mandatory checklist item is unchecked, and
 *     ALLOWED once it is checked. Verified through the real issue edit form and
 *     against the DB.
 *  2. Per-item details: the expandable detail row sets assignee + due date +
 *     mandatory; the saved row shows the mandatory flag and meta.
 *  3. Read-only users still see the mandatory flag but no expand control.
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { execSync } from 'node:child_process';

const DC = 'docker compose -f docker-compose.yml -f docker-compose.local.yml';
const DEVC = '/home/ibaou/workspace/redmine-devcontainer';
function ruby(r: string) {
  execSync(`${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(r.replace(/\s+/g, ' ').trim())}`,
    { cwd: DEVC, stdio: 'ignore' });
}
function rubyOut(r: string): string {
  return execSync(`${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(r.replace(/\s+/g, ' ').trim())}`,
    { cwd: DEVC, encoding: 'utf8' }).trim().split('\n').pop() || '';
}

const CLOSED = '5'; // Closed status id

function enableEnforcement() {
  ruby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','save_log'=>'1','enforce_mandatory'=>'1','enforce_statuses'=>['${CLOSED}']}`);
}
function resetIssueOpen() {
  ruby(`i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; i.update_columns(status_id:1, done_ratio:0); Journal.joins(:details).where(journalized_type:'Issue',journalized_id:${ISSUE_ID}).where(journal_details:{prop_key:'checklist'}).destroy_all`);
}
function seedMandatory() {
  ruby(`Issue.find(${ISSUE_ID}).checklist_items.create!(subject:'Mandatory gate', position:0, is_mandatory:true)`);
}

test.beforeEach(() => {
  enableEnforcement();
  resetIssueOpen();
});

test.afterAll(() => {
  resetIssueOpen();
  ruby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1'}`);
});

// ---------------------------------------------------------------------------
// 1. Enforcement blocks the status transition until the mandatory item is done
// ---------------------------------------------------------------------------
test('enforcement: blocked status is refused with an incomplete mandatory item, allowed once done', async ({ page }) => {
  const { failedRequests } = trackErrors(page);
  seedMandatory();

  await login(page, 'admin', 'Test1234!');

  // Attempt to move the issue to Closed — should be refused.
  await page.goto(`/issues/${ISSUE_ID}/edit`);
  await page.locator('#issue_status_id').evaluate((el: HTMLSelectElement, v: string) => {
    el.value = v; el.dispatchEvent(new Event('change', { bubbles: true }));
  }, CLOSED);
  await page.locator('input[name="commit"], #issue-form input[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#errorExplanation')).toContainText(/mandatory/i, { timeout: 7000 });
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).status_id`)).toBe('1'); // unchanged

  // Complete the mandatory item, then the transition succeeds.
  ruby(`Issue.find(${ISSUE_ID}).checklist_items.first.update!(is_done: true)`);
  await page.goto(`/issues/${ISSUE_ID}/edit`);
  await page.locator('#issue_status_id').evaluate((el: HTMLSelectElement, v: string) => {
    el.value = v; el.dispatchEvent(new Event('change', { bubbles: true }));
  }, CLOSED);
  await page.locator('input[name="commit"], #issue-form input[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');

  expect(rubyOut(`print Issue.find(${ISSUE_ID}).status_id`)).toBe(CLOSED);

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 2. Per-item detail row: set mandatory + due + assignee via the expand panel
// ---------------------------------------------------------------------------
test('details: expand row sets mandatory, due date and assignee; row reflects them', async ({ page }) => {
  const { failedRequests } = trackErrors(page);
  ruby(`Issue.find(${ISSUE_ID}).checklist_items.create!(subject:'Detail target', position:0)`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const row = page.locator('#checklist-items .checklist-item').first();
  await row.hover();
  await row.locator('.checklist-expand').click();
  const panel = row.locator('.checklist-item-details');
  await expect(panel).toBeVisible({ timeout: 5000 });

  await panel.locator('.checklist-detail-due').fill('2020-01-01'); // past → overdue
  await panel.locator('.checklist-detail-mandatory').check();
  // assignee select may be Prism-enhanced (native hidden); set value directly.
  const sel = panel.locator('.checklist-detail-assignee');
  const firstVal = await sel.locator('option').nth(1).getAttribute('value');
  await sel.evaluate((el: HTMLSelectElement, v: string) => {
    el.value = v; el.dispatchEvent(new Event('change', { bubbles: true }));
  }, firstVal || '');
  await panel.locator('.checklist-detail-save').click();
  await page.waitForTimeout(1200);

  const row2 = page.locator('#checklist-items .checklist-item').first();
  await expect(row2.locator('.checklist-mandatory-flag')).toHaveCount(1);
  await expect(row2.locator('.checklist-due.overdue')).toHaveCount(1); // not done → overdue
  await expect(row2.locator('.checklist-assignee')).toBeVisible();

  // Persisted in the DB.
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).checklist_items.first.is_mandatory`)).toBe('true');

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 3. Read-only user sees the mandatory flag but no expand/edit control
// ---------------------------------------------------------------------------
test('cl_viewer: sees mandatory flag, but no expand control', async ({ page }) => {
  ruby(`Issue.find(${ISSUE_ID}).checklist_items.create!(subject:'Viewer item', position:0, is_mandatory:true)`);

  await login(page, 'cl_viewer', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const row = page.locator('#checklist-items .checklist-item').first();
  await expect(row.locator('.checklist-mandatory-flag')).toHaveCount(1);
  expect(await row.locator('.checklist-expand').count()).toBe(0);

  await logout(page);
});
