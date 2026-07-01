require "test_helper"

class OpenrouterOutfitGeneratorTest < ActiveSupport::TestCase
  setup do
    @item = clothing_items(:one)
    @user = users(:one)
  end

  test "uses all closet items directly when the closet fits the visual shortlist" do
    captured = {}
    reference_photo = reference_photo_upload
    reference_profile = reference_profile_fixture
    result = {
      name: "Dinner Look",
      tags: [ "dinner" ],
      notes: "A polished look.",
      item_ids: [ @item.id ]
    }

    with_reference_analyzer_stub(result: reference_profile, capture: {}) do
      with_visual_refiner_stub(result: result, capture: captured) do
        generated = OpenrouterOutfitGenerator.call(
          items: [ @item ],
          occasion: "dinner",
          reference_photo: reference_photo
        )

        assert_equal result[:name], generated[:name]
        assert_equal result[:tags], generated[:tags]
        assert_equal result[:notes], generated[:notes]
        assert_equal result[:item_ids], generated[:item_ids]
        assert_equal [ @item.id ], generated[:candidate_item_ids]
        assert_equal reference_profile, generated[:reference_profile]
        assert_equal OpenrouterOutfitGenerator::GENERATOR_VERSION, generated[:generator_version]
        assert_equal "dinner", captured[:occasion]
        assert_equal reference_photo, captured[:reference_photo]
        assert_equal reference_profile, captured[:reference_profile]
        assert_equal [ @item.id ], captured[:items].map(&:id)
      end
    end
  end

  test "selects text candidates before visual refinement for larger closets" do
    extra_items = 21.times.map do |index|
      ClothingItem.create!(
        user: @user,
        name: "Closet Item #{index}",
        category: "shirt",
        size: :medium
      )
    end
    items = [ @item, *extra_items ]
    candidate_ids = [ extra_items.last.id, @item.id ]
    captured_selector = {}
    captured_refiner = {}
    reference_photo = reference_photo_upload
    reference_profile = reference_profile_fixture
    result = {
      name: "Shortlisted Look",
      tags: [ "shortlist" ],
      notes: "The shortlist worked.",
      item_ids: candidate_ids
    }

    with_reference_analyzer_stub(result: reference_profile) do
      with_candidate_selector_stub(result: candidate_ids, capture: captured_selector) do
        with_visual_refiner_stub(result: result, capture: captured_refiner) do
          generated = OpenrouterOutfitGenerator.call(
            items: items,
            occasion: "gallery",
            reference_photo: reference_photo
          )

          assert_equal result[:name], generated[:name]
          assert_equal result[:item_ids], generated[:item_ids]
          assert_equal captured_refiner[:items].map(&:id), generated[:candidate_item_ids]
          assert_equal "gallery", captured_selector[:occasion]
          assert_equal reference_photo, captured_selector[:reference_photo]
          assert_equal reference_profile, captured_selector[:reference_profile]
          assert_equal 20, captured_selector[:max_candidates]
          assert_equal items.map(&:id), captured_selector[:items].map(&:id)
          assert_includes captured_refiner[:items].map(&:id), extra_items.last.id
          assert_includes captured_refiner[:items].map(&:id), @item.id
          assert_equal reference_photo, captured_refiner[:reference_photo]
          assert_equal reference_profile, captured_refiner[:reference_profile]
        end
      end
    end
  end

  test "preserves strong reference slot matches in the visual shortlist" do
    hoodie = ClothingItem.create!(
      user: @user,
      name: "Olive Wing Graphic Hoodie",
      category: "top",
      size: :medium,
      tags: %w[olive hoodie wings]
    )
    bag = ClothingItem.create!(
      user: @user,
      name: "Silver Chain Shoulder Bag",
      category: "bag",
      size: :na,
      tags: %w[silver chain purse]
    )
    filler_items = 21.times.map do |index|
      ClothingItem.create!(
        user: @user,
        name: "Plain Closet Item #{index}",
        category: "shirt",
        size: :medium
      )
    end
    items = [ @item, hoodie, bag, *filler_items ]
    captured_refiner = {}
    result = {
      name: "Reference Match",
      tags: [ "reference" ],
      notes: "Matched.",
      item_ids: [ hoodie.id, bag.id ]
    }

    with_reference_analyzer_stub(result: reference_profile_fixture) do
      with_candidate_selector_stub(result: filler_items.first(20).map(&:id)) do
        with_visual_refiner_stub(result: result, capture: captured_refiner) do
          OpenrouterOutfitGenerator.call(
            items: items,
            occasion: "match this",
            reference_photo: reference_photo_upload
          )

          assert_includes captured_refiner[:items].map(&:id), hoodie.id
          assert_includes captured_refiner[:items].map(&:id), bag.id
        end
      end
    end
  end

  test "preserves cross-slot signature vibe candidates in the visual shortlist" do
    sequin_top = ClothingItem.create!(
      user: @user,
      name: "Beige Sequin Halter Top",
      category: "top",
      size: :medium,
      tags: %w[beige sequin halter glam]
    )
    burgundy_bag = ClothingItem.create!(
      user: @user,
      name: "Burgundy Embossed Leather Shoulder Bag",
      category: "bag",
      size: :na,
      tags: %w[burgundy embossed leather shoulder bag]
    )
    red_mary_janes = ClothingItem.create!(
      user: @user,
      name: "Red Double-Strap Mary Janes",
      category: "shoes",
      size: :na,
      tags: %w[red burgundy mary janes polished]
    )
    filler_items = 21.times.map do |index|
      ClothingItem.create!(
        user: @user,
        name: "Literal Plain Item #{index}",
        category: "bottom",
        size: :medium,
        tags: %w[cream shorts]
      )
    end
    captured_refiner = {}
    result = {
      name: "Glam Reference Match",
      tags: [ "glam" ],
      notes: "Matched.",
      item_ids: [ sequin_top.id, burgundy_bag.id, red_mary_janes.id ]
    }

    with_reference_analyzer_stub(result: glam_reference_profile_fixture) do
      with_candidate_selector_stub(result: filler_items.first(20).map(&:id)) do
        with_visual_refiner_stub(result: result, capture: captured_refiner) do
          OpenrouterOutfitGenerator.call(
            items: [ sequin_top, burgundy_bag, red_mary_janes, *filler_items ],
            occasion: "match this burgundy glam flatlay",
            reference_photo: reference_photo_upload
          )

          refiner_ids = captured_refiner[:items].map(&:id)
          assert_includes refiner_ids, sequin_top.id
          assert_includes refiner_ids, burgundy_bag.id
          assert_includes refiner_ids, red_mary_janes.id
        end
      end
    end
  end

  test "passes user feedback preferences into candidate selection and visual refinement" do
    preferred_item = ClothingItem.create!(
      user: @user,
      name: "Beige Textured Chain Strap Bag",
      category: "bag",
      size: :na,
      tags: %w[beige textured chain bag]
    )
    generated_item = ClothingItem.create!(
      user: @user,
      name: "Brown Leather Shoulder Bag",
      category: "bag",
      size: :na,
      tags: %w[brown leather shoulder bag]
    )
    run = OutfitGenerationRun.create!(
      user: @user,
      outfit: outfits(:one),
      candidate_item_ids: [ generated_item.id, preferred_item.id ],
      generated_item_ids: [ generated_item.id ],
      generator_version: OpenrouterOutfitGenerator::GENERATOR_VERSION,
      generated_at: 1.day.ago
    )
    run.record_save_event!(final_item_ids: [ preferred_item.id ])
    filler_items = 21.times.map do |index|
      ClothingItem.create!(
        user: @user,
        name: "Feedback Candidate #{index}",
        category: "top",
        size: :medium
      )
    end
    captured_selector = {}
    captured_refiner = {}
    result = {
      name: "Feedback Look",
      tags: [ "feedback" ],
      notes: "Matched preferences.",
      item_ids: [ preferred_item.id ]
    }

    with_reference_analyzer_stub(result: reference_profile_fixture) do
      with_candidate_selector_stub(result: filler_items.first(20).map(&:id), capture: captured_selector) do
        with_visual_refiner_stub(result: result, capture: captured_refiner) do
          OpenrouterOutfitGenerator.call(
            items: [ preferred_item, generated_item, *filler_items ],
            occasion: "match this",
            reference_photo: reference_photo_upload,
            user: @user
          )

          assert_includes captured_selector[:preference_context]["preferred_item_ids"], preferred_item.id
          assert_includes captured_refiner[:preference_context]["preferred_item_ids"], preferred_item.id
          assert_includes captured_refiner[:items].map(&:id), preferred_item.id
        end
      end
    end
  end

  test "raises stage-specific error when text candidate selection returns no valid items" do
    extra_items = 21.times.map do |index|
      ClothingItem.create!(
        user: @user,
        name: "Closet Item #{index}",
        category: "shirt",
        size: :medium
      )
    end

    with_candidate_selector_stub(result: []) do
      error = assert_raises(OpenrouterOutfitGenerator::GenerationError) do
        OpenrouterOutfitGenerator.call(items: [ @item, *extra_items ])
      end

      assert_equal "candidate_selection", error.stage
      assert_equal "AI outfit generation candidate selection returned no valid owned closet items.", error.message
    end
  end

  test "raises stage-specific error when text candidate selection fails" do
    extra_items = 21.times.map do |index|
      ClothingItem.create!(
        user: @user,
        name: "Closet Item #{index}",
        category: "shirt",
        size: :medium
      )
    end

    with_candidate_selector_stub(error: RuntimeError.new("OpenRouter timed out")) do
      error = assert_raises(OpenrouterOutfitGenerator::GenerationError) do
        OpenrouterOutfitGenerator.call(items: [ @item, *extra_items ])
      end

      assert_equal "candidate_selection", error.stage
      assert_equal "RuntimeError", error.cause_class
      assert_equal "OpenRouter timed out", error.cause_message
      assert_equal "AI outfit generation failed during candidate selection: OpenRouter timed out", error.message
    end
  end

  test "raises stage-specific error when visual refinement fails" do
    with_visual_refiner_stub(error: RuntimeError.new("OpenRouter returned data that was not valid JSON.")) do
      error = assert_raises(OpenrouterOutfitGenerator::GenerationError) do
        OpenrouterOutfitGenerator.call(items: [ @item ], occasion: "dinner")
      end

      assert_equal "visual_refinement", error.stage
      assert_equal "RuntimeError", error.cause_class
      assert_equal "OpenRouter returned data that was not valid JSON.", error.cause_message
      assert_equal(
        "AI outfit generation failed during visual refinement: OpenRouter returned data that was not valid JSON.",
        error.message
      )
    end
  end

  private

  def with_candidate_selector_stub(result: nil, error: nil, capture: nil)
    original = OpenrouterOutfitCandidateSelector.method(:call)

    OpenrouterOutfitCandidateSelector.singleton_class.send(:define_method, :call) do |items:, occasion: nil, max_candidates:, reference_photo: nil, reference_profile: nil, preference_context: nil|
      capture&.replace(
        items: items,
        occasion: occasion,
        max_candidates: max_candidates,
        reference_photo: reference_photo,
        reference_profile: reference_profile,
        preference_context: preference_context
      )
      raise error if error

      result
    end

    yield
  ensure
    OpenrouterOutfitCandidateSelector.singleton_class.send(:define_method, :call, original)
  end

  def with_visual_refiner_stub(result: nil, error: nil, capture: nil)
    original = OpenrouterOutfitVisualRefiner.method(:call)

    OpenrouterOutfitVisualRefiner.singleton_class.send(:define_method, :call) do |items:, occasion: nil, reference_photo: nil, reference_profile: nil, preference_context: nil|
      capture&.replace(
        items: items,
        occasion: occasion,
        reference_photo: reference_photo,
        reference_profile: reference_profile,
        preference_context: preference_context
      )
      raise error if error

      result
    end

    yield
  ensure
    OpenrouterOutfitVisualRefiner.singleton_class.send(:define_method, :call, original)
  end

  def reference_photo_upload
    Rack::Test::UploadedFile.new(Rails.root.join("test/fixtures/files/item-photo.png"), "image/png")
  end

  def with_reference_analyzer_stub(result:, error: nil, capture: nil)
    original = OpenrouterOutfitReferenceAnalyzer.method(:call)

    OpenrouterOutfitReferenceAnalyzer.singleton_class.send(:define_method, :call) do |reference_photo:|
      capture&.replace(reference_photo: reference_photo)
      raise error if error

      result
    end

    yield
  ensure
    OpenrouterOutfitReferenceAnalyzer.singleton_class.send(:define_method, :call, original)
  end

  def reference_profile_fixture
    {
      "overall_style" => [ "casual glam" ],
      "target_slots" => [
        {
          "role" => "top",
          "required" => true,
          "subtype" => "hoodie",
          "colors" => [ "olive" ],
          "materials" => [ "sweatshirt fleece" ],
          "visual_features" => [ "wing graphic" ],
          "weight" => 0.95
        },
        {
          "role" => "bag",
          "required" => true,
          "subtype" => "chain shoulder bag",
          "colors" => [ "silver" ],
          "materials" => [ "metallic" ],
          "visual_features" => [ "chain strap" ],
          "weight" => 0.85
        }
      ]
    }
  end

  def glam_reference_profile_fixture
    {
      "overall_style" => [ "burgundy cream glam", "sparkly evening" ],
      "target_slots" => [
        {
          "role" => "bottom",
          "required" => true,
          "subtype" => "sequined shorts",
          "colors" => [ "burgundy" ],
          "materials" => [ "sequins" ],
          "visual_features" => [ "sparkly" ],
          "weight" => 0.9
        },
        {
          "role" => "bag",
          "required" => true,
          "subtype" => "structured shoulder bag",
          "colors" => [ "burgundy" ],
          "materials" => [ "croc leather", "patent leather" ],
          "visual_features" => [ "glossy" ],
          "weight" => 0.85
        },
        {
          "role" => "shoes",
          "required" => true,
          "subtype" => "knee high boots",
          "colors" => [ "burgundy" ],
          "materials" => [ "patent leather" ],
          "visual_features" => [ "glossy" ],
          "weight" => 0.8
        }
      ]
    }
  end
end
