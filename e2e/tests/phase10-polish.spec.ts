/**
 * Phase 10 E2E Spec: polish fixes
 *  a) quick convert → the new subtask appears in the core Subtasks tree w/o reload
 *  b) the expand chevron sits right after the drag handle and still toggles
 *  c) the drag handle shows an up/down (ns-resize) cursor
 *  d) deleting the LAST checklist item resets the issue %Done live (was stale)
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

test.afterAll(() => {
  ruby(`Issue.where(parent_id:${ISSUE_ID}).destroy_all; Issue.find(${ISSUE_ID}).checklist_items.delete_all;
        Setting.plugin_redmine_checklist={'show_progress_bar'=>'1','save_log'=>'1'}`);
});

// (d) delete last item resets %Done live
test('delete: removing the last checklist item resets %Done live', async ({ page }) => {
  ruby(`Setting.plugin_redmine_checklist={'show_progress_bar'=>'1','affect_done_ratio'=>'1','save_log'=>'1','subtask_done_ratio'=>'1'};
        Setting.issue_done_ratio='issue_field';
        i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; Issue.where(parent_id:${ISSUE_ID}).destroy_all;
        i.checklist_items.create!(subject:'Only one', position:0, is_done:true); ChecklistItem.recalc_done_ratio(${ISSUE_ID})`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const cell = page.locator('.attribute.progress .value');
  await expect(cell).toContainText('100%');

  await page.locator('#checklist-items .checklist-item').first().locator('.checklist-delete').click();
  await expect(cell).toContainText('0%', { timeout: 7000 });
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).done_ratio`)).toBe('0');

  await logout(page);
});

// (b)+(c) chevron placement/toggle + handle cursor
test('layout: expand chevron follows the drag handle, toggles the panel; handle cursor is ns-resize', async ({ page }) => {
  ruby(`Issue.find(${ISSUE_ID}).checklist_items.delete_all; Issue.find(${ISSUE_ID}).checklist_items.create!(subject:'Row', position:0)`);
  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const row = page.locator('#checklist-items .checklist-item').first();

  // Order among the li's direct children: handle → expand → checkbox.
  const ordered = await row.evaluate((li) => {
    const kids = Array.from(li.children);
    const h = kids.findIndex(k => k.classList.contains('checklist-handle'));
    const e = kids.findIndex(k => k.classList.contains('checklist-expand'));
    const c = kids.findIndex(k => k.classList.contains('checklist-checkbox'));
    return h >= 0 && e === h + 1 && c > e;
  });
  expect(ordered).toBeTruthy();

  // Handle shows an up/down cursor.
  const cursor = await row.locator('.checklist-handle').evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe('ns-resize');

  // The chevron still toggles the detail panel.
  const panel = row.locator('.checklist-item-details');
  await expect(panel).toBeHidden();
  await row.locator('.checklist-expand').click();
  await expect(panel).toBeVisible();
  await row.locator('.checklist-expand').click();
  await expect(panel).toBeHidden();

  await logout(page);
});

// (a) quick convert reflects the new subtask in the tree without reload
test('quick convert: the new subtask appears in the Subtasks tree without a reload', async ({ page }) => {
  const { failedRequests } = trackErrors(page);
  ruby(`Issue.find(${ISSUE_ID}).checklist_items.delete_all; Issue.where(parent_id:${ISSUE_ID}).destroy_all;
        Issue.find(${ISSUE_ID}).checklist_items.create!(subject:'Promote via quick', position:0)`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  await page.locator('#checklist-items .checklist-item').first().locator('.checklist-quick-convert').click();
  await expect(page.locator('#checklist-items .checklist-converted')).toHaveCount(1, { timeout: 7000 });

  const childId = rubyOut(`print Issue.where(parent_id:${ISSUE_ID}).order(:id).last&.id`);
  expect(childId).toMatch(/^\d+$/);
  // The subtasks tree now links the child — without any page reload.
  await expect(page.locator(`#issue_tree a[href="/issues/${childId}"]`).first()).toHaveCount(1, { timeout: 7000 });

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});
