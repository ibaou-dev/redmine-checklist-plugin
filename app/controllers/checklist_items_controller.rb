class ChecklistItemsController < ApplicationController
  before_action :find_issue
  before_action :find_checklist_item, only: [:update, :destroy, :done]
  before_action :authorize

  accept_api_auth :index, :create, :update, :destroy, :reorder, :done

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
    snapshot_before = @issue.checklist_items.ordered.to_a

    respond_to do |format|
      if @checklist_item.update(is_done: params.dig(:checklist_item, :is_done) == '1')
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

  # Params for manage_checklists actions (create/update): subject + is_section
  def checklist_item_params
    params.require(:checklist_item).permit(:subject, :is_section, :position)
  end

  # Alias used in create (same set)
  alias manage_checklist_item_params checklist_item_params

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
