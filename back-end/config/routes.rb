Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  match "/auth/:provider/callback", to: "sessions#create", via: %i[ get post ]
  get "/auth/failure", to: "sessions#failure"

  get "users", to: "fallback#index", constraints: ->(req) { !req.xhr? && req.format.html? }
  get "users/:id", to: "fallback#index", constraints: ->(req) { !req.xhr? && req.format.html? }

  scope defaults: { format: :json } do
    root "clothing_items#index"
    get "me", to: "sessions#me"
    delete "session", to: "sessions#destroy"
    get "ai/status", to: "ai_status#show"
    resources :ai_workflows, only: %i[create show] do
      post :cancel, on: :member
      patch :preview, action: :update_preview, on: :member
      delete :preview, action: :destroy_preview, on: :member
      resources :stages, only: [], controller: :ai_workflows do
        post :approve, on: :member
        post :reject, on: :member
      end
    end

    resources :users, except: %i[new edit]
    delete "me/model_reference", to: "model_reference_images#destroy_all"
    resources :model_reference_images, only: %i[create destroy] do
      get :photo, on: :member
      patch :reorder, on: :collection
    end
    resources :clothing_items, except: %i[new edit] do
      post :generate_clean_image, on: :member
      post :generate_metadata_suggestions, on: :member
      post :generate_modeled_image, on: :member, controller: :modeled_images, action: :create
    end
    resources :outfits, except: %i[new edit] do
      post :generate, on: :collection
      post :generate_metadata_suggestions, on: :collection
      post :generate_metadata_suggestions, on: :member
      post :generate_modeled_image, on: :member, controller: :modeled_outfit_images, action: :create
    end
    resources :outfit_folders, except: %i[new edit] do
      post :generate_metadata_suggestions, on: :collection
      post :generate_metadata_suggestions, on: :member
      resources :decorations,
        only: %i[create update destroy],
        controller: :outfit_folder_decorations
    end
    resources :outfit_uploads, only: %i[create show]
    resources :outfit_detections, only: [] do
      post :generate_clean_image, on: :member
      post :generate_metadata_suggestions, on: :member
    end
    resources :image_variants, only: [] do
      post :metadata_suggestions, on: :collection
      post :preview, on: :collection
    end
  end

  get "*path", to: "fallback#index", constraints: ->(req) { !req.xhr? && req.format.html? }
end
