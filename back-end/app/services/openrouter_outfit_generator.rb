class OpenrouterOutfitGenerator
  class GenerationError < StandardError
    attr_reader :stage, :cause_class, :cause_message

    def initialize(stage:, message:, cause: nil)
      @stage = stage
      @cause_class = cause&.class&.name
      @cause_message = cause&.message
      super(message)
      set_backtrace(cause.backtrace) if cause&.backtrace
    end
  end

  MAX_CANDIDATE_ITEMS = 20
  GENERATOR_VERSION = "reference-feedback-v1".freeze

  def self.call(items:, occasion: nil, reference_photo: nil, user: nil)
    new(items: items, occasion: occasion, reference_photo: reference_photo, user: user).call
  end

  def initialize(items:, occasion: nil, reference_photo: nil, user: nil)
    @items = Array(items)
    @occasion = occasion.to_s.strip.presence
    @reference_photo = reference_photo
    @user = user
  end

  def call
    profile = reference_profile
    candidate_items = selected_candidate_items
    raise "OpenRouter did not select any valid candidate items." if candidate_items.empty?

    suggestion = OpenrouterOutfitVisualRefiner.call(
      items: candidate_items,
      occasion: occasion,
      reference_photo: reference_photo,
      reference_profile: profile,
      preference_context: preference_context
    )

    suggestion.merge(
      candidate_item_ids: candidate_items.map(&:id),
      reference_profile: profile,
      generator_version: GENERATOR_VERSION
    )
  rescue GenerationError
    raise
  rescue StandardError => error
    raise GenerationError.new(
      stage: "visual_refinement",
      message: "AI outfit generation failed during visual refinement: #{error.message}",
      cause: error
    )
  end

  private

  attr_reader :items, :occasion, :reference_photo, :user

  def selected_candidate_items
    return items.first(MAX_CANDIDATE_ITEMS) if items.length <= MAX_CANDIDATE_ITEMS

    candidate_ids = select_candidate_ids_with_ai
    candidate_ids = preserve_reference_slot_candidates(candidate_ids)
    items_by_id = items.index_by(&:id)

    candidate_items = candidate_ids.filter_map { |item_id| items_by_id[item_id] }.first(MAX_CANDIDATE_ITEMS)
    raise GenerationError.new(stage: "candidate_selection", message: "AI outfit generation candidate selection returned no valid owned closet items.") if candidate_items.empty?

    candidate_items
  end

  def select_candidate_ids_with_ai
    OpenrouterOutfitCandidateSelector.call(
      items: items,
      occasion: occasion,
      max_candidates: MAX_CANDIDATE_ITEMS,
      reference_photo: reference_photo,
      reference_profile: reference_profile,
      preference_context: preference_context
    )
  rescue StandardError => error
    raise GenerationError.new(
      stage: "candidate_selection",
      message: "AI outfit generation failed during candidate selection: #{error.message}",
      cause: error
    )
  end

  def preserve_reference_slot_candidates(candidate_ids)
    return candidate_ids if reference_profile.blank?

    matcher = OutfitReferenceMatcher.new(reference_profile, preference_context: preference_context)
    slot_candidate_ids = matcher.best_candidate_ids_by_slot(items, limit_per_slot: 3)
    signature_candidate_ids = matcher.best_signature_candidate_ids(items, limit: 8)
    preference_candidate_ids = Array(preference_context&.dig("preferred_item_ids"))
    [ *slot_candidate_ids, *signature_candidate_ids, *preference_candidate_ids, *candidate_ids ].uniq.first(MAX_CANDIDATE_ITEMS)
  end

  def reference_profile
    return @reference_profile if defined?(@reference_profile)
    return @reference_profile = nil if reference_photo.blank?

    @reference_profile = OpenrouterOutfitReferenceAnalyzer.call(reference_photo: reference_photo)
  rescue StandardError => error
    raise GenerationError.new(
      stage: "reference_analysis",
      message: "AI outfit generation failed during reference analysis: #{error.message}",
      cause: error
    )
  end

  def preference_context
    return @preference_context if defined?(@preference_context)
    return @preference_context = nil if user.blank?

    context = OutfitGenerationPreferenceBuilder.call(user: user)
    @preference_context = context.values.any?(&:present?) ? context : nil
  end
end
