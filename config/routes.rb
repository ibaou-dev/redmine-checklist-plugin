resources :issues do
  resources :checklist_items, only: [:index, :create, :update, :destroy] do
    collection do
      post :reorder
    end
  end
end
