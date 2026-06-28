import { execSync } from 'node:child_process';

const DC = 'docker compose -f docker-compose.yml -f docker-compose.local.yml';
const DEVC = '/home/ibaou/workspace/redmine-devcontainer';

// Reset the checklist on the test issue to a known empty state between tests.
// Runs a rails runner inside the Redmine container. Deterministic + fast.
export function resetChecklist(issueId: string | number = 9) {
  const ruby = `Issue.find(${issueId}).checklist_items.delete_all`;
  execSync(`${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(ruby)}`, {
    cwd: DEVC, stdio: 'ignore',
  });
}

// Seed a known set of items (returns nothing; query the DOM after).
export function seedChecklist(issueId: string | number, subjects: string[]) {
  const lines = subjects.map((s, i) =>
    `i.checklist_items.create!(subject: ${JSON.stringify(s)}, position: ${i})`).join('; ');
  const ruby = `i = Issue.find(${issueId}); ${lines}`;
  execSync(`${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(ruby)}`, {
    cwd: DEVC, stdio: 'ignore',
  });
}
