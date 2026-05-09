class OutfitUploadsController < ApplicationController
  before_action :require_login
  before_action :set_outfit_upload, only: :show

  def create
    @outfit_upload = OutfitUpload.new(outfit_upload_params)

    if @outfit_upload.save
      begin
        OutfitUploadAnalysisJob.perform_later(@outfit_upload.id)
      rescue StandardError => error
        @outfit_upload.update!(status: :failed, error_message: error.message)
      end

      render json: payloads.outfit_upload(@outfit_upload.reload), status: :created
    else
      render_validation_errors(@outfit_upload)
    end
  end

  def show
    render json: payloads.outfit_upload(@outfit_upload)
  end

  private

  def set_outfit_upload
    @outfit_upload = current_user.outfit_uploads.find(params[:id])
  end

  def outfit_upload_params
    params.require(:outfit_upload).permit(:source_photo).merge(user: current_user)
  end
end
