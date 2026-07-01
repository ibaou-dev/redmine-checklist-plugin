/**
 * Phase 7 E2E Spec: assignment notifications (email + webhook)
 *
 * Email and webhooks are not browser-visible, and a browser-triggered assignment
 * runs in the web server process while our assertions run in a separate `rails
 * runner` — so deliveries can't be read across processes. These checks therefore
 * drive the whole assign→deliver cycle inside a SINGLE runner process (test mail
 * delivery + inline jobs + a stubbed webhook), which is the correct level to
 * verify the notification logic, guards, and payload.
 */
import { test, expect } from '@playwright/test';
import { ISSUE_ID } from './helpers';
import { execSync } from 'node:child_process';

const DC = 'docker compose -f docker-compose.yml -f docker-compose.local.yml';
const DEVC = '/home/ibaou/workspace/redmine-devcontainer';
function rubyOut(r: string): string {
  return execSync(`${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(r.replace(/\s+/g, ' ').trim())}`,
    { cwd: DEVC, encoding: 'utf8' }).trim().split('\n').pop() || '';
}

const SETUP = `
  ActiveJob::Base.queue_adapter=:inline; ActionMailer::Base.delivery_method=:test;
  ActionMailer::Base.perform_deliveries=true;
  actor=User.find(1); other=User.active.where.not(id:actor.id).first; User.current=actor;
  i=Issue.find(${ISSUE_ID}); i.checklist_items.delete_all;
  it=i.checklist_items.create!(subject:'Notify me', position:0);
`;
const RESET = `Setting.plugin_redmine_checklist = {'show_progress_bar'=>'1','save_log'=>'1'}`;

test.afterAll(() => {
  execSync(`${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(RESET)}`, { cwd: DEVC, stdio: 'ignore' });
  execSync(`${DC} exec -T redmine bundle exec rails runner ${JSON.stringify(`Issue.find(${ISSUE_ID}).checklist_items.delete_all`)}`, { cwd: DEVC, stdio: 'ignore' });
});

test('notifications: assigning to another user emails them (subject + recipient)', () => {
  const out = rubyOut(`${SETUP}
    Setting.plugin_redmine_checklist = Setting.plugin_redmine_checklist.merge('notify_on_assignment'=>'1','webhook_url'=>'');
    ActionMailer::Base.deliveries.clear;
    it.update!(assignee_id: other.id);
    d = ActionMailer::Base.deliveries.last;
    print((d && d.to.first == other.mail && d.subject.include?('assigned')) ? 'EMAIL_OK' : 'EMAIL_NONE')`);
  expect(out).toBe('EMAIL_OK');
});

test('notifications: self-assignment notifies nobody (email + webhook)', () => {
  const out = rubyOut(`${SETUP}
    hits=[]; RedmineChecklist::Notifier.define_singleton_method(:post_json){|u,p| hits<<p};
    Setting.plugin_redmine_checklist = Setting.plugin_redmine_checklist.merge('notify_on_assignment'=>'1','webhook_url'=>'https://example.test/h');
    ActionMailer::Base.deliveries.clear;
    it.update!(assignee_id: actor.id);
    print((ActionMailer::Base.deliveries.empty? && hits.empty?) ? 'SILENT' : 'NOISY')`);
  expect(out).toBe('SILENT');
});

test('notifications: webhook posts a JSON payload when a URL is configured', () => {
  const out = rubyOut(`${SETUP}
    hits=[]; RedmineChecklist::Notifier.define_singleton_method(:post_json){|u,p| hits<<[u,p]};
    Setting.plugin_redmine_checklist = Setting.plugin_redmine_checklist.merge('notify_on_assignment'=>'0','webhook_url'=>'https://example.test/hook');
    it.update!(assignee_id: other.id);
    u,p = hits.last;
    print((hits.size==1 && u=='https://example.test/hook' && p[:event]=='checklist_item.assigned' && p[:assignee][:login]==other.login && p[:issue_id]==${ISSUE_ID}) ? 'HOOK_OK' : 'HOOK_BAD')`);
  expect(out).toBe('HOOK_OK');
});

test('notifications: nothing fires when both channels are disabled', () => {
  const out = rubyOut(`${SETUP}
    hits=[]; RedmineChecklist::Notifier.define_singleton_method(:post_json){|u,p| hits<<p};
    Setting.plugin_redmine_checklist = Setting.plugin_redmine_checklist.merge('notify_on_assignment'=>'0','webhook_url'=>'');
    ActionMailer::Base.deliveries.clear;
    it.update!(assignee_id: other.id);
    print((ActionMailer::Base.deliveries.empty? && hits.empty?) ? 'SILENT' : 'NOISY')`);
  expect(out).toBe('SILENT');
});
