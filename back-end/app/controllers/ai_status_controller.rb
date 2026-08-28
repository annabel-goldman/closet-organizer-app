class AiStatusController < ApplicationController
  before_action :require_login

  def show
    render json: {
      provider: "openrouter",
      configured: ENV["OPENROUTER_API_KEY"].present?,
      model: ENV.fetch("OPENROUTER_MODEL", "openai/gpt-4.1-mini"),
      model_reference: {
        attached: current_user.model_reference_images.exists?,
        count: current_user.model_reference_images.count,
        consented: current_user.model_reference_consent_at.present?
      },
      image_processing: {
        image_processing_gem: defined?(ImageProcessing).present?,
        mini_magick: defined?(MiniMagick).present?,
        vips: defined?(Vips).present?
      },
      queue_adapter: Rails.application.config.active_job.queue_adapter.to_s
    }
  end
end
