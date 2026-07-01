resources :issues do
  resources :checklist_items, only: [:index, :create, :update, :destroy] do
    member do
      patch :done
      get   :convert
    end
    collection do
      post :reorder
      post :apply_template
    end
  end
end

# Global (admin) template + category management.
# Categories live UNDER the templates section (/checklist_templates/categories/...)
# rather than as a flat sibling. Declared before `resources :checklist_templates`
# so /checklist_templates/categories does not get captured as a template :show.
# The `as:` keeps the existing checklist_template_category(_ies) route helpers.
scope 'checklist_templates' do
  resources :categories,
            controller: 'checklist_template_categories',
            as: 'checklist_template_categories'
end
resources :checklist_templates

# Project-scoped template management + per-project enforcement override
resources :projects do
  resources :checklist_templates, only: [:index, :new, :create, :edit, :update, :destroy]
  resource :checklist_settings, only: [:update],
           controller: 'checklist_project_settings'
end
