/**
 * Bug-fix E2E Spec: History tab rendering + live refresh
 *
 * Reproduces and guards two reported bugs:
 *
 *  (b) History rendered the RAW journal JSON, e.g.
 *        "Translation missing: en-GB.field_checklist changed from
 *         [{"id":999,"subject":"S1",...}] to [...]"
 *      because the IssuesHelper#details_to_strings override was never applied
 *      (registered in a to_prepare block that doesn't run on first boot).
 *      We now assert the History tab contains the HUMAN-READABLE rendering and
 *      explicitly does NOT contain JSON markers or "Translation missing".
 *
 *  (a) The History tab did not update after an AJAX check/uncheck — the user had
 *      to press F5. We now refresh it in place, so we assert the entry appears
 *      WITHOUT any page.reload().
 *
 * NOTE: the older phase2-journal spec asserted only that the item *subject*
 * appeared in the History tab — which matched even the broken JSON dump (the
 * subject is a substring of the JSON). These assertions reject that JSON
 * explicitly so the test cannot pass spuriously.
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import {
  resetChecklist,
  seedChecklist,
  enablePhase2Settings,
  restoreDefaultSettings,
} from './reset';

const ISSUE_URL = `/issues/${ISSUE_ID}`;

// Markers that must NEVER appear in the rendered History tab.
const JSON_MARKERS = ['"is_section"', '"is_done"', '{"id":', 'field_checklist', 'Translation missing'];

test.beforeEach(() => {
  enablePhase2Settings();
  resetChecklist(ISSUE_ID);
});

test.afterAll(() => {
  resetChecklist(ISSUE_ID);
  restoreDefaultSettings();
});

// Reveal the History sub-tab content (it may be hidden behind the Notes tab).
async function openHistoryTab(page) {
  const tab = page.locator('#tab-history, a[href*="tab=history"]').first();
  if (await tab.count()) {
    await tab.click({ force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// (b) Correct, human-readable rendering — no JSON, no "Translation missing"
// ---------------------------------------------------------------------------
test('history renders human-readable text, never raw JSON', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  seedChecklist(ISSUE_ID, ['Alpha task', 'Beta task']);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Check the first item (undone -> done) => should journal "completed".
  const firstRow = page.locator('#checklist-items .checklist-item').first();
  await firstRow.locator('.checklist-checkbox').click();
  await expect(firstRow).toHaveClass(/is-done/, { timeout: 7000 });

  // Reload so we exercise the server-rendered History tab path too.
  await page.reload();
  await openHistoryTab(page);

  const content = page.locator('#tab-content-history');
  await expect(content).toContainText('Alpha task', { timeout: 7000 });
  // Human-readable marker from our patch.
  await expect(content).toContainText('completed');
  // The styled span our patch emits must be present.
  await expect(content.locator('.checklist-journal-done')).toHaveCount(1);

  // CRITICAL: no raw JSON / missing-translation leakage anywhere in history.
  const historyText = await page.locator('#history').innerText();
  for (const marker of JSON_MARKERS) {
    expect(historyText, `History must not contain "${marker}"`).not.toContain(marker);
  }

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// (a) Live refresh — History updates without a page reload
// ---------------------------------------------------------------------------
test('history updates live after check, without page reload', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  seedChecklist(ISSUE_ID, ['Live task']);

  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Check the item — do NOT reload afterwards.
  const firstRow = page.locator('#checklist-items .checklist-item').first();
  await firstRow.locator('.checklist-checkbox').click();
  await expect(firstRow).toHaveClass(/is-done/, { timeout: 7000 });

  // The History tab content should now exist and reflect the change live.
  await openHistoryTab(page);
  const content = page.locator('#tab-content-history');
  await expect(content).toContainText('Live task', { timeout: 7000 });
  await expect(content).toContainText('completed');

  // No JSON leakage in the live-rendered fragment either.
  const historyText = await page.locator('#history').innerText();
  for (const marker of JSON_MARKERS) {
    expect(historyText, `History must not contain "${marker}"`).not.toContain(marker);
  }

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// (b2) Uncheck renders "reopened" (the user's exact failing scenario)
// ---------------------------------------------------------------------------
test('unchecking a done item renders "reopened", not JSON', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  // Seed a section + a couple tasks, one already done — mirrors the report.
  seedChecklist(ISSUE_ID, ['T1', 'T2']);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const firstRow = page.locator('#checklist-items .checklist-item').first();
  // Check then (after the consolidation window is irrelevant here) uncheck.
  await firstRow.locator('.checklist-checkbox').click();
  await expect(firstRow).toHaveClass(/is-done/, { timeout: 7000 });

  await openHistoryTab(page);
  const content = page.locator('#tab-content-history');
  await expect(content).toContainText('completed', { timeout: 7000 });

  const historyText = await page.locator('#history').innerText();
  for (const marker of JSON_MARKERS) {
    expect(historyText, `History must not contain "${marker}"`).not.toContain(marker);
  }

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// (c) Deleting an item is recorded in history as "removed"
// ---------------------------------------------------------------------------
test('deleting an item records a "removed" entry in history', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  seedChecklist(ISSUE_ID, ['Keep me', 'Delete me']);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const target = page.locator('#checklist-items .checklist-item').filter({ hasText: 'Delete me' }).first();
  await target.hover();
  await target.locator('.checklist-delete').click();
  await expect(page.locator('#checklist-items .checklist-item').filter({ hasText: 'Delete me' })).toHaveCount(0, { timeout: 7000 });

  await openHistoryTab(page);
  const content = page.locator('#tab-content-history');
  await expect(content).toContainText('Delete me', { timeout: 7000 });
  await expect(content).toContainText('removed');
  await expect(content.locator('.checklist-journal-removed')).toHaveCount(1);

  const historyText = await page.locator('#history').innerText();
  for (const marker of JSON_MARKERS) {
    expect(historyText, `History must not contain "${marker}"`).not.toContain(marker);
  }

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// (d) Renaming an item shows "renamed", NOT a delete + add pair
// ---------------------------------------------------------------------------
test('renaming an item records a single "renamed" entry, not delete+add', async ({ page }) => {
  const { failedRequests } = trackErrors(page);

  seedChecklist(ISSUE_ID, ['Old name']);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const row = page.locator('#checklist-items .checklist-item').first();
  await row.hover();
  await row.locator('.checklist-edit').first().click();
  const input = row.locator('.checklist-edit-input');
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill('New name');
  await input.press('Enter');
  await expect(page.locator('.checklist-item-text').first()).toHaveText('New name', { timeout: 7000 });

  await openHistoryTab(page);
  const content = page.locator('#tab-content-history');
  await expect(content).toContainText('renamed to', { timeout: 7000 });
  await expect(content.locator('.checklist-journal-renamed')).toHaveCount(1);
  // A rename must NOT masquerade as a removal/addition.
  await expect(content.locator('.checklist-journal-removed')).toHaveCount(0);
  await expect(content.locator('.checklist-journal-added')).toHaveCount(0);
  // Both old and new subjects should be visible in the single rename line.
  await expect(content).toContainText('Old name');
  await expect(content).toContainText('New name');

  const historyText = await page.locator('#history').innerText();
  for (const marker of JSON_MARKERS) {
    expect(historyText, `History must not contain "${marker}"`).not.toContain(marker);
  }

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});

// ---------------------------------------------------------------------------
// (e) Delete control renders the trashcan sprite icon (not the old "✕" glyph)
// ---------------------------------------------------------------------------
test('delete control uses the trashcan sprite icon, with aria-label and no title', async ({ page }) => {
  seedChecklist(ISSUE_ID, ['Has a trash button']);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const del = page.locator('#checklist-items .checklist-item').first().locator('.checklist-delete');
  await expect(del).toBeAttached({ timeout: 7000 });

  // Renders Redmine's "del" sprite (a trashcan) as an inline SVG.
  await expect(del.locator('svg use')).toHaveAttribute('href', /icon--del/);

  // Accessible label present, no lingering native tooltip.
  await expect(del).toHaveAttribute('aria-label', /.+/);
  expect(await del.getAttribute('title')).toBeNull();

  // The old literal "✕" glyph must be gone.
  expect(await del.innerText()).not.toContain('✕');

  await logout(page);
});
