/**
 * Phase 12 E2E Spec: dates respect the Redmine (user/site) locale everywhere.
 * With a distinctive date_format (%d.%m.%Y), the checklist due field must DISPLAY
 * 06.08.2026 (not ISO 2026-08-06 or browser MM/DD), submit an ISO value, and the
 * History tab must render the change in the site format too.
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

test.beforeAll(() => ruby(`Setting.date_format = '%d.%m.%Y';
  Setting.plugin_redmine_checklist = Setting.plugin_redmine_checklist.merge('save_log'=>'1')`));
test.afterAll(() => ruby(`Setting.date_format = '';
  Issue.find(${ISSUE_ID}).checklist_items.delete_all; Issue.find(${ISSUE_ID}).update_columns(due_date:nil)`));

test('due field shows the site date format, submits ISO, and History uses the site format', async ({ page }) => {
  ruby(`i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; Issue.where(parent_id:${ISSUE_ID}).destroy_all; i.update_columns(due_date:nil);
        i.checklist_items.create!(subject:'Dated', position:0, due_date: Date.new(2026,8,6))`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const row = page.locator('#checklist-items .checklist-item').first();
  // Read-only meta already uses format_date:
  await expect(row.locator('.checklist-due')).toContainText('06.08.2026');

  // The editable field shows the site format (not ISO, not browser MM/DD).
  await row.locator('.checklist-expand').click();
  const display = row.locator('.checklist-detail-due-display');
  await expect(display).toHaveValue('06.08.2026');

  // jQuery UI datepicker opens and writes an ISO value to the hidden field.
  await display.click();
  await expect(page.locator('.ui-datepicker-calendar')).toBeVisible({ timeout: 5000 });
  await page.locator('.ui-datepicker-calendar a').first().click();
  const iso = await row.locator('.checklist-detail-due').inputValue();
  expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  // Save → the ISO value is persisted.
  await row.locator('.checklist-detail-save').click();
  await page.waitForTimeout(1200);
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).checklist_items.order(:position).first.due_date&.to_s`)).toBe(iso);

  // History renders the due change in the site format (dotted), never ISO.
  await page.locator('#tab-history, a[href*="tab=history"]').first().click();
  const hist = page.locator('#tab-content-history');
  await expect(hist).toContainText(/due \d{2}\.\d{2}\.\d{4}/, { timeout: 7000 });
  expect(await hist.innerText()).not.toMatch(/\d{4}-\d{2}-\d{2}/);

  await logout(page);
});
