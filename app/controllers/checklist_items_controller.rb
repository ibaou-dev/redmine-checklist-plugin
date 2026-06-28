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
    @checklist_item = @issue.checklist_items.build(checklist_item_params)
    @checklist_item.author_id = User.current.id
    @checklist_item.position  = @issue.checklist_items.maximum(:position).to_i + 1

    respond_to do |format|
      if @checklist_item.save
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
    respond_to do |format|
      if @checklist_item.update(manage_checklist_item_params)
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
    respond_to do |format|
      if @checklist_item.update(is_done: params.dig(:checklist_item, :is_done) == '1')
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
    @checklist_item.destroy
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
end
