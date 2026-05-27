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

    resources :users, except: %i[new edit]
    resources :clothing_items, except: %i[new edit] do
      post :generate_clean_image, on: :member
      post :generate_transparent_png, on: :member
      post :generate_metadata_suggestions, on: :member
    end
    resources :outfits, except: %i[new edit]
    resources :outfit_uploads, only: %i[create show]
    resources :outfit_detections, only: [] do
      post :generate_clean_image, on: :member
      post :generate_transparent_png, on: :member
      post :generate_metadata_suggestions, on: :member
    end
    resources :image_variants, only: [] do
      post :metadata_suggestions, on: :collection
      post :preview, on: :collection
      post :transparent_preview, on: :collection
    end
  end

  get "*path", to: "fallback#index", constraints: ->(req) { !req.xhr? && req.format.html? }
end
