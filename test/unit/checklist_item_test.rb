require File.expand_path('../../test_helper', __FILE__)

class ChecklistItemTest < ActiveSupport::TestCase
  fixtures :projects, :users, :roles, :members, :member_roles,
           :issues, :issue_statuses, :trackers, :projects_trackers,
           :enumerations, :enabled_modules

  # Load plugin-specific fixtures from plugin test/fixtures/ directory
  ActiveRecord::FixtureSet.create_fixtures(
    Redmine::Plugin.find(:redmine_checklist).directory + '/test/fixtures/',
    [:checklist_items]
  )

  def setup
    User.current = nil
    @project = Project.find(1)
    @issue   = Issue.find(1)
  end

  # --- Validations ---------------------------------------------------------

  test "valid task item" do
    item = ChecklistItem.new(issue: @issue, subject: 'Do something', position: 0)
    assert item.valid?, item.errors.full_messages.inspect
  end

  test "requires subject" do
    item = ChecklistItem.new(issue: @issue, subject: '', position: 0)
    assert_not item.valid?
    assert_includes item.errors[:subject], "can't be blank"
  end

  test "requires issue" do
    item = ChecklistItem.new(subject: 'Orphan', position: 0)
    assert_not item.valid?
  end

  test "requires non-negative integer position" do
    item = ChecklistItem.new(issue: @issue, subject: 'x', position: -1)
    assert_not item.valid?
  end

  test "subject max length 1000 chars" do
    item = ChecklistItem.new(issue: @issue, subject: 'a' * 1001, position: 0)
    assert_not item.valid?
  end

  # --- Scopes --------------------------------------------------------------

  test "done scope returns only done tasks" do
    done_items = @issue.checklist_items.done
    assert done_items.all?(&:done?), "done scope returned non-done items"
  end

  test "pending scope returns only undone items" do
    pending_items = @issue.checklist_items.pending
    assert pending_items.none?(&:done?), "pending scope returned done items"
  end

  test "tasks scope excludes sections" do
    tasks = @issue.checklist_items.tasks
    assert tasks.none?(&:section?), "tasks scope included sections"
  end

  test "sections scope returns only sections" do
    sections = @issue.checklist_items.sections
    assert sections.all?(&:section?), "sections scope returned non-sections"
  end

  test "ordered scope orders by position ascending" do
    positions = @issue.checklist_items.ordered.map(&:position)
    assert_equal positions.sort, positions
  end

  # --- Completion stamping -------------------------------------------------

  test "stamps completed_at and completed_by when marked done" do
    User.current = User.find(2)
    item = ChecklistItem.find(checklist_items(:task_one).id)
    item.update!(is_done: true)
    item.reload
    assert_not_nil item.completed_at
    assert_equal 2, item.completed_by_id
  end

  test "clears completed_at and completed_by when unmarked done" do
    User.current = User.find(2)
    item = ChecklistItem.find(checklist_items(:task_done).id)
    item.update!(is_done: false)
    item.reload
    assert_nil item.completed_at
    assert_nil item.completed_by_id
  end

  test "does not stamp completion for sections even if is_done set" do
    User.current = User.find(2)
    item = ChecklistItem.find(checklist_items(:section_one).id)
    item.update!(is_done: true)
    item.reload
    # stamp_completion guards with !is_section?, so completed_at stays nil
    assert_nil item.completed_at
  end

  # --- Progress helper -----------------------------------------------------

  test "checklist_progress excludes sections from count" do
    # Fixtures for issue 1: task_one (pending), task_done (done),
    # section_one (section, not counted), task_two (pending).
    # tasks total=3, done=1 => 33%
    helper = Object.new.extend(ChecklistItemsHelper)
    prog = helper.checklist_progress(@issue)
    assert_not_nil prog
    assert_equal 3,  prog[:total], "total should count only tasks (3), not sections"
    assert_equal 1,  prog[:done],  "done should be 1"
    assert_equal 33, prog[:percent]
  end

  test "checklist_progress returns nil when no tasks exist" do
    # Create an issue with only a section item — progress should be nil
    issue = Issue.create!(
      project_id: 1, tracker_id: 1, author_id: 1,
      status_id: 1, priority: IssuePriority.first,
      subject: 'Section-only issue'
    )
    ChecklistItem.create!(issue: issue, subject: 'Phase 1',
                          is_section: true, position: 0)
    helper = Object.new.extend(ChecklistItemsHelper)
    assert_nil helper.checklist_progress(issue)
  end
end
