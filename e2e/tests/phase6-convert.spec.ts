/**
 * Phase 6 E2E Spec: Convert checklist item -> subtask (v1.1.0)
 *
 * Covers:
 *  1. Happy path: an open task shows a "Convert to subtask" control; clicking it
 *     lands on the prefilled new-issue form (subject + parent + signed token
 *     hidden field); submitting creates a child issue linked back to the item;
 *     the parent then shows a locked converted row linking the child; and the
 *     conversion is journaled in History ("converted to #N", never raw JSON).
 *  2. Done-state mirror: closing the child issue marks the converted item done
 *     and makes it count toward checklist progress.
 *  3. Guards: the control is hidden for sections and for already-done items.
 *  4. Permission gate: a manager WITHOUT manage_subtasks sees no convert control
 *     (but still sees the edit control).
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

function cleanupChildren() {
  // Remove any child issues spawned by conversion tests (leaf-first via destroy).
  ruby(`Issue.where(parent_id: ${ISSUE_ID}).destroy_all`);
}
function resetIssue() {
  ruby(`i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; i.update_columns(status_id:1, done_ratio:0);
        Journal.joins(:details).where(journalized_type:'Issue',journalized_id:${ISSUE_ID}).where(journal_details:{prop_key:'checklist'}).destroy_all`);
}
function defaults() {
  ruby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','save_log'=>'1'}`);
}

test.beforeEach(() => {
  defaults();
  cleanupChildren();
  resetIssue();
});

test.afterAll(() => {
  cleanupChildren();
  resetIssue();
  defaults();
});

// ---------------------------------------------------------------------------
// 1. Happy path — convert an open task, then verify link + locked row + history
// ---------------------------------------------------------------------------
test('convert: promotes an open task to a child issue with a locked linked row and history entry', async ({ page }) => {
  const { failedRequests } = trackErrors(page);
  ruby(`Issue.find(${ISSUE_ID}).checklist_items.create!(subject:'Promote me', position:0,
          assignee_id: User.find_by(login:'admin').id, due_date: Date.today+5)`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const row = page.locator('#checklist-items .checklist-item').first();
  const convert = row.locator('.checklist-convert');
  await expect(convert).toHaveCount(1);

  // Navigate to the prefilled new-issue form.
  await convert.click();
  await page.waitForURL('**/issues/new**', { timeout: 7000 });

  // Prefilled: subject + parent + signed token hidden field.
  await expect(page.locator('#issue_subject')).toHaveValue('Promote me');
  expect(await page.locator('#issue_parent_issue_id').inputValue()).toBe(ISSUE_ID);
  await expect(page.locator('input[name="checklist_item_token"]')).toHaveCount(1);

  // Create the child issue.
  await page.locator('input[name="commit"]').first().click();
  await page.waitForLoadState('networkidle');

  // A child issue exists under the parent, and the item is linked to it.
  const childId = rubyOut(`print Issue.where(parent_id:${ISSUE_ID}).order(:id).last&.id`);
  expect(childId).toMatch(/^\d+$/);
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).checklist_items.order(:position).first.converted_issue_id`)).toBe(childId);

  // Back on the parent: the row is now a locked converted row linking the child,
  // with no checkbox and no re-convert control.
  await page.goto(`/issues/${ISSUE_ID}`);
  const crow = page.locator('#checklist-items .checklist-converted').first();
  await expect(crow).toHaveCount(1);
  await expect(crow.locator(`a[href="/issues/${childId}"]`)).toHaveCount(1);
  await expect(crow.locator('.checklist-checkbox')).toHaveCount(0);
  await expect(crow.locator('.checklist-convert')).toHaveCount(0);

  // History records the conversion in human-readable form (no raw JSON).
  await page.locator('#tab-history, a[href*="tab=history"]').first().click();
  const content = page.locator('#tab-content-history');
  // History renders e.g. "Checklist: Promote me (converted to Bug #22: Promote me)"
  await expect(content).toContainText('converted to', { timeout: 7000 });
  await expect(content).toContainText(`#${childId}`);
  await expect(content.locator(`a[href="/issues/${childId}"]`).first()).toHaveCount(1);
  const htext = await page.locator('#history').innerText();
  for (const m of ['{"id":', 'is_section', 'field_checklist', 'Translation missing']) {
    expect(htext, `History must not contain "${m}"`).not.toContain(m);
  }

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 2. Done-state mirror — closing the child marks the item done / counts progress
// ---------------------------------------------------------------------------
test('convert: closing the child issue marks the converted item done and counts toward progress', async ({ page }) => {
  // Seed + link programmatically to isolate the mirror behaviour.
  ruby(`i=Issue.find(${ISSUE_ID});
        it=i.checklist_items.create!(subject:'Mirror me', position:0);
        child=Issue.create!(project:i.project, tracker:i.tracker, author:User.find(1),
                            subject:'Mirror child', status:i.tracker.default_status, parent_issue_id:i.id);
        it.update_columns(converted_issue_id: child.id, converted_at: Time.current, converted_by_id: 1)`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const crow = page.locator('#checklist-items .checklist-converted').first();
  await expect(crow).toHaveCount(1);
  await expect(crow).not.toHaveClass(/is-done/); // child open -> not done

  // Close the child issue.
  ruby(`Issue.where(parent_id:${ISSUE_ID}).each { |c| c.update!(status: IssueStatus.where(is_closed:true).first) }`);
  await page.reload();

  const crow2 = page.locator('#checklist-items .checklist-converted').first();
  await expect(crow2).toHaveClass(/is-done/); // mirrors the closed child

  // Progress stats now count the converted item as done.
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).checklist_progress_stats.inspect`)).toContain('done: 1');

  await logout(page);
});

// ---------------------------------------------------------------------------
// 3. Guards — no convert control for sections or done items
// ---------------------------------------------------------------------------
test('convert: control is hidden for sections and for done items, shown for open tasks', async ({ page }) => {
  ruby(`i=Issue.find(${ISSUE_ID});
        i.checklist_items.create!(subject:'A section', position:0, is_section:true);
        i.checklist_items.create!(subject:'Done task', position:1, is_done:true);
        i.checklist_items.create!(subject:'Open task', position:2)`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const items = page.locator('#checklist-items .checklist-item');
  await expect(items.nth(0).locator('.checklist-convert')).toHaveCount(0); // section
  await expect(items.nth(1).locator('.checklist-convert')).toHaveCount(0); // done
  await expect(items.nth(2).locator('.checklist-convert')).toHaveCount(1); // open task

  await logout(page);
});

// ---------------------------------------------------------------------------
// 3b. Combined done_ratio — checklist items AND subtasks together drive % Done
// ---------------------------------------------------------------------------
test('convert: issue % Done combines checklist items and subtasks (subtask close counts)', async ({ page }) => {
  // 3 checklist items; convert two to real child issues. Combined units = 3
  // (plain item3 + subtask1 + subtask2). done_ratio must reflect BOTH, not the
  // core subtask-only average.
  ruby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','save_log'=>'1','affect_done_ratio'=>'1'};
        Setting.issue_done_ratio = 'issue_field';
        i=Issue.find(${ISSUE_ID});
        i1=i.checklist_items.create!(subject:'I1',position:0);
        i2=i.checklist_items.create!(subject:'I2',position:1);
        i3=i.checklist_items.create!(subject:'I3',position:2);
        ds=i.tracker.default_status;
        c1=Issue.create!(project:i.project,tracker:i.tracker,author:User.find(1),subject:'S1',status:ds,parent_issue_id:${ISSUE_ID});
        c2=Issue.create!(project:i.project,tracker:i.tracker,author:User.find(1),subject:'S2',status:ds,parent_issue_id:${ISSUE_ID});
        i1.update_columns(converted_issue_id:c1.id); i2.update_columns(converted_issue_id:c2.id)`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  // Only the plain item (I3) has a checkbox; converted rows are locked.
  const checkbox = page.locator('#checklist-items .checklist-checkbox');
  await expect(checkbox).toHaveCount(1);
  await checkbox.check();
  await page.waitForTimeout(1200);
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).done_ratio`)).toBe('30'); // 1 of 3

  // Close one converted subtask → parent % Done becomes 2 of 3 (60), NOT the
  // core subtask-only average (which would be 50).
  ruby(`Issue.where(parent_id:${ISSUE_ID}).order(:id).first.update!(status: IssueStatus.where(is_closed:true).first)`);
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).done_ratio`)).toBe('60'); // 2 of 3, combined

  // The issue page reflects 60% (after reload — live %Done refresh is a known gap).
  await page.reload();
  await expect(page.locator('#content')).toContainText('60%');

  ruby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','save_log'=>'1'}`);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 3c. Done-ratio hardening — the subtask_done_ratio toggle switches combining
// ---------------------------------------------------------------------------
test('done-ratio: subtask_done_ratio toggle turns subtask-combining on/off', async () => {
  const cfg = (combine: string) => ruby(
    `Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','affect_done_ratio'=>'1','save_log'=>'1','subtask_done_ratio'=>'${combine}'};
     Setting.issue_done_ratio = 'issue_field'`);
  // 3 items, convert 2 → 3 combined units; tick the plain one, close one subtask.
  const seed = () => ruby(
    `i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; Issue.where(parent_id:${ISSUE_ID}).destroy_all; i.update_columns(done_ratio:0);
     i1=i.checklist_items.create!(subject:'I1',position:0);
     i2=i.checklist_items.create!(subject:'I2',position:1);
     i3=i.checklist_items.create!(subject:'I3',position:2);
     ds=i.tracker.default_status;
     c1=Issue.create!(project:i.project,tracker:i.tracker,author:User.find(1),subject:'S1',status:ds,parent_issue_id:${ISSUE_ID});
     c2=Issue.create!(project:i.project,tracker:i.tracker,author:User.find(1),subject:'S2',status:ds,parent_issue_id:${ISSUE_ID});
     i1.update_columns(converted_issue_id:c1.id); i2.update_columns(converted_issue_id:c2.id);
     i3.update!(is_done:true); ChecklistItem.recalc_done_ratio(${ISSUE_ID});
     Issue.where(parent_id:${ISSUE_ID}).order(:id).first.update!(status: IssueStatus.where(is_closed:true).first)`);

  // ON → combined: I3 done + S1 closed of 3 units = 60.
  cfg('1'); seed();
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).done_ratio`)).toBe('60');

  // OFF → plugin leaves the subtask-parent to core (subtask-only avg = 1/2 = 50).
  cfg('0'); seed();
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).done_ratio`)).toBe('50');

  ruby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','save_log'=>'1'}`);
});

// ---------------------------------------------------------------------------
// 4. Permission gate — manage_checklists without manage_subtasks: no convert
// ---------------------------------------------------------------------------
test('convert: hidden for a manager lacking manage_subtasks (edit still shown)', async ({ page }) => {
  ruby(`Issue.find(${ISSUE_ID}).checklist_items.create!(subject:'Perm gate', position:0)`);

  await login(page, 'cl_manager', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const row = page.locator('#checklist-items .checklist-item').first();
  await expect(row.locator('.checklist-edit')).toHaveCount(1);    // has manage_checklists
  await expect(row.locator('.checklist-convert')).toHaveCount(0); // lacks manage_subtasks

  await logout(page);
});
