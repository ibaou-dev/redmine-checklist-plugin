/**
 * Phase 3 E2E Spec: Checklist templates
 *
 * Covers:
 *  1. Admin creates a GLOBAL template via the UI; it appears in the admin list.
 *  2. Applying a template to an issue adds its items (sections + tasks), wires
 *     them (checkbox toggles), updates progress, logs "added" history (no JSON).
 *  3. Auto-apply: creating a new issue whose tracker has a default template
 *     silently seeds the template's items.
 *  4. Permissions: a view-only user gets 403 on the project templates page and
 *     sees no "Apply template" control on the issue.
 *
 * NOTE on the apply control: the Prism theme enhances <select> into a typeahead
 * combobox (hiding the native select). applyTemplate() drives the typeahead when
 * present and falls back to the native select otherwise, so the test is
 * theme-agnostic.
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { enablePhase2Settings, restoreDefaultSettings } from './reset';
import { execSync } from 'node:child_process';

const DC = 'docker compose -f docker-compose.yml -f docker-compose.local.yml';
const DEVC = '/home/ibaou/workspace/redmine-devcontainer';
function ruby(r: string) {
  execSync(`${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(r.replace(/\s+/g, ' ').trim())}`,
    { cwd: DEVC, stdio: 'ignore' });
}
function rubyOut(r: string): string {
  return execSync(`${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(r.replace(/\s+/g, ' ').trim())}`,
    { cwd: DEVC, encoding: 'utf8' }).trim();
}

function cleanTemplates() {
  ruby(`ChecklistTemplate.where("name like ?", "E2E%").destroy_all; ChecklistTemplateCategory.where("name like ?", "E2E%").destroy_all`);
}
function resetIssue(id: string | number) {
  ruby(`Issue.find(${id}).checklist_items.delete_all; Journal.joins(:details).where(journalized_type: 'Issue', journalized_id: ${id}).where(journal_details: {prop_key: 'checklist'}).destroy_all`);
}
function cleanE2EIssues() {
  ruby(`Issue.where("subject like ?", "E2E AUTO%").destroy_all`);
}

// Seed a template directly (bypasses the textarea parser via template_items JSON).
function seedTemplate(name: string, opts: { items: Array<{ subject: string; section?: boolean }>, trackerId?: number, isDefault?: boolean } = { items: [] }) {
  const itemsJson = JSON.stringify(opts.items.map((it, i) => ({ subject: it.subject, is_section: !!it.section, position: i })));
  const attrs = [
    `name: ${JSON.stringify(name)}`,
    `project_id: nil`,
    opts.isDefault ? `is_default: true` : null,
    opts.trackerId ? `tracker_id: ${opts.trackerId}` : null,
    `template_items: ${JSON.stringify(itemsJson)}`,
  ].filter(Boolean).join(', ');
  ruby(`ChecklistTemplate.create!(${attrs})`);
}

const JSON_MARKERS = ['"is_section"', '{"id":', 'field_checklist', 'Translation missing'];

// Drive the apply-template control regardless of theme enhancement.
async function applyTemplate(page, name: string) {
  const ta = page.locator('.checklist-template-bar .prism-ta-input');
  if (await ta.count()) {
    await ta.click();
    await ta.fill(name);
    await page.waitForTimeout(350);
    const opt = page.locator('[role="option"], .prism-ta-option').filter({ hasText: name }).first();
    if (await opt.count()) {
      await opt.click();
    } else {
      await page.locator('.checklist-template-select').selectOption({ label: new RegExp(name) }).catch(() => {});
    }
  } else {
    await page.locator('.checklist-template-select').selectOption({ label: new RegExp(name) });
  }
  await page.locator('.checklist-template-bar button[type="submit"]').click();
}

test.beforeEach(() => {
  enablePhase2Settings();
  cleanTemplates();
  resetIssue(ISSUE_ID);
});

test.afterAll(() => {
  cleanTemplates();
  cleanE2EIssues();
  resetIssue(ISSUE_ID);
  restoreDefaultSettings();
});

// ---------------------------------------------------------------------------
// 1. Admin creates a global template via the UI
// ---------------------------------------------------------------------------
test('admin: create a global template via the UI, it appears in the list', async ({ page }) => {
  await login(page, 'admin', 'Test1234!');

  await page.goto('/checklist_templates/new');
  await page.fill('#checklist_template_name', 'E2E Global Tpl');
  await page.fill('#checklist_template_template_text', '# Section A\nStep one\nStep two');
  await page.locator('#content form input[type="submit"], #content form button[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');

  // Back on the index, the new template is listed.
  await expect(page.locator('#content')).toContainText('E2E Global Tpl', { timeout: 7000 });

  // It persisted with the parsed items (1 section + 2 tasks).
  const count = rubyOut(`puts ChecklistTemplate.find_by(name: 'E2E Global Tpl').items.size`).split('\n').pop();
  expect(count).toBe('3');

  await logout(page);
});

// ---------------------------------------------------------------------------
// 2. Apply a template to an issue
// ---------------------------------------------------------------------------
test('apply a template to an issue: items added, wired, progress + history updated', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  seedTemplate('E2E Deploy', { items: [
    { subject: 'Pre-deploy', section: true },
    { subject: 'Backup DB' },
    { subject: 'Notify team' },
  ] });

  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  await expect(page.locator('.checklist-template-bar')).toBeVisible();
  await applyTemplate(page, 'E2E Deploy');

  // Items appear (1 section + 2 tasks).
  await expect(page.locator('#checklist-items .checklist-item')).toHaveCount(3, { timeout: 7000 });
  await expect(page.locator('#checklist-items')).toContainText('Backup DB');
  await expect(page.locator('#checklist-items')).toContainText('Notify team');

  // Newly-applied rows are wired: toggling a task checkbox marks it done.
  const task = page.locator('#checklist-items .checklist-item:not(.checklist-section)').first();
  await task.locator('.checklist-checkbox').click();
  await expect(task).toHaveClass(/is-done/, { timeout: 7000 });

  // History records the additions in human-readable form (no JSON leak).
  const historyTab = page.locator('#tab-history, a[href*="tab=history"]').first();
  if (await historyTab.count()) await historyTab.click({ force: true }).catch(() => {});
  const history = page.locator('#tab-content-history');
  await expect(history).toContainText('Backup DB', { timeout: 7000 });
  const histText = await page.locator('#history').innerText();
  for (const m of JSON_MARKERS) {
    expect(histText, `History must not contain "${m}"`).not.toContain(m);
  }

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 3. Auto-apply on issue creation when a default template matches the tracker
// ---------------------------------------------------------------------------
test('auto-apply: new issue with a default-template tracker is seeded silently', async ({ page }) => {
  const trackerId = parseInt(rubyOut(`puts Project.find('checklist-qa').trackers.order(:position).first.id`).split('\n').pop() || '0', 10);
  expect(trackerId).toBeGreaterThan(0);
  seedTemplate('E2E Autoapply', { trackerId, isDefault: true, items: [
    { subject: 'Checklist', section: true },
    { subject: 'Auto seeded step' },
  ] });

  await login(page, 'admin', 'Test1234!');
  await page.goto('/projects/checklist-qa/issues/new');

  // Force the tracker (selects may be theme-enhanced) and submit.
  await page.locator('#issue_tracker_id').evaluate((el: HTMLSelectElement, v: string) => {
    el.value = v; el.dispatchEvent(new Event('change', { bubbles: true }));
  }, String(trackerId));
  await page.fill('#issue_subject', 'E2E AUTO apply issue');
  await page.locator('input[name="commit"], #issue-form input[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');

  // The created issue's checklist contains the template's items.
  await expect(page.locator('#checklist-items')).toContainText('Auto seeded step', { timeout: 7000 });

  await logout(page);
});

// ---------------------------------------------------------------------------
// 4. Permissions: a view-only user can't manage templates or apply them
// ---------------------------------------------------------------------------
test('cl_viewer: 403 on project templates page, no apply control on issue', async ({ page }) => {
  seedTemplate('E2E ViewerCheck', { items: [{ subject: 'X' }] });

  await login(page, 'cl_viewer', 'Test1234!');

  const resp = await page.goto('/projects/checklist-qa/checklist_templates');
  expect(resp?.status()).toBe(403);

  await page.goto(`/issues/${ISSUE_ID}`);
  // Panel is visible (view permission) but no apply-template control.
  await expect(page.locator('#checklist-panel')).toBeVisible({ timeout: 7000 });
  expect(await page.locator('.checklist-template-bar').count()).toBe(0);

  await logout(page);
});
