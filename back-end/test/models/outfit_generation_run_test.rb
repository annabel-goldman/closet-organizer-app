require "test_helper"

class OutfitGenerationRunTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
    @outfit = outfits(:one)
    @generated_item = clothing_items(:one)
    @added_item = ClothingItem.create!(
      user: @user,
      name: "Cream Mini Skirt",
      size: :na,
      category: "bottom"
    )
  end

  test "records generated outfit lifecycle events" do
    run = create_run(generated_item_ids: [ @generated_item.id ])

    assert_difference("OutfitGenerationEvent.count", 2) do
      run.record_generated!
      run.record_opened_for_edit!
    end

    assert_equal %w[generated opened_for_edit], run.outfit_generation_events.order(:created_at).pluck(:event_type)
  end

  test "computes item correction payloads from a saved edit" do
    run = create_run(generated_item_ids: [ @generated_item.id ])

    run.record_save_event!(final_item_ids: [ @added_item.id ])

    event = run.outfit_generation_events.last
    assert_equal "saved_with_item_changes", event.event_type
    assert_equal [ @added_item.id ], event.added_item_ids
    assert_equal [ @generated_item.id ], event.removed_item_ids
    assert_empty event.kept_item_ids
  end

  test "generation run survives outfit deletion" do
    run = create_run(generated_item_ids: [ @generated_item.id ])

    @outfit.destroy!

    assert_nil run.reload.outfit_id
  end

  private

  def create_run(generated_item_ids:)
    OutfitGenerationRun.create!(
      user: @user,
      outfit: @outfit,
      candidate_item_ids: generated_item_ids,
      generated_item_ids: generated_item_ids,
      generator_version: OpenrouterOutfitGenerator::GENERATOR_VERSION,
      generated_at: Time.current
    )
  end
end
