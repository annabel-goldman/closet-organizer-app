class OutfitsController < ApplicationController
  before_action :require_login
  before_action :set_outfit, only: %i[ show update destroy ]

  def index
    outfits = current_user.outfits.includes(:outfit_generation_run, outfit_items: :clothing_item).order(created_at: :desc)
    render json: outfits.map { |outfit| payloads.outfit(outfit) }
  end

  def show
    render json: payloads.outfit(@outfit)
  end

  def create
    outfit = current_user.outfits.new
    persist_outfit(outfit, status: :created)
  end

  def generate
    items = current_user
      .clothing_items
      .with_attached_photo
      .with_attached_cleaned_photo
      .to_a
      .shuffle
    if items.empty?
      render json: { error: "Add closet items before generating an outfit." }, status: :unprocessable_content
      return
    end

    suggestion = OpenrouterOutfitGenerator.call(
      items: items,
      occasion: params[:occasion],
      reference_photo: params[:reference_photo],
      user: current_user
    )

    outfit = build_generated_outfit(suggestion)
    if outfit.clothing_items.empty?
      render json: { error: "AI generator did not return any owned closet items." }, status: :unprocessable_content
      return
    end

    if outfit.save
      record_generation_run!(outfit, suggestion)
      render json: payloads.outfit(outfit), status: :created
    else
      render_validation_errors(outfit)
    end
  rescue OpenrouterOutfitGenerator::GenerationError => error
    render json: outfit_generation_error_payload(error), status: :unprocessable_content
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  end

  def update
    persist_outfit(@outfit)
  end

  def destroy
    @outfit.outfit_generation_run&.record_deleted!
    @outfit.destroy
    head :no_content
  end

  private

  def set_outfit
    @outfit = current_user.outfits.includes(:outfit_generation_run, outfit_items: :clothing_item).find(params[:id])
  end

  def outfit_params
    params.require(:outfit).permit(
      :name,
      :notes,
      tags: [],
      item_ids: [],
      item_layouts: %i[item_id x y width height rotation layer_order]
    )
  end

  def outfit_attributes
    outfit_params.slice(:name, :notes, :tags)
  end

  def persist_outfit(outfit, status: :ok)
    outfit.assign_attributes(outfit_attributes)
    assign_items(outfit)
    assign_item_layouts(outfit)

    if outfit.errors.empty? && outfit.save
      record_generation_save_event(outfit) if outfit.persisted?
      render json: payloads.outfit(outfit), status: status
    else
      render_validation_errors(outfit)
    end
  end

  def build_generated_outfit(suggestion)
    item_ids = Array(suggestion[:item_ids]).map(&:to_i).uniq
    items_by_id = current_user.clothing_items.where(id: item_ids).index_by(&:id)
    selected_items = item_ids.filter_map { |item_id| items_by_id[item_id] }

    outfit = current_user.outfits.new(
      name: suggestion[:name],
      notes: suggestion[:notes],
      tags: suggestion[:tags]
    )
    outfit.clothing_items = selected_items
    outfit.outfit_items.each do |outfit_item|
      next unless (index = item_ids.index(outfit_item.clothing_item_id))

      outfit_item.layer_order = index
    end
    outfit
  end

  def record_generation_run!(outfit, suggestion)
    generated_item_ids = Array(suggestion[:item_ids]).map(&:to_i).uniq
    run = current_user.outfit_generation_runs.create!(
      outfit: outfit,
      occasion: params[:occasion].to_s.strip.presence,
      reference_profile: suggestion[:reference_profile],
      candidate_item_ids: Array(suggestion[:candidate_item_ids]).map(&:to_i).uniq.presence || generated_item_ids,
      generated_item_ids: generated_item_ids,
      generator_version: suggestion[:generator_version].presence || OpenrouterOutfitGenerator::GENERATOR_VERSION,
      generated_at: Time.current
    )
    run.record_generated!
    run.record_opened_for_edit!
  end

  def record_generation_save_event(outfit)
    run = outfit.outfit_generation_run
    return unless run

    ordered_item_ids = outfit.outfit_items.sort_by { |outfit_item| [ outfit_item.layer_order, outfit_item.id ] }.map(&:clothing_item_id)
    run.record_save_event!(final_item_ids: ordered_item_ids)
  end

  def outfit_generation_error_payload(error)
    {
      error: error.message,
      stage: error.stage,
      provider: "openrouter",
      cause_class: error.cause_class,
      cause: error.cause_message
    }.compact
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
    outfit.outfit_items.each do |outfit_item|
      next unless (index = item_ids.index(outfit_item.clothing_item_id))

      outfit_item.layer_order = index
    end
  end

  def assign_item_layouts(outfit)
    return unless outfit_params.key?(:item_layouts)

    layouts = normalized_item_layouts
    return if outfit.errors.any?

    outfit_items_by_item_id = outfit.outfit_items.index_by(&:clothing_item_id)
    item_ids_in_outfit = outfit_items_by_item_id.keys.sort
    layout_item_ids = layouts.map { |layout| layout[:item_id] }.sort

    if layout_item_ids != item_ids_in_outfit
      outfit.errors.add(:item_layouts, "must match the outfit items")
      return
    end

    layer_orders = layouts.map { |layout| layout[:layer_order] }
    if layer_orders.uniq.length != layer_orders.length
      outfit.errors.add(:item_layouts, "must use unique layer positions")
      return
    end

    layouts.each do |layout|
      outfit_item = outfit_items_by_item_id[layout[:item_id]]
      outfit_item.assign_attributes(
        collage_x: layout[:x],
        collage_y: layout[:y],
        collage_width: layout[:width],
        collage_height: layout[:height],
        collage_rotation: layout[:rotation],
        layer_order: layout[:layer_order]
      )
    end
  rescue ArgumentError, TypeError
    outfit.errors.add(:item_layouts, "are invalid")
  end

  def normalized_item_layouts
    Array(outfit_params[:item_layouts]).map do |layout|
      {
        item_id: Integer(layout[:item_id]),
        x: Float(layout[:x]),
        y: Float(layout[:y]),
        width: Float(layout[:width]),
        height: Float(layout[:height]),
        rotation: Float(layout[:rotation] || 0),
        layer_order: Integer(layout[:layer_order])
      }
    end
  end
end
