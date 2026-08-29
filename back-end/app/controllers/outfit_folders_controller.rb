class OutfitFoldersController < ApplicationController
  before_action :require_login
  before_action :set_outfit_folder, only: %i[show update destroy]

  def index
    folders = current_user.outfit_folders
      .includes(decorations: { image_attachment: :blob }, outfits: [ :outfit_generation_run, :ai_workflows, { outfit_items: :clothing_item } ])
      .order(created_at: :desc)
    render json: folders.map { |folder| payloads.outfit_folder(folder) }
  end

  def show
    render json: payloads.outfit_folder(@outfit_folder)
  end

  def create
    persist_folder(current_user.outfit_folders.new, status: :created)
  end

  def update
    persist_folder(@outfit_folder)
  end

  def destroy
    @outfit_folder.destroy!
    head :no_content
  end

  private

  def set_outfit_folder
    @outfit_folder = current_user.outfit_folders.find(params[:id])
  end

  def outfit_folder_params
    params.require(:outfit_folder).permit(:name, :occasion, :notes, outfit_ids: [])
  end

  def persist_folder(folder, status: :ok)
    folder.assign_attributes(outfit_folder_params.slice(:name, :occasion, :notes))
    outfit_ids = requested_outfit_ids
    validate_owned_outfits(folder, outfit_ids) if outfit_ids

    if folder.errors.any?
      render_validation_errors(folder)
      return
    end

    OutfitFolder.transaction do
      folder.save!
      replace_memberships!(folder, outfit_ids) if outfit_ids
    end

    render json: payloads.outfit_folder(folder.reload), status: status
  rescue ActiveRecord::RecordInvalid => error
    render_validation_errors(error.record)
  end

  def requested_outfit_ids
    return unless outfit_folder_params.key?(:outfit_ids)

    Array(outfit_folder_params[:outfit_ids]).reject(&:blank?).map(&:to_i).uniq
  end

  def validate_owned_outfits(folder, outfit_ids)
    return if current_user.outfits.where(id: outfit_ids).count == outfit_ids.length

    folder.errors.add(:outfit_ids, "can only include outfits you own")
  end

  def replace_memberships!(folder, outfit_ids)
    folder.memberships.delete_all
    outfit_ids.each_with_index do |outfit_id, position|
      folder.memberships.create!(outfit_id: outfit_id, position: position)
    end

    allowed_page_keys = [ "cover", *outfit_ids.map { |outfit_id| "outfit:#{outfit_id}" } ]
    folder.decorations.where.not(page_key: allowed_page_keys).destroy_all
  end
end
