require "test_helper"

class OutfitRecommendationsFlowTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @user = users(:one)
    clear_enqueued_jobs
  end

  test "wardrobe setup creates one reusable analysis workflow" do
    assert_enqueued_with(job: WardrobeAnalysisBackfillJob) do
      post wardrobe_item_analysis_url, headers: auth_headers(@user), as: :json
    end

    assert_response :accepted
    assert_equal "wardrobe_index", response_json.dig("workflow", "kind")

    assert_no_difference("AiWorkflow.count") do
      post wardrobe_item_analysis_url, headers: auth_headers(@user), as: :json
    end
  end

  test "recommendations explain when closet analysis is not ready" do
    post outfit_recommendations_url, params: {
      outfit_recommendation: { prompt: "A warm fall look" }
    }, headers: auth_headers(@user), as: :json

    assert_response :conflict
    assert_equal "wardrobe_not_ready", response_json["code"]
  end

  test "recommendations start an asynchronous durable run" do
    ready_status = { total: 1, ready: 1, pending: 0, processing: 0, failed: 0, stale: 0, missing_image: 0,
      complete: true, workflow: nil }

    original_status = WardrobeAnalysisStatus.method(:call)
    WardrobeAnalysisStatus.define_singleton_method(:call) { |_user| ready_status }

    assert_enqueued_with(job: OutfitRecommendationRunJob) do
      post outfit_recommendations_url, params: {
        outfit_recommendation: {
          prompt: "A warm fall look",
          draft_metadata: {
            name: "Thanksgiving",
            tags: [ "warm", "family dinner" ],
            notes: "Comfortable enough for hosting."
          }
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :accepted
    assert_equal "pending", response_json["status"]
    assert_equal "outfit_recommendation", response_json.dig("workflow", "kind")
    assert_equal %w[retrieve finalize], response_json.dig("workflow", "stages").map { |stage| stage["key"] }
    assert_equal 1, response_json.dig("workflow", "requested_count")
    run = @user.outfit_recommendation_runs.order(:id).last
    assert_equal "Thanksgiving", run.constraints.dig("draft_metadata", "name")
    assert_equal [ "warm", "family dinner" ], run.constraints.dig("draft_metadata", "tags")
    assert_equal "Comfortable enough for hosting.", run.constraints.dig("draft_metadata", "notes")
  ensure
    WardrobeAnalysisStatus.define_singleton_method(:call) { |*args| original_status.call(*args) } if original_status
  end

  test "recommendation runs are isolated between users" do
    other_run = users(:two).outfit_recommendation_runs.create!(prompt: "private look")

    get outfit_recommendation_url(other_run), headers: auth_headers(@user), as: :json

    assert_response :not_found
  end

  test "clearing a generated cart records the rejected outfit combination" do
    run = @user.outfit_recommendation_runs.create!(prompt: "casual layers")
    option = run.options.create!(
      rank: 1,
      status: :passing,
      clothing_item_ids: [ clothing_items(:one).id ]
    )

    post discard_outfit_recommendation_url(run), params: {
      outfit_recommendation: { option_id: option.id }
    }, headers: auth_headers(@user), as: :json

    assert_response :created
    event = run.feedback_events.order(:id).last
    assert_equal "none", event.event_type
    assert_equal option.id, event.outfit_recommendation_option_id
    assert_equal "outfit_cart_clear", event.metadata.fetch("source")
  end

  test "a recommendation from another user cannot be cleared" do
    other_run = users(:two).outfit_recommendation_runs.create!(prompt: "private look")
    option = other_run.options.create!(rank: 1, status: :passing, clothing_item_ids: [ clothing_items(:two).id ])

    post discard_outfit_recommendation_url(other_run), params: {
      outfit_recommendation: { option_id: option.id }
    }, headers: auth_headers(@user), as: :json

    assert_response :not_found
  end
end
