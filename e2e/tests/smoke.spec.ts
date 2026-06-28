import { test, expect } from '@playwright/test';
import { login, ISSUE_ID, trackErrors } from './helpers';

test('smoke: admin sees the checklist panel and assets load', async ({ page }) => {
  const { consoleErrors, failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);
  await expect(page.locator('#checklist-panel')).toBeVisible();
  // plugin CSS applied (panel has top border styling) and add form present for manage
  await expect(page.locator('#checklist-add-form')).toBeVisible();
  // No console errors / failed checklist requests
  expect(failedRequests, failedRequests.join('\n')).toEqual([]);
});
