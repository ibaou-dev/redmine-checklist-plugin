/**
 * Phase 2 E2E Spec: Activity feed + Global search (hardened).
 *
 * These assertions deliberately check HTTP 200 and that the match appears in the
 * RESULTS region — not just anywhere in the page body. A Rails 500 error page
 * echoes the `q` request parameter, so a naive `body contains subject` check
 * passes even when search is crashing (this previously masked a real
 * PG::AmbiguousColumn 500 in global search).
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import {
  resetChecklist,
  seedChecklist,
  enablePhase2Settings,
  restoreDefaultSettings,
} from './reset';

test.beforeEach(() => {
  enablePhase2Settings();
  resetChecklist(ISSUE_ID);
});

test.afterAll(() => {
  resetChecklist(ISSUE_ID);
  restoreDefaultSettings();
});

// ---------------------------------------------------------------------------
// 1. Global search finds a checklist item by subject — and does NOT 500.
// ---------------------------------------------------------------------------
test('search: all-types global search finds a checklist item (HTTP 200, in results)', async ({ page }) => {
  const unique = `searchword${Date.now()}`;
  seedChecklist(ISSUE_ID, [unique]);
  await login(page, 'admin', 'Test1234!');

  const resp = await page.goto(`/search?q=${encodeURIComponent(unique)}&all_words=1&submit=Search`);
  expect(resp?.status(), 'global search must not 500').toBe(200);
  await page.waitForLoadState('networkidle');

  // Match must be inside the search-results region, with a link to the issue.
  const results = page.locator('#search-results');
  await expect(results).toContainText(unique);
  await expect(results.locator(`a[href*="/issues/${ISSUE_ID}"]`).first()).toBeVisible();
  await logout(page);
});

// ---------------------------------------------------------------------------
// 2. Search restricted to the checklist type works too.
// ---------------------------------------------------------------------------
test('search: checklist-typed search finds the item (HTTP 200)', async ({ page }) => {
  const unique = `typedword${Date.now()}`;
  seedChecklist(ISSUE_ID, [unique]);
  await login(page, 'admin', 'Test1234!');

  const resp = await page.goto(`/search?q=${encodeURIComponent(unique)}&checklist_items=1&all_words=1&submit=Search`);
  expect(resp?.status(), 'checklist-typed search must not 500').toBe(200);
  await expect(page.locator('#search-results')).toContainText(unique);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 3. A view-only user can find checklist items via search (permission gate).
// ---------------------------------------------------------------------------
test('search: cl_viewer (view_checklists) can find checklist items', async ({ page }) => {
  const unique = `viewerword${Date.now()}`;
  seedChecklist(ISSUE_ID, [unique]);
  await login(page, 'cl_viewer', 'Test1234!');

  const resp = await page.goto(`/search?q=${encodeURIComponent(unique)}&all_words=1&submit=Search`);
  expect(resp?.status()).toBe(200);
  await expect(page.locator('#search-results')).toContainText(unique);
  await logout(page);
});

// ---------------------------------------------------------------------------
// 4. Activity feed actually shows a checklist event (not just "page loads").
// ---------------------------------------------------------------------------
test('activity: checklist event appears on the activity page when enabled', async ({ page }) => {
  const unique = `activityword${Date.now()}`;
  seedChecklist(ISSUE_ID, [unique]);
  await login(page, 'admin', 'Test1234!');

  const resp = await page.goto('/activity?show_checklists=1');
  expect(resp?.status()).toBe(200);
  await page.waitForLoadState('networkidle');

  // The activity filter must offer the checklist type, and the event must show.
  await expect(page.locator('input[name="show_checklists"]')).toHaveCount(1);
  await expect(page.locator('#content')).toContainText(unique);
  await logout(page);
});
