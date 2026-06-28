require File.expand_path('../../test_helper', __FILE__)

# Uses Redmine::ControllerTest (ActionController::TestCase) so that
# @request.session[:user_id] auth works — the same pattern as Redmine core
# functional tests (e.g. issues_controller_test.rb).
class ChecklistItemsControllerTest < Redmine::ControllerTest
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

    # Add checklist permissions to roles used in tests.
    # Manager (role 1) — jsmith (user 2) — gets all three permissions.
    # Developer (role 2) — dlopper (user 3) — gets permissions added per test.
    @manager_role   = Role.find(1)
    @developer_role = Role.find(2)

    @manager_role.add_permission!(:view_checklists, :done_checklists, :manage_checklists)
  end

  def teardown
    # Clean up added permissions so tests don't bleed into each other
    @manager_role.remove_permission!(:view_checklists, :done_checklists, :manage_checklists)
    @developer_role.remove_permission!(:view_checklists, :done_checklists, :manage_checklists)
  end

  # -------------------------------------------------------------------------
  # index
  # -------------------------------------------------------------------------

  test "GET index returns 401 for anonymous" do
    get :index, params: { issue_id: @issue.id }, format: :json
    assert_response 401
  end

  test "GET index is accessible to manager" do
    @request.session[:user_id] = 2   # jsmith — Manager
    get :index, params: { issue_id: @issue.id }, format: :json
    assert_response :success
  end

  test "GET index is accessible with view_checklists" do
    @developer_role.add_permission!(:view_checklists)
    @request.session[:user_id] = 3   # dlopper — Developer
    get :index, params: { issue_id: @issue.id }, format: :json
    assert_response :success
  end

  # -------------------------------------------------------------------------
  # create
  # -------------------------------------------------------------------------

  test "POST create adds item as manager" do
    @request.session[:user_id] = 2
    assert_difference 'ChecklistItem.count', 1 do
      post :create, params: {
        issue_id:       @issue.id,
        checklist_item: { subject: 'New task' }
      }, format: :js
    end
    assert_response :success
    item = ChecklistItem.order(:id).last
    assert_equal 'New task', item.subject
    assert_equal false, item.is_section
    assert_equal 2, item.author_id
  end

  test "POST create adds section when is_section=1" do
    @request.session[:user_id] = 2
    assert_difference 'ChecklistItem.count', 1 do
      post :create, params: {
        issue_id:       @issue.id,
        checklist_item: { subject: 'Phase 2', is_section: '1' }
      }, format: :js
    end
    assert_response :success
    assert_equal true, ChecklistItem.order(:id).last.is_section
  end

  test "POST create denied for viewer (view_checklists only)" do
    @developer_role.add_permission!(:view_checklists)
    @request.session[:user_id] = 3
    assert_no_difference 'ChecklistItem.count' do
      post :create, params: {
        issue_id:       @issue.id,
        checklist_item: { subject: 'Sneaky task' }
      }, format: :js
    end
    assert_response 403
  end

  test "POST create denied for done-only user" do
    @developer_role.add_permission!(:done_checklists)
    @request.session[:user_id] = 3
    assert_no_difference 'ChecklistItem.count' do
      post :create, params: {
        issue_id:       @issue.id,
        checklist_item: { subject: 'Sneaky task' }
      }, format: :js
    end
    assert_response 403
  end

  # -------------------------------------------------------------------------
  # done (toggle)
  # -------------------------------------------------------------------------

  test "PATCH done marks item done as manager" do
    @request.session[:user_id] = 2
    item = checklist_items(:task_one)
    patch :done, params: {
      issue_id:       @issue.id,
      id:             item.id,
      checklist_item: { is_done: '1' }
    }, format: :js
    assert_response :success
    assert_equal true, ChecklistItem.find(item.id).is_done
  end

  test "PATCH done unmarks item done as manager" do
    @request.session[:user_id] = 2
    item = checklist_items(:task_done)
    patch :done, params: {
      issue_id:       @issue.id,
      id:             item.id,
      checklist_item: { is_done: '0' }
    }, format: :js
    assert_response :success
    assert_equal false, ChecklistItem.find(item.id).is_done
  end

  test "PATCH done allowed with done_checklists permission" do
    @developer_role.add_permission!(:done_checklists)
    @request.session[:user_id] = 3
    item = checklist_items(:task_one)
    patch :done, params: {
      issue_id:       @issue.id,
      id:             item.id,
      checklist_item: { is_done: '1' }
    }, format: :js
    assert_response :success
    assert_equal true, ChecklistItem.find(item.id).is_done
  end

  test "PATCH done denied for viewer (view_checklists only)" do
    @developer_role.add_permission!(:view_checklists)
    @request.session[:user_id] = 3
    item = checklist_items(:task_one)
    patch :done, params: {
      issue_id:       @issue.id,
      id:             item.id,
      checklist_item: { is_done: '1' }
    }, format: :js
    assert_response 403
    assert_equal false, ChecklistItem.find(item.id).is_done
  end

  # -------------------------------------------------------------------------
  # update (subject edit — manage only)
  # -------------------------------------------------------------------------

  test "PATCH update edits subject as manager" do
    @request.session[:user_id] = 2
    item = checklist_items(:task_one)
    patch :update, params: {
      issue_id:       @issue.id,
      id:             item.id,
      checklist_item: { subject: 'Updated subject' }
    }, format: :js
    assert_response :success
    assert_equal 'Updated subject', ChecklistItem.find(item.id).subject
  end

  test "PATCH update denied for done-only user" do
    @developer_role.add_permission!(:done_checklists)
    @request.session[:user_id] = 3
    item = checklist_items(:task_one)
    original_subject = item.subject
    patch :update, params: {
      issue_id:       @issue.id,
      id:             item.id,
      checklist_item: { subject: 'Sneaky edit' }
    }, format: :js
    assert_response 403
    assert_equal original_subject, ChecklistItem.find(item.id).subject
  end

  # -------------------------------------------------------------------------
  # destroy
  # -------------------------------------------------------------------------

  test "DELETE destroy removes item as manager" do
    @request.session[:user_id] = 2
    item = checklist_items(:task_two)
    assert_difference 'ChecklistItem.count', -1 do
      delete :destroy, params: { issue_id: @issue.id, id: item.id }, format: :js
    end
    assert_response :success
  end

  test "DELETE destroy denied for done-only user" do
    @developer_role.add_permission!(:done_checklists)
    @request.session[:user_id] = 3
    item = checklist_items(:task_two)
    assert_no_difference 'ChecklistItem.count' do
      delete :destroy, params: { issue_id: @issue.id, id: item.id }, format: :js
    end
    assert_response 403
  end

  # -------------------------------------------------------------------------
  # reorder
  # -------------------------------------------------------------------------

  test "POST reorder updates positions as manager" do
    @request.session[:user_id] = 2
    ids = [
      checklist_items(:task_two).id,
      checklist_items(:task_done).id,
      checklist_items(:task_one).id,
      checklist_items(:section_one).id
    ]
    post :reorder, params: { issue_id: @issue.id, ids: ids }, format: :js
    assert_response :success
    assert_equal 0, ChecklistItem.find(ids[0]).position
    assert_equal 1, ChecklistItem.find(ids[1]).position
    assert_equal 2, ChecklistItem.find(ids[2]).position
    assert_equal 3, ChecklistItem.find(ids[3]).position
  end

  test "POST reorder denied for done-only user" do
    @developer_role.add_permission!(:done_checklists)
    @request.session[:user_id] = 3
    post :reorder, params: {
      issue_id: @issue.id,
      ids: [checklist_items(:task_one).id]
    }, format: :js
    assert_response 403
  end
end
