/**
 * Phase 2 E2E Spec: done_ratio integration
 *
 * Covers:
 *  1. With affect_done_ratio ON + issue_done_ratio='issue_field': checking
 *     items correctly updates the issue %Done field.
 *  2. Formula verification: 1/4 done → 20%, 2/4 done → 50%.
 *  3. With affect_done_ratio OFF: done_ratio is unchanged.
 *  4. No spurious journals: done_ratio recalculation does NOT produce extra
 *     checklist journal entries.
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import {
  resetChecklist,
  seedChecklist,
  enablePhase2Settings,
  restoreDefaultSettings,
  getIssueDoneRatio,
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
// 1. done_ratio ON: checking items updates %Done
// ---------------------------------------------------------------------------
test('done_ratio: 1/4 tasks checked → done_ratio 20, 2/4 → 50', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  seedChecklist(ISSUE_ID, ['Task 1', 'Task 2', 'Task 3', 'Task 4']);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Verify initial done_ratio is 0
  expect(getIssueDoneRatio(ISSUE_ID)).toBe(0);

  // Check first item
  const firstRow = page.locator('#checklist-items .checklist-item').first();
  await firstRow.locator('.checklist-checkbox').click();
  await expect(firstRow).toHaveClass(/is-done/, { timeout: 7000 });

  // Give a moment for the AJAX/done_ratio update to complete
  await page.waitForTimeout(500);

  // Verify via rails runner: 1/4 = (1*10)/4*10 = 20
  const ratio1 = getIssueDoneRatio(ISSUE_ID);
  expect(ratio1).toBe(20);

  // Check second item
  const secondRow = page.locator('#checklist-items .checklist-item').nth(1);
  await secondRow.locator('.checklist-checkbox').click();
  await expect(secondRow).toHaveClass(/is-done/, { timeout: 7000 });

  await page.waitForTimeout(500);

  // Verify: 2/4 = (2*10)/4*10 = 50
  const ratio2 = getIssueDoneRatio(ISSUE_ID);
  expect(ratio2).toBe(50);

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 1b. Live refresh: the issue "% Done" field updates WITHOUT a page reload
// ---------------------------------------------------------------------------
test('done_ratio: issue %Done field updates live (no reload) when an item is checked', async ({ page }) => {
  seedChecklist(ISSUE_ID, ['Task 1', 'Task 2', 'Task 3', 'Task 4']);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Core "% Done" cell on the issue show page (div.attribute.progress > .value).
  const doneCell = page.locator('.attribute.progress .value');
  await expect(doneCell).toContainText('0%');

  // Check one item → 1/4 = 20%. The cell must update in place (no reload).
  const firstRow = page.locator('#checklist-items .checklist-item').first();
  await firstRow.locator('.checklist-checkbox').click();
  await expect(firstRow).toHaveClass(/is-done/, { timeout: 7000 });
  await expect(doneCell).toContainText('20%', { timeout: 7000 });

  // Uncheck → back to 0%, still live.
  await firstRow.locator('.checklist-checkbox').click();
  await expect(doneCell).toContainText('0%', { timeout: 7000 });

  await logout(page);
});

// ---------------------------------------------------------------------------
// 2. done_ratio OFF: ratio unchanged when setting is disabled
// ---------------------------------------------------------------------------
test('done_ratio OFF: ratio unchanged when affect_done_ratio is disabled', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  // Disable affect_done_ratio
  const { execSync } = require('node:child_process');
  const DC = 'docker compose -f docker-compose.yml -f docker-compose.local.yml';
  const DEVC = '/home/ibaou/workspace/redmine-devcontainer';
  execSync(
    `${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(
      "Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','save_log'=>'1','affect_done_ratio'=>'0'}"
    )}`,
    { cwd: DEVC, stdio: 'ignore' }
  );

  // Reset issue done_ratio to 0
  execSync(
    `${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(
      'Issue.where(id: 9).update_all(done_ratio: 0)'
    )}`,
    { cwd: DEVC, stdio: 'ignore' }
  );

  seedChecklist(ISSUE_ID, ['Task A', 'Task B']);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const ratioBefore = getIssueDoneRatio(ISSUE_ID);
  expect(ratioBefore).toBe(0);

  // Check an item
  const firstRow = page.locator('#checklist-items .checklist-item').first();
  await firstRow.locator('.checklist-checkbox').click();
  await expect(firstRow).toHaveClass(/is-done/, { timeout: 7000 });
  await page.waitForTimeout(500);

  // done_ratio must still be 0 (affect_done_ratio is OFF)
  const ratioAfter = getIssueDoneRatio(ISSUE_ID);
  expect(ratioAfter).toBe(0);

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);

  // Re-enable
  enablePhase2Settings();
});

// ---------------------------------------------------------------------------
// 3. No spurious journals from done_ratio recalculation
// ---------------------------------------------------------------------------
test('done_ratio recalculation does NOT create extra checklist journal entries', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  seedChecklist(ISSUE_ID, ['Ratio task 1', 'Ratio task 2', 'Ratio task 3']);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Check all 3 items one by one
  const rows = page.locator('#checklist-items .checklist-item');

  await rows.nth(0).locator('.checklist-checkbox').click();
  await expect(rows.nth(0)).toHaveClass(/is-done/, { timeout: 7000 });
  await page.waitForTimeout(300);

  await rows.nth(1).locator('.checklist-checkbox').click();
  await expect(rows.nth(1)).toHaveClass(/is-done/, { timeout: 7000 });
  await page.waitForTimeout(300);

  await rows.nth(2).locator('.checklist-checkbox').click();
  await expect(rows.nth(2)).toHaveClass(/is-done/, { timeout: 7000 });
  await page.waitForTimeout(500);

  // Verify done_ratio = 100
  const ratio = getIssueDoneRatio(ISSUE_ID);
  expect(ratio).toBe(100);

  // Each check of a task triggers done_ratio recalculation.
  // The recalculation uses Issue.where(id:).update_all which fires NO callbacks.
  // So there should be AT MOST 3 checklist journal entries (one per check,
  // possibly consolidated if within 1 min), NOT 6 (3 check + 3 ratio journals).
  const journalCount = getChecklistJournalCount(ISSUE_ID);
  // After consolidation within 1 min by same user, may be 1 consolidated entry
  expect(journalCount).toBeLessThanOrEqual(3);

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});
