class ChecklistProjectSettingsController < ApplicationController
  before_action :find_project_and_authorize

  def update
    @setting = ChecklistProjectSetting.find_or_initialize_by(project_id: @project.id)
    @setting.enforce_mode = params.dig(:checklist_project_setting, :enforce_mode)
    @setting.status_ids   = params.dig(:checklist_project_setting, :status_ids) || []
    if @setting.save
      flash[:notice] = l(:notice_successful_update)
    else
      flash[:error] = @setting.errors.full_messages.join(', ')
    end
    redirect_to project_checklist_templates_path(@project)
  end

  private

  def find_project_and_authorize
    @project = Project.find(params[:project_id])
    render_403 unless User.current.allowed_to?(:manage_checklist_enforcement, @project)
  rescue ActiveRecord::RecordNotFound
    render_404
  end
end
