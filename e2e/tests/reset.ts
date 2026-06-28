import { execSync } from 'node:child_process';

const DC = 'docker compose -f docker-compose.yml -f docker-compose.local.yml';
const DEVC = '/home/ibaou/workspace/redmine-devcontainer';

function runRuby(ruby: string): string {
  // Use a single-line ruby string to avoid shell quoting issues
  const oneLine = ruby.replace(/\s+/g, ' ').trim();
  try {
    return execSync(`${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(oneLine)}`, {
      cwd: DEVC, encoding: 'utf8',
    }).trim();
  } catch (e: any) {
    return e.stdout?.trim() || '';
  }
}

// Reset the checklist on the test issue to a known empty state between tests.
// Also clears any checklist journals on the issue and resets done_ratio to 0.
export function resetChecklist(issueId: string | number = 9) {
  runRuby(`Issue.find(${issueId}).checklist_items.delete_all`);
  runRuby(`Journal.joins(:details).where(journalized_type: 'Issue', journalized_id: ${issueId}).where(journal_details: {prop_key: 'checklist'}).destroy_all`);
  runRuby(`Issue.where(id: ${issueId}).update_all(done_ratio: 0)`);
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

// Enable plugin settings for Phase 2 testing.
export function enablePhase2Settings() {
  runRuby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','save_log'=>'1','affect_done_ratio'=>'1'}`);
}

// Restore default settings (show_progress_bar on, save_log & affect_done_ratio off).
export function restoreDefaultSettings() {
  runRuby(`Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1'}`);
}

// Get the issue done_ratio via rails runner.
export function getIssueDoneRatio(issueId: string | number): number {
  const result = runRuby(`puts Issue.find(${issueId}).done_ratio`);
  return parseInt(result.split('\n').pop() || '0', 10);
}

// Count checklist journals on an issue.
export function getChecklistJournalCount(issueId: string | number): number {
  const result = runRuby(`puts Journal.joins(:details).where(journalized_type: 'Issue', journalized_id: ${issueId}).where(journal_details: {prop_key: 'checklist'}).count`);
  return parseInt(result.split('\n').pop() || '0', 10);
}
