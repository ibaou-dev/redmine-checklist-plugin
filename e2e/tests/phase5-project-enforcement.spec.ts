/**
 * Per-project enforcement override (v0.5.0)
 *
 * Global enforcement is the default; each project may override it and the
 * project's choice wins:
 *   1. A project set to "disabled" is NOT blocked even when global enforces.
 *   2. A project set to "enabled" uses ITS OWN status list (not global's).
 *   3. The enforcement panel on the project page persists the override.
 *
 * Verified through the real issue edit form + the DB.
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

const CLOSED = '5';
const REJECTED = '6';
const PROJ = 'checklist-qa';

function clearOverride() {
  ruby(`ChecklistProjectSetting.where(project_id: Project.find('${PROJ}').id).delete_all`);
}
function setOverride(mode: string, statusIds: string[] = []) {
  clearOverride();
  ruby(`ChecklistProjectSetting.create!(project_id: Project.find('${PROJ}').id, enforce_mode: '${mode}', enforce_statuses: ${JSON.stringify(JSON.stringify(statusIds))})`);
}
function setStatus(page, v: string) {
  return page.locator('#issue_status_id').evaluate((el: HTMLSelectElement, val: string) => {
    el.value = val; el.dispatchEvent(new Event('change', { bubbles: true }));
  }, v);
}

test.beforeEach(() => {
  // Global enforcement ON for Closed; a mandatory incomplete item on the issue.
  ruby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','enforce_mandatory'=>'1','enforce_statuses'=>['${CLOSED}']}`);
  clearOverride();
  ruby(`i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; i.update_columns(status_id:1); i.checklist_items.create!(subject:'Mand', position:0, is_mandatory:true)`);
});

test.afterAll(() => {
  clearOverride();
  ruby(`i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; i.update_columns(status_id:1, done_ratio:0)`);
  ruby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1'}`);
});

// ---------------------------------------------------------------------------
// 1. Disabled project wins over a global enforce
// ---------------------------------------------------------------------------
test('project "disabled" override lets the blocked transition through despite global', async ({ page }) => {
  setOverride('disabled');
  await login(page, 'admin', 'Test1234!');

  await page.goto(`/issues/${ISSUE_ID}/edit`);
  await setStatus(page, CLOSED);
  await page.locator('input[name="commit"], #issue-form input[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');

  // Allowed — status changed, no mandatory error.
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).status_id`)).toBe(CLOSED);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 2. Enabled project uses its OWN statuses
// ---------------------------------------------------------------------------
test('project "enabled" override enforces its own statuses, not the global ones', async ({ page }) => {
  setOverride('enabled', [REJECTED]); // project guards Rejected, NOT Closed
  await login(page, 'admin', 'Test1234!');

  // Moving to Closed (global's status, but not the project's) is ALLOWED.
  await page.goto(`/issues/${ISSUE_ID}/edit`);
  await setStatus(page, CLOSED);
  await page.locator('input[name="commit"], #issue-form input[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).status_id`)).toBe(CLOSED);

  // Reset, then moving to Rejected (the project's guarded status) is BLOCKED.
  ruby(`Issue.find(${ISSUE_ID}).update_columns(status_id:1)`);
  await page.goto(`/issues/${ISSUE_ID}/edit`);
  await setStatus(page, REJECTED);
  await page.locator('input[name="commit"], #issue-form input[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#errorExplanation')).toContainText(/mandatory/i, { timeout: 7000 });
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).status_id`)).toBe('1');

  await logout(page);
});

// ---------------------------------------------------------------------------
// 3. The enforcement panel persists the override
// ---------------------------------------------------------------------------
test('project enforcement panel saves the chosen mode', async ({ page }) => {
  clearOverride();
  await login(page, 'admin', 'Test1234!');

  await page.goto(`/projects/${PROJ}/checklist_templates`);
  const box = page.locator('.box').filter({ hasText: /enforcement/i });
  await expect(box).toBeVisible({ timeout: 7000 });

  await box.locator('input[name="checklist_project_setting[enforce_mode]"][value="disabled"]').check();
  // Scope the submit to the enforcement form (the layout also has a hidden
  // Prism search-submit button that would otherwise match first).
  await box.locator('input[name="commit"], input[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');

  expect(rubyOut(`print ChecklistProjectSetting.find_by(project_id: Project.find('${PROJ}').id)&.enforce_mode`)).toBe('disabled');
  // Reloaded page shows the disabled radio checked.
  await page.goto(`/projects/${PROJ}/checklist_templates`);
  await expect(page.locator('input[name="checklist_project_setting[enforce_mode]"][value="disabled"]')).toBeChecked();

  await logout(page);
});
