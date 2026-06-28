class ChecklistItemsController < ApplicationController
  before_action :find_issue
  before_action :find_checklist_item, only: [:update, :destroy]
  before_action :authorize

  accept_api_auth :index, :create, :update, :destroy, :reorder

  def index
    @checklist_items = @issue.checklist_items.ordered
    respond_to do |format|
      format.json { render json: @checklist_items }
    end
  end

  def create
    @checklist_item = @issue.checklist_items.build(checklist_item_params)
    @checklist_item.position = @issue.checklist_items.count

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

  def update
    respond_to do |format|
      if @checklist_item.update(checklist_item_params)
        format.js
        format.json { render json: @checklist_item }
      else
        format.js   { render :error }
        format.json { render json: @checklist_item.errors, status: :unprocessable_entity }
      end
    end
  end

  def destroy
    @checklist_item.destroy
    respond_to do |format|
      format.js
      format.json { head :no_content }
    end
  end

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

  def checklist_item_params
    params.require(:checklist_item).permit(:subject, :is_done, :position)
  end
end
