class OutfitsController < ApplicationController
  before_action :require_login
  before_action :set_outfit, only: %i[ show update destroy ]

  def index
    outfits = current_user.outfits.includes(:clothing_items).order(created_at: :desc)
    render json: outfits.map { |outfit| payloads.outfit(outfit) }
  end

  def show
    render json: payloads.outfit(@outfit)
  end

  def create
    outfit = current_user.outfits.new
    persist_outfit(outfit, status: :created)
  end

  def update
    persist_outfit(@outfit)
  end

  def destroy
    @outfit.destroy
    head :no_content
  end

  private

  def set_outfit
    @outfit = current_user.outfits.includes(:clothing_items).find(params[:id])
  end

  def outfit_params
    params.require(:outfit).permit(:name, :notes, tags: [], item_ids: [])
  end

  def outfit_attributes
    outfit_params.slice(:name, :notes, :tags)
  end

  def persist_outfit(outfit, status: :ok)
    outfit.assign_attributes(outfit_attributes)
    assign_items(outfit)

    if outfit.errors.empty? && outfit.save
      render json: payloads.outfit(outfit), status: status
    else
      render_validation_errors(outfit)
    end
  end

  def assign_items(outfit)
    return unless outfit_params.key?(:item_ids)

    item_ids = Array(outfit_params[:item_ids]).reject(&:blank?).map(&:to_i).uniq
    items = current_user.clothing_items.where(id: item_ids)

    if items.size != item_ids.size
      outfit.errors.add(:item_ids, "contain items you do not own")
      return
    end

    outfit.clothing_items = items
  end
end
