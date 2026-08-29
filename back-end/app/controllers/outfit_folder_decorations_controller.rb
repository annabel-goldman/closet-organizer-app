class OutfitFolderDecorationsController < ApplicationController
  before_action :require_login
  before_action :set_outfit_folder
  before_action :set_decoration, only: %i[update destroy]

  def create
    decoration = @outfit_folder.decorations.new(decoration_params.except(:image))
    decoration.image.attach(decoration_params[:image]) if decoration_params[:image].present?

    if decoration.save
      render json: payloads.outfit_folder_decoration(decoration), status: :created
    else
      render_validation_errors(decoration)
    end
  end

  def update
    if @decoration.update(decoration_params.except(:image))
      render json: payloads.outfit_folder_decoration(@decoration)
    else
      render_validation_errors(@decoration)
    end
  end

  def destroy
    @decoration.destroy!
    head :no_content
  end

  private

  def set_outfit_folder
    @outfit_folder = current_user.outfit_folders.find(params[:outfit_folder_id])
  end

  def set_decoration
    @decoration = @outfit_folder.decorations.find(params[:id])
  end

  def decoration_params
    params.require(:decoration).permit(:image, :page_key, :x, :y, :width, :rotation, :layer_order)
  end
end
