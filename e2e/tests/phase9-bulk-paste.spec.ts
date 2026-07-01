/**
 * Phase 9 E2E Spec: multiline paste → bulk-add
 *
 * Pasting several lines into the add-item input creates one item per line;
 * a line starting with "#" becomes a section header. Single-line pastes fall
 * through to the browser's normal paste.
 */
import { test, expect } from '@playwright/test';
import { login, logout, ISSUE_ID, trackErrors } from './helpers';
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

test.beforeEach(() => ruby(`Issue.find(${ISSUE_ID}).checklist_items.delete_all`));
test.afterAll(() => ruby(`Issue.find(${ISSUE_ID}).checklist_items.delete_all`));

test('bulk paste: multiple lines create one item per line, "#" makes a section', async ({ page }) => {
  const { failedRequests } = trackErrors(page);
  await login(page, 'admin', 'Test1234!');
  await page.goto(`/issues/${ISSUE_ID}`);

  const input = page.locator('.checklist-new-item-input');
  await input.click();

  // Fire a paste event carrying multiline text (deterministic; no OS clipboard).
  await input.evaluate((el, text) => {
    const dt = new DataTransfer();
    dt.setData('text', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, 'First item\n# A Section\nSecond item\nThird item');

  // 4 rows total (3 tasks + 1 section); input cleared.
  await expect(page.locator('#checklist-items .checklist-item')).toHaveCount(4, { timeout: 7000 });
  await expect(page.locator('#checklist-items .checklist-section')).toHaveCount(1);
  await expect(input).toHaveValue('');

  // Persisted correctly in the DB (order + section flag).
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).checklist_items.count`)).toBe('4');
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).checklist_items.where(is_section:true).first&.subject`)).toBe('A Section');
  expect(rubyOut(`print Issue.find(${ISSUE_ID}).checklist_items.ordered.first.subject`)).toBe('First item');

  expect(failedRequests.filter(r => r.includes('checklist'))).toEqual([]);
  await logout(page);
});
