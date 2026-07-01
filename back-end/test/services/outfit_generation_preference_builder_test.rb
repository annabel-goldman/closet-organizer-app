require "test_helper"

class OutfitGenerationPreferenceBuilderTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
    @outfit = outfits(:one)
    @generated_item = clothing_items(:one)
    @cream_skirt = create_item("White Mini Skirt with Flap Pockets", %w[white cream skirt pockets])
    @chain_bag = create_item("Beige Textured Chain Strap Bag", %w[beige textured chain bag])
  end

  test "summarizes edited generated outfits as preferred substitutions" do
    run = create_run(generated_item_ids: [ @generated_item.id ])
    run.record_save_event!(final_item_ids: [ @cream_skirt.id, @chain_bag.id ])

    context = OutfitGenerationPreferenceBuilder.call(user: @user)

    assert_includes context["preferred_item_ids"], @cream_skirt.id
    assert_includes context["preferred_item_ids"], @chain_bag.id
    assert_includes context["avoided_item_ids"], @generated_item.id
    assert_includes context["preferred_terms"], "cream"
    assert context["examples"].any? { |example| example.include?("adding White Mini Skirt with Flap Pockets") }
  end

  test "treats deleted generated outfits as weak negative feedback" do
    run = create_run(generated_item_ids: [ @generated_item.id ])
    run.record_deleted!

    context = OutfitGenerationPreferenceBuilder.call(user: @user)

    assert_includes context["avoided_item_ids"], @generated_item.id
    assert_not_includes context["preferred_item_ids"], @generated_item.id
    assert context["examples"].any? { |example| example.include?("weak negative feedback") }
  end

  private

  def create_item(name, tags)
    ClothingItem.create!(
      user: @user,
      name: name,
      size: :na,
      category: "bottom",
      tags: tags
    )
  end

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
