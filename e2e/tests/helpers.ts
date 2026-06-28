import { Page, expect } from '@playwright/test';

export const ISSUE_ID = process.env.ISSUE_ID || '9';

// Log in through Redmine's standard /login form.
export async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('#login-submit'),
  ]);
  // After a successful login Redmine shows a "Sign out" link.
  await expect(page.locator('a[href="/logout"]').first()).toBeAttached({ timeout: 7000 });
}

export async function logout(page: Page) {
  // The sign-out link lives inside a collapsed dropdown — navigate directly
  // rather than trying to click() an invisible element.
  const signout = page.locator('a[href="/logout"]');
  if (await signout.count()) {
    await signout.first().click({ force: true });
    await page.waitForLoadState('networkidle');
  }
}

// Collect console errors + failed responses for assertion.
export function trackErrors(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('checklist')) {
      failedRequests.push(`${res.status()} ${res.url()}`);
    }
  });
  return { consoleErrors, failedRequests };
}
