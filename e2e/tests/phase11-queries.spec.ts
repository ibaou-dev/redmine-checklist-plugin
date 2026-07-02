/**
 * Phase 11 E2E Spec: checklist assignee/due in issue queries (v1.3.0)
 *  - a checklist item assigned to me makes the issue show in "Assigned to me"
 *    (the native assignee filter), even if the issue itself is assigned to
 *    someone else — no shadow assignments. Kill-switch reverts to core.
 *  - the "Checklist assignees" column and "Checklist due" filter work.
 */
import { test, expect } from '@playwright/test';
import { login, logout } from './helpers';
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

// Issue assigned (issue-level) to cl_viewer, with a checklist item assigned to cl_checker.
const SEED = `
  p=Project.find_by(identifier:'checklist-qa'); t=p.trackers.first; s=t.default_status;
  viewer=User.find_by(login:'cl_viewer'); checker=User.find_by(login:'cl_checker');
  i=Issue.create!(project:p,tracker:t,author:User.find(1),subject:'Shadow assign probe',status:s,assigned_to_id:viewer.id);
  i.checklist_items.create!(subject:'Checker task', position:0, assignee_id:checker.id, due_date: Date.today+3);
  print i.id`;
const ASSIGNED_TO_ME = '/issues?set_filter=1&f%5B%5D=assigned_to_id&op%5Bassigned_to_id%5D=%3D&v%5Bassigned_to_id%5D%5B%5D=me';

let issueId = '';
test.beforeAll(() => {
  ruby(`Setting.plugin_redmine_checklist = Setting.plugin_redmine_checklist.merge('include_checklist_assignee'=>'1')`);
  issueId = rubyOut(SEED);
});
test.afterAll(() => {
  ruby(`Issue.where(subject:'Shadow assign probe').destroy_all;
        Setting.plugin_redmine_checklist = Setting.plugin_redmine_checklist.merge('include_checklist_assignee'=>'1')`);
});

test('assignee fold: an issue with my checklist item shows in "Assigned to me"; kill-switch removes it', async ({ page }) => {
  expect(issueId).toMatch(/^\d+$/);

  // cl_checker is NOT the issue assignee (cl_viewer is), but has a checklist item on it.
  await login(page, 'cl_checker', 'Test1234!');
  await page.goto(ASSIGNED_TO_ME);
  await page.waitForLoadState('networkidle');
  await expect(page.locator(`tr#issue-${issueId}`)).toHaveCount(1); // visible via checklist assignment

  // Kill-switch OFF → back to core semantics → the issue is gone from "assigned to me".
  ruby(`Setting.plugin_redmine_checklist = Setting.plugin_redmine_checklist.merge('include_checklist_assignee'=>'0')`);
  await page.reload();
  await expect(page.locator(`tr#issue-${issueId}`)).toHaveCount(0);

  ruby(`Setting.plugin_redmine_checklist = Setting.plugin_redmine_checklist.merge('include_checklist_assignee'=>'1')`);
  await logout(page);
});

test('column + due filter: "Checklist assignees" column shows the owner; "Checklist due" filter narrows', async ({ page }) => {
  await login(page, 'admin', 'Test1234!');

  // Column
  await page.goto('/issues?set_filter=1&c%5B%5D=subject&c%5B%5D=checklist_assignees&sort=id:desc');
  await page.waitForLoadState('networkidle');
  const headers = await page.locator('table.issues thead th').allInnerTexts();
  expect(headers.some(h => /checklist assignees/i.test(h))).toBeTruthy();
  await expect(page.locator(`tr#issue-${issueId} td.checklist_assignees`)).toContainText('Checker');

  // Due filter: checklist item due in +3 → matches "due on or before +7", not "on or before yesterday".
  const soon = rubyOut(`print (Date.today+7).to_s`);
  await page.goto(`/issues?set_filter=1&f%5B%5D=checklist_due_date&op%5Bchecklist_due_date%5D=%3C%3D&v%5Bchecklist_due_date%5D%5B%5D=${soon}&c%5B%5D=subject`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator(`tr#issue-${issueId}`)).toHaveCount(1);

  const past = rubyOut(`print (Date.today-1).to_s`);
  await page.goto(`/issues?set_filter=1&f%5B%5D=checklist_due_date&op%5Bchecklist_due_date%5D=%3C%3D&v%5Bchecklist_due_date%5D%5B%5D=${past}&c%5B%5D=subject`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator(`tr#issue-${issueId}`)).toHaveCount(0);

  await logout(page);
});
