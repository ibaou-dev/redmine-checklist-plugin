class ChecklistItemsController < ApplicationController
  # Helpers needed to re-render the issue History tab in the .js responses
  # (include_all_helpers is off in Redmine, so these are not available by default).
  helper :issues
  helper :journals
  helper :attachments
  helper :custom_fields
  helper :avatars

  before_action :find_issue
  before_action :find_checklist_item, only: [:update, :destroy, :done, :convert]
  before_action :authorize

  accept_api_auth :index, :create, :update, :destroy, :reorder, :done, :apply_template

  # GET /issues/:issue_id/checklist_items(.json)
  # Requires: view_checklists
  def index
    @checklist_items = @issue.checklist_items.ordered
    respond_to do |format|
      format.json { render json: @checklist_items }
    end
  end

  # POST /issues/:issue_id/checklist_items(.js|.json)
  # Requires: manage_checklists
  def create
    snapshot_before = @issue.checklist_items.ordered.to_a

    @checklist_item = @issue.checklist_items.build(checklist_item_params)
    @checklist_item.author_id = User.current.id
    @checklist_item.position  = @issue.checklist_items.maximum(:position).to_i + 1

    respond_to do |format|
      if @checklist_item.save
        record_checklist_journal(snapshot_before)
        ChecklistItem.recalc_done_ratio(@issue.id)
        format.js
        format.json { render json: @checklist_item, status: :created }
      else
        format.js   { render :error }
        format.json { render json: @checklist_item.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH /issues/:issue_id/checklist_items/:id(.js|.json)
  # Requires: manage_checklists — for subject/field edits only
  def update
    snapshot_before = @issue.checklist_items.ordered.to_a

    respond_to do |format|
      if @checklist_item.update(manage_checklist_item_params)
        record_checklist_journal(snapshot_before)
        ChecklistItem.recalc_done_ratio(@issue.id)
        format.js
        format.json { render json: @checklist_item }
      else
        format.js   { render :error }
        format.json { render json: @checklist_item.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH /issues/:issue_id/checklist_items/:id/done(.js|.json)
  # Requires: done_checklists — toggles is_done only
  def done
    new_done = params.dig(:checklist_item, :is_done) == '1'

    # Enforcement invariant: don't allow unchecking a mandatory item while the
    # issue is in a status that requires all mandatory items complete.
    if !new_done && checklist_uncheck_blocked?(@checklist_item)
      @block_message = l(:error_checklist_mandatory_locked)
      respond_to do |format|
        format.js   { render :blocked }
        format.json { render json: { error: @block_message }, status: :unprocessable_entity }
      end
      return
    end

    snapshot_before = @issue.checklist_items.ordered.to_a

    respond_to do |format|
      if @checklist_item.update(is_done: new_done)
        record_checklist_journal(snapshot_before)
        ChecklistItem.recalc_done_ratio(@issue.id)
        format.js
        format.json { render json: @checklist_item }
      else
        format.js   { render :error }
        format.json { render json: @checklist_item.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /issues/:issue_id/checklist_items/:id(.js|.json)
  # Requires: manage_checklists
  def destroy
    snapshot_before = @issue.checklist_items.ordered.to_a

    @checklist_item.destroy
    record_checklist_journal(snapshot_before)
    ChecklistItem.recalc_done_ratio(@issue.id)

    respond_to do |format|
      format.js
      format.json { head :no_content }
    end
  end

  # POST /issues/:issue_id/checklist_items/apply_template(.js|.json)
  # Requires: manage_checklists (apply_template is in its action list)
  def apply_template
    template = ChecklistTemplate.available_for(@project).find_by(id: params[:template_id])
    return render_404 unless template

    snapshot_before = @issue.checklist_items.ordered.to_a
    template.apply_to(@issue, User.current)
    record_checklist_journal(snapshot_before)
    ChecklistItem.recalc_done_ratio(@issue.id)

    # Reload checklist state for the JS response
    @checklist_items = @issue.checklist_items.reload.ordered
    @can_done   = User.current.allowed_to?(:done_checklists,   @project) ||
                  User.current.allowed_to?(:manage_checklists, @project)
    @can_manage = User.current.allowed_to?(:manage_checklists, @project)

    respond_to do |format|
      format.js
      format.json { head :ok }
    end
  end

  # GET /issues/:issue_id/checklist_items/:id/convert
  # Requires: manage_checklists (this action) + add_issues + manage_subtasks.
  # Promotes a checklist task into a child issue by redirecting the user to the
  # standard new-issue form, prefilled from the item, carrying a signed token so
  # the created issue is linked back on save (see RedmineChecklist::Conversion).
  def convert
    unless convertible?(@checklist_item)
      flash[:error] = l(:error_convert_not_allowed)
      redirect_to issue_path(@issue)
      return
    end

    token = RedmineChecklist.convert_verifier.generate(
      { 'item' => @checklist_item.id, 'issue' => @issue.id, 'user' => User.current.id },
      expires_in: 30.minutes
    )

    issue_attrs = { subject: @checklist_item.subject, parent_issue_id: @issue.id }
    issue_attrs[:assigned_to_id] = @checklist_item.assignee_id if @checklist_item.assignee_id.present?
    issue_attrs[:due_date]       = @checklist_item.due_date    if @checklist_item.due_date.present?

    redirect_to new_project_issue_path(@project, issue: issue_attrs, checklist_item_token: token)
  end

  # POST /issues/:issue_id/checklist_items/reorder(.js|.json)
  # Requires: manage_checklists
  def reorder
    ids = params[:ids] || []
    ids.each_with_index do |id, index|
      @issue.checklist_items.where(id: id).update_all(position: index)
    end
    respond_to do |format|
      format.js   { render :reorder }
      format.json { head :ok }
    end
  end

  private

  def find_issue
    @issue = Issue.find(params[:issue_id])
    @project = @issue.project
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  def find_checklist_item
    @checklist_item = @issue.checklist_items.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  # True when unchecking +item+ would break the mandatory-item enforcement
  # invariant: it is a mandatory task AND the issue's CURRENT status is one that
  # requires all mandatory items complete (per the project-wins config).
  def checklist_uncheck_blocked?(item)
    return false unless item.is_mandatory? && !item.is_section?

    cfg = ChecklistProjectSetting.effective_for(@issue.project)
    cfg[:enabled] && cfg[:status_ids].include?(@issue.status_id.to_s)
  end

  # True when +item+ may be promoted to a subtask: it is an open task (not a
  # section, not already done, not already converted), and the issue-level gate
  # (permissions + parent open) is satisfied. Issue-level logic lives on the
  # model (Issue#checklist_convert_allowed?) so the view hook can reuse it.
  def convertible?(item)
    return false if item.is_section? || item.done? || item.converted?

    @issue.checklist_convert_allowed?
  end

  # Params for the create action: subject, is_section, position only
  # (assignee/due/mandatory are set via the detail-panel update, not on create)
  def checklist_item_params
    params.require(:checklist_item).permit(:subject, :is_section, :position)
  end

  # Params for the update action (manage_checklists): includes detail-panel fields
  def manage_checklist_item_params
    params.require(:checklist_item).permit(:subject, :is_section, :position,
                                           :is_mandatory, :assignee_id, :due_date)
  end

  # -------------------------------------------------------------------------
  # Journal recording
  # -------------------------------------------------------------------------

  # Record a checklist mutation as a JournalDetail on the issue journal.
  # +snapshot_before+ is the array of ChecklistItem records captured BEFORE
  # the save (while they still reflect the old state).
  #
  # Implements consolidation: if the last journal on this issue was created
  # by the same user, within 1 minute, has blank notes, and contains only
  # checklist details — merge into it instead of creating a new journal.
  def record_checklist_journal(snapshot_before)
    plugin_settings = Setting.plugin_redmine_checklist
    save_log = plugin_settings['save_log'].to_s
    # save_log defaults to ON unless explicitly '0'
    return if save_log == '0'

    # Reload to get the current (after-save) state
    @issue.reload
    snapshot_after = @issue.checklist_items.ordered.to_a

    old_json = ChecklistHistory.serialize(snapshot_before)
    new_json = ChecklistHistory.serialize(snapshot_after)

    # Nothing changed at all → skip
    return if old_json == new_json

    # Attempt consolidation with the most recent journal
    prev_journal = @issue.journals.order(:created_on).last
    if ChecklistHistory.can_consolidate?(prev_journal, User.current)
      ChecklistHistory.consolidate(prev_journal, new_json)
      return
    end

    # Create a fresh journal with a single checklist detail
    journal = Journal.new(
      journalized: @issue,
      user:        User.current,
      notes:       ''
    )
    journal.details << JournalDetail.new(
      property:  'attr',
      prop_key:  'checklist',
      old_value: old_json,
      value:     new_json
    )
    journal.save!
  rescue StandardError => e
    # Never let journal failures break the main action
    Rails.logger.error("ChecklistItem journal error: #{e.class}: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
  end
end
