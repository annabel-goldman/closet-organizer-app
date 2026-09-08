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
      enriched: 1, enrichment_pending: 0, enrichment_processing: 0, enrichment_failed: 0, complete: true, workflow: nil }

    original_status = WardrobeAnalysisStatus.method(:call)
    WardrobeAnalysisStatus.define_singleton_method(:call) { |_user| ready_status }

    assert_enqueued_with(job: OutfitRecommendationRunJob) do
      post outfit_recommendations_url, params: {
        outfit_recommendation: { prompt: "A warm fall look" }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :accepted
    assert_equal "pending", response_json["status"]
    assert_equal "outfit_recommendation", response_json.dig("workflow", "kind")
    assert_equal %w[plan retrieve judge finalize], response_json.dig("workflow", "stages").map { |stage| stage["key"] }
  ensure
    WardrobeAnalysisStatus.define_singleton_method(:call) { |*args| original_status.call(*args) } if original_status
  end

  test "feedback is persisted on an owned option" do
    run = @user.outfit_recommendation_runs.create!(prompt: "fall look")
    option = run.options.create!(rank: 1, clothing_item_ids: [ clothing_items(:one).id ])

    post feedback_outfit_recommendation_url(run), params: {
      feedback: { event_type: "best", option_id: option.id }
    }, headers: auth_headers(@user), as: :json

    assert_response :created
    assert_equal "best", run.feedback_events.last.event_type
  end

  test "recommendation runs are isolated between users" do
    other_run = users(:two).outfit_recommendation_runs.create!(prompt: "private look")

    get outfit_recommendation_url(other_run), headers: auth_headers(@user), as: :json

    assert_response :not_found
  end
end
