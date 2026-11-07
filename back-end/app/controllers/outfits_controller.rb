class OutfitsController < ApplicationController
  before_action :require_login
  before_action :set_outfit,
    only: %i[ show update destroy generate_metadata_suggestions ],
    if: -> { params[:id].present? }

  def index
    outfits = current_user.outfits.includes(
      :outfit_recommendation_option,
      { ai_workflows: { stages: { artifacts: { file_attachment: :blob } } } },
      { outfit_items: { clothing_item: [
        { photo_attachment: :blob },
        { cleaned_photo_attachment: :blob },
        { image_versions: { image_attachment: :blob } }
      ] } },
      outfit_decorations: { decoration: { image_attachment: :blob } }
    ).order(created_at: :desc)
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

  def generate_metadata_suggestions
    suggestion_params = outfit_metadata_suggestion_params
    items = metadata_suggestion_items(suggestion_params)
    return if performed?

    render json: OpenrouterOutfitMetadataSuggester.call(
      items: items,
      current_metadata: {
        name: suggestion_params[:name].presence || @outfit&.name,
        tags: suggestion_params.key?(:tags) ? suggestion_params[:tags] : (@outfit&.tags || []),
        notes: suggestion_params.key?(:notes) ? suggestion_params[:notes] : @outfit&.notes
      }
    )
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  end

  def destroy
    recommendation_option = @outfit.outfit_recommendation_option

    Outfit.transaction do
      @outfit.destroy!
      if recommendation_option
        current_user.outfit_recommendation_feedback_events.create!(
          outfit_recommendation_run: recommendation_option.outfit_recommendation_run,
          outfit_recommendation_option: recommendation_option,
          event_type: "delete_after_save",
          metadata: { "source" => "saved_outfit_delete" }
        )
      end
    end
    OutfitPreferenceProfileBuilder.call(current_user, refresh: true) if recommendation_option
    head :no_content
  end

  private

  def set_outfit
    @outfit = current_user.outfits.includes(
      :outfit_recommendation_option,
      { ai_workflows: { stages: { artifacts: { file_attachment: :blob } } } },
      { outfit_items: { clothing_item: [
        { photo_attachment: :blob },
        { cleaned_photo_attachment: :blob },
        { image_versions: { image_attachment: :blob } }
      ] } },
      outfit_decorations: { decoration: { image_attachment: :blob } }
    ).find(params[:id])
  end

  def outfit_params
    params.require(:outfit).permit(
      :name,
      :notes,
      :recommendation_option_id,
      tags: [],
      item_ids: [],
      item_layouts: %i[item_id x y width height rotation layer_order]
    )
  end

  def outfit_metadata_suggestion_params
    params.fetch(:outfit, ActionController::Parameters.new).permit(:name, :notes, tags: [], item_ids: [])
  end

  def metadata_suggestion_items(suggestion_params)
    item_ids = if suggestion_params.key?(:item_ids)
      Array(suggestion_params[:item_ids]).reject(&:blank?).map(&:to_i).uniq
    else
      @outfit.outfit_items.sort_by { |outfit_item| [ outfit_item.layer_order, outfit_item.id ] }.map(&:clothing_item_id)
    end

    if item_ids.empty?
      render json: { error: "Add at least one item before filling outfit details." }, status: :unprocessable_content
      return []
    end

    items_by_id = current_user.clothing_items.where(id: item_ids).index_by(&:id)
    if items_by_id.length != item_ids.length
      render json: { error: "Outfit details can only use items from your closet." }, status: :unprocessable_content
      return []
    end

    item_ids.map { |item_id| items_by_id.fetch(item_id) }
  end

  def outfit_attributes
    outfit_params.slice(:name, :notes, :tags)
  end

  def persist_outfit(outfit, status: :ok)
    previous_item_ids = outfit.persisted? ? outfit.clothing_item_ids : []
    existing_option = outfit.outfit_recommendation_option
    outfit.assign_attributes(outfit_attributes)
    assign_items(outfit)
    assign_item_layouts(outfit)

    if outfit.errors.empty? && outfit.save
      record_recommendation_learning!(
        outfit,
        existing_option: existing_option,
        previous_item_ids: previous_item_ids
      )
      render json: payloads.outfit(outfit), status: status
    else
      render_validation_errors(outfit)
    end
  end

  def record_recommendation_learning!(outfit, existing_option:, previous_item_ids:)
    option = existing_option || recommendation_option_from_params
    return unless option

    events = []
    if existing_option.nil?
      option.update!(outfit: outfit)
      events << { event_type: "save", outfit_recommendation_option: option }
    else
      added_ids = outfit.clothing_item_ids - previous_item_ids
      removed_ids = previous_item_ids - outfit.clothing_item_ids
      added_ids.each { |id| events << { event_type: "add_after_save", clothing_item_id: id } }
      removed_ids.each { |id| events << { event_type: "remove_after_save", clothing_item_id: id } }
    end
    return if events.empty?

    events.each do |attributes|
      current_user.outfit_recommendation_feedback_events.create!(
        attributes.merge(
          outfit_recommendation_run: option.outfit_recommendation_run,
          outfit_recommendation_option: attributes[:outfit_recommendation_option] || option
        )
      )
    end
    OutfitPreferenceProfileBuilder.call(current_user, refresh: true)
  end

  def recommendation_option_from_params
    option_id = outfit_params[:recommendation_option_id]
    return if option_id.blank?

    OutfitRecommendationOption.joins(:outfit_recommendation_run)
      .where(outfit_recommendation_runs: { user_id: current_user.id })
      .find(option_id)
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
