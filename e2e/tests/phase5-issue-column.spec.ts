/**
 * Issue-list "Checklist" column (v1.0.0)
 *
 * Adding the optional `checklist_progress` column to a query shows each issue's
 * progress (done/total · %); issues with no checklist tasks render blank.
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

test.afterAll(() => {
  ruby(`Issue.find(${ISSUE_ID}).checklist_items.delete_all`);
});

test('issue list: the Checklist column shows progress and is blank without a checklist', async ({ page }) => {
  // Issue 9: two tasks, one done → 1/2 (50%).
  ruby(`i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all; i.checklist_items.create!(subject:'A', position:0); i.checklist_items.create!(subject:'B', position:1, is_done:true)`);

  await login(page, 'admin', 'Test1234!');

  // Issue list with the checklist_progress column selected.
  await page.goto('/issues?set_filter=1&c%5B%5D=subject&c%5B%5D=checklist_progress&sort=id:desc');
  await page.waitForLoadState('networkidle');

  // Column header is present.
  const headers = await page.locator('table.issues thead th').allInnerTexts();
  expect(headers.some(h => /checklist/i.test(h))).toBeTruthy();

  // Issue 9's cell shows the progress.
  const row9 = page.locator('table.issues tr#issue-' + ISSUE_ID);
  await expect(row9.locator('td.checklist_progress')).toHaveText('1/2 (50%)', { timeout: 7000 });

  // At least one issue without a checklist has a blank cell.
  const cells = await page.locator('table.issues td.checklist_progress').allInnerTexts();
  expect(cells.some(c => c.trim() === '')).toBeTruthy();

  await logout(page);
});
