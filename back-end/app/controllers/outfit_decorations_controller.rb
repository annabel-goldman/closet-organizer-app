class OutfitDecorationsController < ApplicationController
  before_action :require_login
  before_action :set_outfit
  before_action :set_placement, only: %i[update destroy]

  def create
    decoration = current_user.decorations.find(placement_params[:decoration_id])
    placement = @outfit.outfit_decorations.new(placement_params.except(:decoration_id))
    placement.decoration = decoration

    if placement.save
      render json: payloads.outfit_decoration(placement), status: :created
    else
      render_validation_errors(placement)
    end
  end

  def update
    if @placement.update(placement_params.except(:decoration_id))
      render json: payloads.outfit_decoration(@placement)
    else
      render_validation_errors(@placement)
    end
  end

  def destroy
    @placement.destroy!
    head :no_content
  end

  private

  def set_outfit
    @outfit = current_user.outfits.find(params[:outfit_id])
  end

  def set_placement
    @placement = @outfit.outfit_decorations.find(params[:id])
  end

  def placement_params
    params.require(:decoration).permit(:decoration_id, :x, :y, :width, :rotation, :layer_order)
  end
end
