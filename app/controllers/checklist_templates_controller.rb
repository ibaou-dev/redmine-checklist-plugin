class ChecklistTemplatesController < ApplicationController
  before_action :find_project_and_authorize
  before_action :find_template, only: [:edit, :update, :destroy]

  accept_api_auth :index

  # GET /checklist_templates          (global/admin)
  # GET /projects/:project_id/checklist_templates  (project-scoped)
  def index
    @templates = template_scope.includes(:category, :tracker).order(:name)
    @categories = ChecklistTemplateCategory.ordered
  end

  # GET /checklist_templates/new
  # GET /projects/:project_id/checklist_templates/new
  def new
    @template = ChecklistTemplate.new(project: @project)
  end

  # POST /checklist_templates
  # POST /projects/:project_id/checklist_templates
  def create
    @template = ChecklistTemplate.new(template_params)
    @template.project_id = @project&.id
    @template.user_id    = User.current.id

    if @template.save
      flash[:notice] = l(:notice_successful_create)
      redirect_to templates_index_path
    else
      render :new
    end
  end

  # GET /checklist_templates/:id/edit
  # GET /projects/:project_id/checklist_templates/:id/edit
  def edit
  end

  # PATCH /checklist_templates/:id
  # PATCH /projects/:project_id/checklist_templates/:id
  def update
    if @template.update(template_params)
      flash[:notice] = l(:notice_successful_update)
      redirect_to templates_index_path
    else
      render :edit
    end
  end

  # DELETE /checklist_templates/:id
  # DELETE /projects/:project_id/checklist_templates/:id
  def destroy
    @template.destroy
    flash[:notice] = l(:notice_successful_delete)
    redirect_to templates_index_path
  end

  private

  # Dual-mode authorization:
  #   - project_id present → project-scoped; require manage_checklist_templates
  #   - no project_id      → global/admin; require admin
  def find_project_and_authorize
    if params[:project_id].present?
      @project = Project.find(params[:project_id])
      unless User.current.allowed_to?(:manage_checklist_templates, @project)
        return render_403
      end
    else
      @project = nil
      require_admin
    end
  end

  def find_template
    scope = @project ? ChecklistTemplate.for_project(@project) : ChecklistTemplate.global
    @template = scope.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  # Templates in the current scope
  def template_scope
    @project ? ChecklistTemplate.for_project(@project) : ChecklistTemplate.global
  end

  # Scope-aware redirect target for index
  def templates_index_path
    @project ? project_checklist_templates_path(@project) : checklist_templates_path
  end

  def template_params
    params.require(:checklist_template).permit(
      :name, :category_id, :tracker_id, :is_default, :is_public, :template_text
    )
  end
end
