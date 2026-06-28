/**
 * Spec 6: Reorder items via drag (manage tier)
 *
 * Covers:
 *  - drag the second item above the first
 *  - new order persists on reload
 *
 * Note: jQuery UI sortable requires simulating mousedown/mousemove/mouseup.
 * Playwright's dragTo uses HTML5 drag events which don't trigger jQuery UI.
 * We use mouse move steps to simulate jQuery UI drag.
 * If the drag proves unreliable, we fall back to a direct POST to the
 * reorder endpoint and assert persistence — both approaches are attempted.
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { resetChecklist, seedChecklist } from './reset';

const ISSUE_URL = `/issues/${ISSUE_ID}`;

test.beforeEach(() => {
  resetChecklist(ISSUE_ID);
  seedChecklist(ISSUE_ID, ['First item', 'Second item', 'Third item']);
});

test('admin: drag reorder — second item moved to top, persists on reload', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const list = page.locator('#checklist-items');
  await expect(list.locator('.checklist-item')).toHaveCount(3);

  // Verify initial order
  await expect(list.locator('.checklist-item-text').nth(0)).toHaveText('First item');
  await expect(list.locator('.checklist-item-text').nth(1)).toHaveText('Second item');
  await expect(list.locator('.checklist-item-text').nth(2)).toHaveText('Third item');

  // Get bounding boxes for drag
  const secondHandle = list.locator('.checklist-item').nth(1).locator('.checklist-handle');
  const firstItem = list.locator('.checklist-item').nth(0);

  const handleBox = await secondHandle.boundingBox();
  const firstBox = await firstItem.boundingBox();

  if (!handleBox || !firstBox) throw new Error('Could not get bounding boxes for drag');

  // Simulate jQuery UI compatible drag:
  // 1. mousedown on handle
  // 2. move slowly upwards over first item
  // 3. mouseup above first item
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();

  // Move in small steps to trigger jQuery UI sortable's mousemove handlers
  const startY = handleBox.y + handleBox.height / 2;
  const endY = firstBox.y - 5; // just above the first item
  const startX = handleBox.x + handleBox.width / 2;
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      startX,
      startY + (endY - startY) * (i / steps),
      { steps: 1 }
    );
  }
  await page.mouse.up();

  // Wait for reorder AJAX to complete (the reorder.js.erb response)
  await page.waitForResponse(r => r.url().includes('reorder'), { timeout: 7000 });

  // After drag and drop, the DOM order should have changed
  // (jQuery UI sortable moves the DOM immediately on drop)
  // The new top item should be "Second item"
  await expect(list.locator('.checklist-item-text').nth(0)).toHaveText('Second item', { timeout: 5000 });

  // Persist on reload
  await page.reload();
  await expect(page.locator('#checklist-items .checklist-item-text').nth(0)).toHaveText('Second item');

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  const realErrors = consoleErrors.filter(e => !e.includes('chrome-extension'));
  expect(realErrors, 'console errors: ' + realErrors.join('\n')).toEqual([]);

  await logout(page);
});

test('admin: reorder via direct endpoint POST persists on reload', async ({ page, request }) => {
  // This test verifies reorder persistence directly via the HTTP endpoint.
  // It is a deterministic fallback that does not depend on drag simulation.
  const { failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(ISSUE_URL);

  const list = page.locator('#checklist-items');
  await expect(list.locator('.checklist-item')).toHaveCount(3);

  // Get item IDs in current order from data-id attributes
  const ids = await list.locator('.checklist-item').evaluateAll(
    (els) => els.map(el => el.getAttribute('data-id'))
  );
  console.log('Initial IDs:', ids);

  // Reverse the order
  const reversedIds = [...ids].reverse();

  // Get CSRF token and session cookie from current page
  const csrfToken = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  });
  const cookies = await page.context().cookies();
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  const response = await page.evaluate(async ({ baseUrl, issueId, reversedIds, csrfToken }) => {
    const formData = new FormData();
    reversedIds.forEach(id => formData.append('ids[]', id!));
    const resp = await fetch(`${baseUrl}/issues/${issueId}/checklist_items/reorder`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken, 'Accept': 'text/javascript' },
      body: formData,
      credentials: 'include',
    });
    return { status: resp.status };
  }, { baseUrl, issueId: ISSUE_ID, reversedIds, csrfToken });

  expect(response.status).toBe(200);

  // Reload and verify reversed order
  await page.reload();
  const newOrder = await page.locator('#checklist-items .checklist-item').evaluateAll(
    (els) => els.map(el => el.getAttribute('data-id'))
  );
  console.log('New IDs after reorder:', newOrder);
  expect(newOrder).toEqual(reversedIds);

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  await logout(page);
});
