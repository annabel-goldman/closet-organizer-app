class ModelReferenceImagesController < ApplicationController
  before_action :require_login
  before_action :set_reference_image, only: %i[destroy photo]

  def create
    photos = Array(params.dig(:model_reference_images, :photos)).compact
    if photos.empty?
      render json: { error: "Choose at least one reference photo." }, status: :unprocessable_content
      return
    end

    current_count = current_user.model_reference_images.count
    if current_count + photos.length > ModelReferenceImage::MAX_REFERENCES
      render json: { error: "You can save up to #{ModelReferenceImage::MAX_REFERENCES} model reference photos." }, status: :unprocessable_content
      return
    end

    ModelReferenceImage.transaction do
      next_position = current_user.model_reference_images.maximum(:position).to_i
      next_position += 1 if current_count.positive?

      photos.each_with_index do |uploaded_photo, index|
        reference_image = current_user.model_reference_images.build(position: next_position + index)
        reference_image.photo.attach(uploaded_photo)
        reference_image.save!
      end

      current_user.update!(model_reference_consent_at: Time.current)
    end

    render json: user_payload, status: :created
  rescue ActiveRecord::RecordInvalid => error
    render_validation_errors(error.record)
  end

  def reorder
    ordered_ids = Array(params[:reference_image_ids]).map(&:to_i)
    references = current_user.model_reference_images.ordered.to_a

    unless ordered_ids.length == references.length && ordered_ids.sort == references.map(&:id).sort
      render json: { error: "Reference order must include each saved photo exactly once." }, status: :unprocessable_content
      return
    end

    ModelReferenceImage.transaction do
      current_user.model_reference_images.update_all("position = position + 100")
      ordered_ids.each_with_index do |id, position|
        current_user.model_reference_images.find(id).update!(position: position)
      end
    end

    render json: user_payload
  end

  def destroy
    @reference_image.destroy!
    compact_positions!
    clear_consent_without_references!
    render json: user_payload
  end

  def destroy_all
    current_user.model_reference_images.destroy_all
    current_user.update!(model_reference_consent_at: nil)
    render json: user_payload
  end

  def photo
    unless @reference_image.photo.attached?
      head :not_found
      return
    end

    response.headers["Cache-Control"] = "private, max-age=300"
    send_data(
      @reference_image.photo.download,
      filename: @reference_image.photo.filename.to_s,
      type: @reference_image.photo.content_type,
      disposition: "inline"
    )
  end

  private

  def set_reference_image
    @reference_image = current_user.model_reference_images.find(params[:id])
  end

  def compact_positions!
    ModelReferenceImage.transaction do
      current_user.model_reference_images.update_all("position = position + 100")
      current_user.model_reference_images.ordered.each_with_index do |reference_image, position|
        reference_image.update!(position: position)
      end
    end
  end

  def clear_consent_without_references!
    current_user.update!(model_reference_consent_at: nil) unless current_user.model_reference_images.exists?
  end

  def user_payload
    payloads.user(current_user.reload, include_model_references: true)
  end
end
