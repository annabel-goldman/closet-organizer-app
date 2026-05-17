class ApplicationController < ActionController::API
  include ActionController::Cookies

  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
  before_action :set_cors_headers

  private

  def set_cors_headers
    origin = request.headers["Origin"]
    return if origin.blank?
    return unless allowed_origins.include?(origin)

    headers["Access-Control-Allow-Origin"] = origin
    headers["Vary"] = "Origin"
    headers["Access-Control-Allow-Credentials"] = "true"
    headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    headers["Access-Control-Allow-Headers"] = "Origin, Content-Type, Accept, Authorization"
  end

  def allowed_origins
    frontend_port = ENV.fetch("FRONTEND_PORT", "5173")
    configured_origins = ENV.fetch("ALLOWED_ORIGINS", "")
      .split(",")
      .map(&:strip)
      .reject(&:blank?)

    @allowed_origins ||= [
      "http://localhost:#{frontend_port}",
      "http://127.0.0.1:#{frontend_port}",
      request.base_url,
      *configured_origins
    ].compact.uniq
  end

  def render_not_found(exception)
    render json: { error: exception.message }, status: :not_found
  end

  def render_validation_errors(record)
    render json: { errors: record.errors.full_messages }, status: :unprocessable_content
  end

  def current_user
    return @current_user if defined?(@current_user)

    @current_user = User.find_by(id: test_user_id || session[:user_id])
  end

  def logged_in?
    current_user.present?
  end

  def admin?
    current_user&.admin?
  end

  def require_login
    return if logged_in?

    render_unauthorized("Please sign in with Google.")
  end

  def require_admin
    return if admin?

    render_forbidden("You're not authorized to view this page.")
  end

  def render_unauthorized(message = "Unauthorized")
    render json: { error: message }, status: :unauthorized
  end

  def render_forbidden(message = "Forbidden")
    render json: { error: message }, status: :forbidden
  end

  def payloads
    @payloads ||= ApiPayloads.new(url_helpers: self)
  end

  def ai_metadata_context_from_params(raw_params)
    values = raw_params.respond_to?(:to_unsafe_h) ? raw_params.to_unsafe_h : raw_params
    values = values.to_h if values.respond_to?(:to_h)
    values ||= {}

    tags = TagListNormalizer.call(values["tags"] || values[:tags])

    {
      category: values["category"] || values[:category],
      name: values["name"] || values[:name],
      brand: values["brand"] || values[:brand],
      size: values["size"] || values[:size],
      date: values["date"] || values[:date],
      tags: tags
    }.compact_blank
  end

  def clothing_item_ai_metadata_context(clothing_item)
    {
      category: clothing_item.category,
      name: clothing_item.name,
      brand: clothing_item.brand,
      size: clothing_item.size,
      date: clothing_item.date&.to_date&.iso8601,
      tags: TagListNormalizer.call(clothing_item.tags)
    }.compact_blank
  end

  def outfit_detection_ai_metadata_context(outfit_detection)
    details = outfit_detection.details || {}

    {
      category: outfit_detection.category,
      name: outfit_detection.suggested_name.presence || outfit_detection.category.to_s.titleize,
      tags: TagListNormalizer.call([
        details["dominant_color"],
        details["material_guess"],
        details["style_guess"],
        outfit_detection.category
      ])
    }.compact_blank
  end

  def test_user_id
    return unless Rails.env.test?

    request.headers["X-Test-User-Id"].presence
  end
end
