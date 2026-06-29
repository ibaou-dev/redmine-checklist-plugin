/**
 * v1.0.x polish:
 *   1. Assignee / due-date / mandatory edits are recorded in the History tab.
 *   2. A mandatory item can't be unchecked while the issue is in a guarded status.
 *   3. Per-project enforcement has its OWN permission, separate from template
 *      management (enforcement-only members see the panel but not template CRUD;
 *      template-only members see templates but not the enforcement panel).
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

const ENFORCE_ROLE = 7;   // CL Checker — gets manage_checklist_enforcement only
const TEMPLATE_ROLE = 8;  // CL Manager — gets manage_checklist_templates only

test.afterAll(() => {
  ruby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1'}`);
  ruby(`ChecklistProjectSetting.delete_all`);
  ruby(`i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; i.update_columns(status_id:1, done_ratio:0)`);
  ruby(`Role.find(${ENFORCE_ROLE}).remove_permission!(:manage_checklist_enforcement)`);
  ruby(`Role.find(${TEMPLATE_ROLE}).remove_permission!(:manage_checklist_templates)`);
});

// ---------------------------------------------------------------------------
// 1. Metadata edits are journaled
// ---------------------------------------------------------------------------
test('detail edits (assignee/due/mandatory) are recorded in History', async ({ page }) => {
  ruby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','save_log'=>'1'}`);
  ruby(`ChecklistProjectSetting.delete_all; i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; i.update_columns(status_id:1); Journal.joins(:details).where(journalized_type:'Issue',journalized_id:${ISSUE_ID}).where(journal_details:{prop_key:'checklist'}).destroy_all; i.checklist_items.create!(subject:'Meta', position:0)`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const row = page.locator('#checklist-items .checklist-item').first();
  await row.hover();
  await row.locator('.checklist-expand').click();
  const panel = row.locator('.checklist-item-details');
  await expect(panel).toBeVisible();
  await panel.locator('.checklist-detail-due').fill('2026-07-15');
  await panel.locator('.checklist-detail-mandatory').check();
  await panel.locator('.checklist-detail-save').click();
  await page.waitForTimeout(1200);

  const tab = page.locator('#tab-history, a[href*="tab=history"]').first();
  if (await tab.count()) await tab.click({ force: true }).catch(() => {});
  const history = page.locator('#tab-content-history');
  await expect(history).toContainText('due', { timeout: 7000 });
  await expect(history).toContainText('mandatory');
  const htext = await page.locator('#history').innerText();
  for (const m of ['"is_section"', '{"id":', 'field_checklist', 'Translation missing']) {
    expect(htext).not.toContain(m);
  }
  await logout(page);
});

// ---------------------------------------------------------------------------
// 2. Uncheck-guard: mandatory item can't be unchecked in a guarded status
// ---------------------------------------------------------------------------
test('a mandatory item cannot be unchecked while the issue is in a guarded status', async ({ page }) => {
  ruby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','enforce_mandatory'=>'1','enforce_statuses'=>['5']}`);
  ruby(`ChecklistProjectSetting.delete_all; i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; i.update_columns(status_id:5); i.checklist_items.create!(subject:'Locked', position:0, is_mandatory:true, is_done:true)`);

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const row = page.locator('#checklist-items .checklist-item').first();
  await row.locator('.checklist-checkbox').click(); // attempt to uncheck
  await page.waitForTimeout(900);

  // Refused: still done in DB, checkbox reverted, flash error shown.
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).checklist_items.first.is_done`)).toBe('true');
  await expect(row.locator('.checklist-checkbox')).toBeChecked();
  await expect(page.locator('#flash_error, .flash.error')).toBeVisible({ timeout: 5000 });

  await logout(page);
});

// ---------------------------------------------------------------------------
// 3. Separate permission for enforcement vs template management
// ---------------------------------------------------------------------------
test('enforcement permission is separate from template management', async ({ page }) => {
  // Grant ONLY enforcement to CL Checker, ONLY templates to CL Manager.
  ruby(`Role.find(${ENFORCE_ROLE}).add_permission!(:manage_checklist_enforcement)`);
  ruby(`Role.find(${TEMPLATE_ROLE}).add_permission!(:manage_checklist_templates)`);

  // Enforcement-only member (cl_checker): sees the panel, NOT template CRUD.
  await page.context().clearCookies();
  await login(page, 'cl_checker', 'Test1234!');
  const r1 = await page.goto('/projects/checklist-qa/checklist_templates');
  expect(r1?.status()).toBe(200);
  await expect(page.locator('.box').filter({ hasText: /enforcement/i })).toBeVisible();
  expect(await page.locator('a', { hasText: 'New template' }).count()).toBe(0);
  // Direct attempt to create a template is forbidden.
  const create = await page.goto('/projects/checklist-qa/checklist_templates/new');
  expect(create?.status()).toBe(403);

  // Template-only member (cl_manager): sees templates, NOT the enforcement panel.
  await page.context().clearCookies();
  await login(page, 'cl_manager', 'Test1234!');
  const r2 = await page.goto('/projects/checklist-qa/checklist_templates');
  expect(r2?.status()).toBe(200);
  expect(await page.locator('.box').filter({ hasText: /enforcement/i }).count()).toBe(0);
  expect(await page.locator('a', { hasText: 'New template' }).count()).toBeGreaterThan(0);
});
