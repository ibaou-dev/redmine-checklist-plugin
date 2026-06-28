/**
 * Spec 8: Permission enforcement (negative)
 *
 * Covers:
 *  - cl_viewer: no add/delete UI controls; direct POST to create returns 403
 *  - cl_viewer: direct DELETE to destroy returns 403
 *  - cl_checker: no add/delete UI; direct POST to create returns 403
 *  - cl_checker: direct DELETE to destroy returns 403
 *  - cl_checker: direct PATCH to done IS allowed (200)
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
import { resetChecklist, seedChecklist } from './reset';

const ISSUE_URL = `/issues/${ISSUE_ID}`;

test.beforeEach(() => {
  resetChecklist(ISSUE_ID);
  seedChecklist(ISSUE_ID, ['Permission test item']);
});

// ---------------------------------------------------------------------------
// cl_viewer: UI controls absent
// ---------------------------------------------------------------------------
test('cl_viewer: no delete control in UI', async ({ page }) => {
  await login(page, 'cl_viewer', 'Test1234!');
  await page.goto(ISSUE_URL);

  await expect(page.locator('#checklist-panel')).toBeVisible();
  await expect(page.locator('.checklist-delete')).not.toBeAttached();
  await expect(page.locator('.checklist-handle')).not.toBeAttached();

  await logout(page);
});

// ---------------------------------------------------------------------------
// cl_viewer: direct API calls return 403
// ---------------------------------------------------------------------------
test('cl_viewer: direct POST create returns 403', async ({ page }) => {
  await login(page, 'cl_viewer', 'Test1234!');
  await page.goto(ISSUE_URL);

  const csrfToken = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  });

  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  const result = await page.evaluate(async ({ baseUrl, issueId, csrfToken }) => {
    const formData = new FormData();
    formData.append('checklist_item[subject]', 'Injected item');
    formData.append('checklist_item[is_section]', '0');
    const resp = await fetch(`${baseUrl}/issues/${issueId}/checklist_items`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken, 'Accept': 'text/javascript' },
      body: formData,
      credentials: 'include',
    });
    return { status: resp.status };
  }, { baseUrl, issueId: ISSUE_ID, csrfToken });

  expect(result.status).toBe(403);
  await logout(page);
});

test('cl_viewer: direct DELETE destroy returns 403', async ({ page }) => {
  await login(page, 'cl_viewer', 'Test1234!');
  await page.goto(ISSUE_URL);

  // Get the item ID from the DOM
  const itemId = await page.locator('#checklist-items .checklist-item').first()
    .getAttribute('data-id');
  expect(itemId).toBeTruthy();

  const csrfToken = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  });

  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  const result = await page.evaluate(async ({ baseUrl, issueId, itemId, csrfToken }) => {
    const resp = await fetch(`${baseUrl}/issues/${issueId}/checklist_items/${itemId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrfToken, 'Accept': 'text/javascript' },
      credentials: 'include',
    });
    return { status: resp.status };
  }, { baseUrl, issueId: ISSUE_ID, itemId, csrfToken });

  expect(result.status).toBe(403);
  await logout(page);
});

// ---------------------------------------------------------------------------
// cl_checker: UI controls absent (no add/delete)
// ---------------------------------------------------------------------------
test('cl_checker: no delete control, no add form', async ({ page }) => {
  await login(page, 'cl_checker', 'Test1234!');
  await page.goto(ISSUE_URL);

  await expect(page.locator('#checklist-panel')).toBeVisible();
  await expect(page.locator('#checklist-add-form')).not.toBeAttached();
  await expect(page.locator('.checklist-delete')).not.toBeAttached();
  await expect(page.locator('.checklist-handle')).not.toBeAttached();

  await logout(page);
});

// ---------------------------------------------------------------------------
// cl_checker: direct create/destroy are 403, but done is 200
// ---------------------------------------------------------------------------
test('cl_checker: direct POST create returns 403', async ({ page }) => {
  await login(page, 'cl_checker', 'Test1234!');
  await page.goto(ISSUE_URL);

  const csrfToken = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  });

  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  const result = await page.evaluate(async ({ baseUrl, issueId, csrfToken }) => {
    const formData = new FormData();
    formData.append('checklist_item[subject]', 'Injected item');
    formData.append('checklist_item[is_section]', '0');
    const resp = await fetch(`${baseUrl}/issues/${issueId}/checklist_items`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken, 'Accept': 'text/javascript' },
      body: formData,
      credentials: 'include',
    });
    return { status: resp.status };
  }, { baseUrl, issueId: ISSUE_ID, csrfToken });

  expect(result.status).toBe(403);
  await logout(page);
});

test('cl_checker: direct DELETE destroy returns 403', async ({ page }) => {
  await login(page, 'cl_checker', 'Test1234!');
  await page.goto(ISSUE_URL);

  const itemId = await page.locator('#checklist-items .checklist-item').first()
    .getAttribute('data-id');
  expect(itemId).toBeTruthy();

  const csrfToken = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  });

  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  const result = await page.evaluate(async ({ baseUrl, issueId, itemId, csrfToken }) => {
    const resp = await fetch(`${baseUrl}/issues/${issueId}/checklist_items/${itemId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrfToken, 'Accept': 'text/javascript' },
      credentials: 'include',
    });
    return { status: resp.status };
  }, { baseUrl, issueId: ISSUE_ID, itemId, csrfToken });

  expect(result.status).toBe(403);
  await logout(page);
});

test('cl_checker: direct PATCH done is allowed (200)', async ({ page }) => {
  const { failedRequests } = trackErrors(page);
  await login(page, 'cl_checker', 'Test1234!');
  await page.goto(ISSUE_URL);

  const itemId = await page.locator('#checklist-items .checklist-item').first()
    .getAttribute('data-id');
  expect(itemId).toBeTruthy();

  const csrfToken = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  });

  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  const result = await page.evaluate(async ({ baseUrl, issueId, itemId, csrfToken }) => {
    const formData = new FormData();
    formData.append('checklist_item[is_done]', '1');
    const resp = await fetch(`${baseUrl}/issues/${issueId}/checklist_items/${itemId}/done`, {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': csrfToken, 'Accept': 'text/javascript' },
      body: formData,
      credentials: 'include',
    });
    return { status: resp.status };
  }, { baseUrl, issueId: ISSUE_ID, itemId, csrfToken });

  expect(result.status).toBe(200);

  expect(failedRequests, 'failed requests: ' + failedRequests.join('\n')).toEqual([]);
  await logout(page);
});
