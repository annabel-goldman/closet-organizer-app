class UsersController < ApplicationController
  before_action :require_login
  before_action :require_admin, only: %i[index show]
  before_action :set_user, only: %i[ show update destroy ]

  DEFAULT_PER_PAGE = 24
  MAX_PER_PAGE = 100

  def index
    scope = User.order(:username)
    page = scope.page(params[:page]).per(resolved_per_page)

    render json: {
      users: page.map { |user| payloads.user(user, include_items: false) },
      meta: {
        page: page.current_page,
        per_page: page.limit_value,
        total_pages: page.total_pages,
        total_count: page.total_count
      }
    }
  end

  def show
    render json: payloads.user(@user)
  end

  def create
    render_unauthorized("User creation is handled through Google sign-in.")
  end

  def update
    if @user.update(user_params)
      render json: payloads.user(@user)
    else
      render_validation_errors(@user)
    end
  end

  def destroy
    @user.destroy
    head :no_content
  end

  private

  def set_user
    @user = admin? ? User.find(params[:id]) : current_user
  end

  def user_params
    permitted = params.require(:user).permit(:username, :preferred_style, :password, :password_confirmation)

    if permitted[:password].blank? && permitted[:password_confirmation].blank?
      permitted.except(:password, :password_confirmation)
    else
      permitted
    end
  end

  def resolved_per_page
    raw = params[:per_page].presence&.to_i
    return DEFAULT_PER_PAGE if raw.blank? || raw <= 0

    [ raw, MAX_PER_PAGE ].min
  end
end
