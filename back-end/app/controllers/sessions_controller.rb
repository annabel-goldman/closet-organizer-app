class SessionsController < ApplicationController
  def create
    auth_hash = request.env["omniauth.auth"]
    if auth_hash.blank?
      redirect_to frontend_login_redirect(error: "google_auth_failed")
      return
    end

    user = User.from_google_auth(auth_hash)
    reset_session
    session[:user_id] = user.id

    redirect_to frontend_closet_redirect
  rescue User::UnauthorizedGoogleEmailError
    redirect_to frontend_login_redirect(error: "unauthorized_account")
  rescue ActiveRecord::RecordInvalid
    redirect_to frontend_login_redirect(error: "signin_failed")
  end

  def failure
    redirect_to frontend_login_redirect(error: params[:message].presence || "auth_cancelled")
  end

  def me
    return render_unauthorized unless logged_in?

    render json: payloads.user(current_user)
  end

  def destroy
    reset_session
    head :no_content
  end

  private

  def frontend_base_url
    configured_base_url = ENV["FRONTEND_BASE_URL"]&.strip
    return configured_base_url if configured_base_url.present?

    host = ENV["FRONTEND_HOST"]&.strip
    return request.base_url if host.blank?

    port = ENV["FRONTEND_PORT"]&.strip
    scheme = ENV.fetch("FRONTEND_SCHEME", "http")

    return "#{scheme}://#{host}" if port.blank?

    "#{scheme}://#{host}:#{port}"
  end

  def frontend_closet_redirect
    "#{frontend_base_url}/closet"
  end

  def frontend_login_redirect(error:)
    "#{frontend_base_url}/?auth_error=#{CGI.escape(error)}"
  end
end
