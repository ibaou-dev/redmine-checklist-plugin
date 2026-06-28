resources :issues do
  resources :checklist_items, only: [:index, :create, :update, :destroy] do
    member do
      patch :done
    end
    collection do
      post :reorder
    end
  end
end
