class OutfitGenerationJob < ApplicationJob
  queue_as :ai

  def perform(workflow_id)
    workflow = AiWorkflow.includes(:stages, :user).find(workflow_id)
    return if workflow.cancelled? || workflow.succeeded? || workflow.failed?

    items = workflow.user.clothing_items
      .with_attached_photo
      .with_attached_cleaned_photo
      .where(id: Array(workflow.metadata["item_ids"]))
      .to_a
      .shuffle
    raise "Add closet items before generating an outfit." if items.empty?

    curate_stage = nil
    save_stage = nil
    workflow.with_lock do
      return if workflow.cancelled?

      workflow.mark_processing!
      curate_stage = workflow.stage("curate")
      save_stage = workflow.stage("save")
      curate_stage.processing!
      save_stage.update!(status: "pending", error_message: nil)
    end

    suggestion = OpenrouterOutfitGenerator.call(
      items: items,
      occasion: workflow.metadata["occasion"],
      reference_photo: workflow.input_file.attached? ? workflow.input_file : nil,
      user: workflow.user
    )

    workflow.with_lock do
      return if workflow.cancelled?

      outfit = build_outfit(workflow, suggestion)
      raise "AI generator did not return any owned closet items." if outfit.clothing_items.empty?

      outfit.save!
      record_generation_run!(workflow, outfit, suggestion)
      workflow.update!(
        subject: outfit,
        completed_count: 1,
        metadata: workflow.metadata.merge(
          "outfit_id" => outfit.id,
          "result_name" => outfit.name
        )
      )
      curate_stage.auto_approve!
      save_stage.auto_approve!
      workflow.mark_succeeded!
    end
  rescue StandardError => error
    return if workflow&.reload&.cancelled?

    workflow&.stages&.each { |stage| stage.fail!(error.message) if stage.status.in?(%w[pending processing]) }
    workflow&.mark_failed!(error.message)
    Rails.logger.error("Outfit generation workflow #{workflow_id} failed: #{error.class}: #{error.message}")
  ensure
    workflow&.input_file&.purge if workflow&.input_file&.attached? && workflow.status.in?(%w[succeeded failed cancelled])
  end

  private

  def build_outfit(workflow, suggestion)
    item_ids = Array(suggestion[:item_ids]).map(&:to_i).uniq
    items_by_id = workflow.user.clothing_items.where(id: item_ids).index_by(&:id)
    selected_items = item_ids.filter_map { |item_id| items_by_id[item_id] }
    outfit = workflow.user.outfits.new(
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

  def record_generation_run!(workflow, outfit, suggestion)
    generated_item_ids = Array(suggestion[:item_ids]).map(&:to_i).uniq
    run = workflow.user.outfit_generation_runs.create!(
      outfit: outfit,
      occasion: workflow.metadata["occasion"],
      reference_profile: suggestion[:reference_profile],
      candidate_item_ids: Array(suggestion[:candidate_item_ids]).map(&:to_i).uniq.presence || generated_item_ids,
      generated_item_ids: generated_item_ids,
      generator_version: suggestion[:generator_version].presence || OpenrouterOutfitGenerator::GENERATOR_VERSION,
      generated_at: Time.current
    )
    run.record_generated!
    run.record_opened_for_edit!
  end
end
