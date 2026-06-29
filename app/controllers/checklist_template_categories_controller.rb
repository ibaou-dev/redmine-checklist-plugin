class ChecklistTemplateCategoriesController < ApplicationController
  before_action :require_admin
  before_action :find_category, only: [:edit, :update, :destroy]

  # GET /checklist_template_categories
  def index
    @categories = ChecklistTemplateCategory.ordered
  end

  # GET /checklist_template_categories/new
  def new
    @category = ChecklistTemplateCategory.new
  end

  # POST /checklist_template_categories
  def create
    @category = ChecklistTemplateCategory.new(category_params)
    if @category.save
      flash[:notice] = l(:notice_successful_create)
      redirect_to checklist_template_categories_path
    else
      render :new
    end
  end

  # GET /checklist_template_categories/:id/edit
  def edit
  end

  # PATCH /checklist_template_categories/:id
  def update
    if @category.update(category_params)
      flash[:notice] = l(:notice_successful_update)
      redirect_to checklist_template_categories_path
    else
      render :edit
    end
  end

  # DELETE /checklist_template_categories/:id
  def destroy
    @category.destroy
    flash[:notice] = l(:notice_successful_delete)
    redirect_to checklist_template_categories_path
  end

  private

  def find_category
    @category = ChecklistTemplateCategory.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  def category_params
    params.require(:checklist_template_category).permit(:name, :position)
  end
end
