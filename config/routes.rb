resources :issues do
  resources :checklist_items, only: [:index, :create, :update, :destroy] do
    member do
      patch :done
    end
    collection do
      post :reorder
      post :apply_template
    end
  end
end

# Global (admin) template + category management
resources :checklist_templates
resources :checklist_template_categories

# Project-scoped template management
resources :projects do
  resources :checklist_templates, only: [:index, :new, :create, :edit, :update, :destroy]
end
