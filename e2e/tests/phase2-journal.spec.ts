/**
 * Phase 2 E2E Spec: Journal / History tab
 *
 * Covers:
 *  1. History: with save_log ON, checking an item produces a journal entry in
 *     the issue History tab naming the item subject.
 *  2. Consolidation: check then uncheck the same item (same user, within 1 min)
 *     produces NO net journal entry (round-trip collapses).
 *  3. No spurious journals: done_ratio recalculation does NOT produce extra
 *     journal entries.
 *
 * Assertions are against real user-visible HTML in the History tab.
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import {
  resetChecklist,
  seedChecklist,
  enablePhase2Settings,
  restoreDefaultSettings,
  getChecklistJournalCount,
} from './reset';

const ISSUE_URL = `/issues/${ISSUE_ID}`;

test.beforeEach(() => {
  enablePhase2Settings();
  resetChecklist(ISSUE_ID);
});

test.afterAll(() => {
  resetChecklist(ISSUE_ID);
  restoreDefaultSettings();
});

// ---------------------------------------------------------------------------
// 1. History: checking an item creates a journal entry in the History tab
// ---------------------------------------------------------------------------
test('history: checking item creates journal entry in History tab', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  seedChecklist(ISSUE_ID, ['Important task']);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Check the item
  const checkbox = page.locator('#checklist-items .checklist-item').first().locator('.checklist-checkbox');
  await checkbox.click();
  await expect(page.locator('#checklist-items .checklist-item').first()).toHaveClass(/is-done/, { timeout: 7000 });

  // Reload the issue page to see the History tab updated
  await page.reload();

  // Navigate to History tab — Redmine shows it as a tab with href="#history"
  // The history content is in #history div; click the History tab if present.
  const historyTab = page.locator('a[href="#history"]');
  if (await historyTab.count() > 0) {
    await historyTab.click();
  }

  // The journal detail list should contain our item name.
  // Our patch renders the item subject in a <strong> + plain text format.
  const historySection = page.locator('#history');
  await expect(historySection).toBeVisible({ timeout: 5000 });

  // Look for the item text "Important task" inside the journal details
  const journalDetail = historySection.locator('.journal-details li').filter({ hasText: 'Important task' });
  await expect(journalDetail).toBeVisible({ timeout: 7000 });

  // Guard against the JSON-leak regression: the subject is a substring of the
  // raw journal JSON, so "hasText" alone could match a broken dump. Assert the
  // history contains NO JSON markers / missing-translation text.
  const histText1 = await historySection.innerText();
  for (const m of ['"is_section"', '{"id":', 'field_checklist', 'Translation missing']) {
    expect(histText1, `History must not contain "${m}"`).not.toContain(m);
  }

  // Also assert via rails runner that a journal was created
  const journalCount = getChecklistJournalCount(ISSUE_ID);
  expect(journalCount).toBeGreaterThanOrEqual(1);

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 2. Adding an item creates a journal entry
// ---------------------------------------------------------------------------
test('history: adding an item creates journal entry with item subject', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Add an item via the UI
  const input = page.locator('.checklist-new-item-input');
  await input.fill('New journal item');
  await page.locator('#checklist-add-item-btn').click();

  // Wait for item to appear
  await expect(page.locator('#checklist-items .checklist-item').filter({ hasText: 'New journal item' })).toBeVisible({ timeout: 7000 });

  // Reload to see the History tab
  await page.reload();

  const historyTab = page.locator('a[href="#history"]');
  if (await historyTab.count() > 0) {
    await historyTab.click();
  }

  const historySection = page.locator('#history');
  await expect(historySection).toBeVisible({ timeout: 5000 });

  // The journal entry should mention "New journal item" (as an added item)
  const journalDetail = historySection.locator('.journal-details li').filter({ hasText: 'New journal item' });
  await expect(journalDetail).toBeVisible({ timeout: 7000 });

  // Guard against the JSON-leak regression (see note in test 1).
  const histText2 = await historySection.innerText();
  for (const m of ['"is_section"', '{"id":', 'field_checklist', 'Translation missing']) {
    expect(histText2, `History must not contain "${m}"`).not.toContain(m);
  }

  const journalCount = getChecklistJournalCount(ISSUE_ID);
  expect(journalCount).toBeGreaterThanOrEqual(1);

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 3. Consolidation: check then uncheck quickly → no net journal entry
// ---------------------------------------------------------------------------
test('consolidation: check then uncheck quickly produces no net journal entry', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  seedChecklist(ISSUE_ID, ['Round-trip task']);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const journalsBefore = getChecklistJournalCount(ISSUE_ID);

  // Check the item
  const firstRow = page.locator('#checklist-items .checklist-item').first();
  const checkbox = firstRow.locator('.checklist-checkbox');
  await checkbox.click();
  await expect(firstRow).toHaveClass(/is-done/, { timeout: 7000 });

  // Immediately uncheck it (within the consolidation window)
  await checkbox.click();
  await expect(firstRow).not.toHaveClass(/is-done/, { timeout: 7000 });

  // After the round-trip, the net journal count should NOT have grown
  // (consolidation collapses check+uncheck into nothing).
  // Give a small wait for any async journal ops to complete.
  await page.waitForTimeout(500);

  const journalsAfter = getChecklistJournalCount(ISSUE_ID);

  // The net change should be 0 or at most 1 (if consolidation merged rather than destroyed).
  // A net-zero round-trip MUST NOT produce 2 separate journal entries.
  expect(journalsAfter - journalsBefore).toBeLessThanOrEqual(0);

  // Reload and verify no checklist entry appears in History
  await page.reload();
  const historyTab = page.locator('a[href="#history"]');
  if (await historyTab.count() > 0) {
    await historyTab.click();
  }

  // There should be NO visible checklist journal detail for "Round-trip task"
  const historySection = page.locator('#history');
  const roundTripDetail = historySection.locator('.journal-details li').filter({ hasText: 'Round-trip task' });
  await expect(roundTripDetail).toHaveCount(0);

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 4. save_log OFF: no journal entry created
// ---------------------------------------------------------------------------
test('save_log OFF: no journal entry created when save_log is disabled', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  // Disable save_log
  const { execSync } = require('node:child_process');
  const DC = 'docker compose -f docker-compose.yml -f docker-compose.local.yml';
  const DEVC = '/home/ibaou/workspace/redmine-devcontainer';
  execSync(
    `${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(
      "Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','save_log'=>'0','affect_done_ratio'=>'1'}"
    )}`,
    { cwd: DEVC, stdio: 'ignore' }
  );

  seedChecklist(ISSUE_ID, ['No log task']);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const journalsBefore = getChecklistJournalCount(ISSUE_ID);

  const checkbox = page.locator('#checklist-items .checklist-item').first().locator('.checklist-checkbox');
  await checkbox.click();
  await expect(page.locator('#checklist-items .checklist-item').first()).toHaveClass(/is-done/, { timeout: 7000 });

  await page.waitForTimeout(500);
  const journalsAfter = getChecklistJournalCount(ISSUE_ID);

  // No new journal should be created
  expect(journalsAfter).toEqual(journalsBefore);

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);

  // Re-enable
  enablePhase2Settings();
});
