/**
 * Phase 8 E2E Spec: checklist due-date surfacing (pragmatic calendar/Gantt)
 *
 * Rather than patching Redmine's calendar/gantt internals, checklist due dates
 * are surfaced two robust ways:
 *   1. a "next checklist due" chip in the checklist panel header (earliest OPEN,
 *      non-converted item's due date), and
 *   2. an optional sortable "Checklist due" issue-list / query column.
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID } from './helpers';
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
  ruby(`Issue.find(${ISSUE_ID}).checklist_items.delete_all`);
});

test('panel: shows a "next checklist due" chip with the earliest open due date', async ({ page }) => {
  // Two open dated items (+5, +3) and a done one (+1). The chip shows +3.
  ruby(`i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all;
        i.checklist_items.create!(subject:'later', position:0, due_date: Date.today+5);
        i.checklist_items.create!(subject:'soonest', position:1, due_date: Date.today+3);
        i.checklist_items.create!(subject:'done', position:2, due_date: Date.today+1, is_done:true)`);
  const expected = rubyOut(`print ApplicationController.helpers.format_date(Date.today+3)`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const chip = page.locator('#checklist-panel .checklist-next-due');
  await expect(chip).toHaveCount(1);
  await expect(chip).toContainText(expected);

  await logout(page);
});

test('due propagation: setting a checklist item due date derives the issue due date (via the detail panel)', async ({ page }) => {
  // Leaf issue, no subtasks, no manual due date, one item.
  ruby(`Setting.plugin_redmine_checklist = Setting.plugin_redmine_checklist.merge('combine_checklist_due'=>'1');
        i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; Issue.where(parent_id:${ISSUE_ID}).destroy_all; i.update_columns(due_date:nil);
        i.checklist_items.create!(subject:'Dated step', position:0)`);
  const due = rubyOut(`print (Date.today+6).to_s`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).due_date.inspect`)).toBe('nil');

  // Set the item's due date via the expandable detail panel and save.
  const row = page.locator('#checklist-items .checklist-item').first();
  await row.locator('.checklist-expand').click();
  const panel = row.locator('.checklist-item-details');
  await expect(panel).toBeVisible();
  await panel.locator('.checklist-detail-due').fill(due);
  await panel.locator('.checklist-detail-save').click();
  await page.waitForTimeout(1200);

  // The issue's own due_date is now derived from the checklist item.
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).due_date&.to_s`)).toBe(due);

  ruby(`Issue.find(${ISSUE_ID}).checklist_items.delete_all; Issue.find(${ISSUE_ID}).update_columns(due_date:nil)`);
  await logout(page);
});

test('issue list: the "Checklist due" column shows the earliest open due date', async ({ page }) => {
  ruby(`i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all;
        i.checklist_items.create!(subject:'A', position:0, due_date: Date.today+7);
        i.checklist_items.create!(subject:'B', position:1, due_date: Date.today+4)`);
  const expected = rubyOut(`print ApplicationController.helpers.format_date(Date.today+4)`);

  await login(page, 'admin', 'Test1234!');
  await page.goto('/issues?set_filter=1&c%5B%5D=subject&c%5B%5D=checklist_due_date&sort=id:desc');
  await page.waitForLoadState('networkidle');

  const headers = await page.locator('table.issues thead th').allInnerTexts();
  expect(headers.some(h => /checklist due/i.test(h))).toBeTruthy();

  const row9 = page.locator('table.issues tr#issue-' + ISSUE_ID);
  await expect(row9.locator('td.checklist_due_date')).toContainText(expected, { timeout: 7000 });

  await logout(page);
});
