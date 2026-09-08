require "test_helper"
require "tempfile"

class OpenrouterOutfitVisualJudgeTest < ActiveSupport::TestCase
  test "returns fewer than three options when only one clears the quality floor" do
    judge = OpenrouterOutfitVisualJudge.new(
      brief: { "hard_constraints" => [ "no orange" ] },
      candidates: [ { id: "a", items: [] }, { id: "b", items: [] } ]
    )
    build_evaluation = method(:evaluation)
    fake_client = Object.new
    fake_client.define_singleton_method(:post_json) do |**_args|
      {
        "model" => "test/judge",
        "usage" => { "cost" => 0.004 },
        "choices" => [ { "message" => { "content" => {
          evaluations: [
            build_evaluation.call("a", score: 88, violations: []),
            build_evaluation.call("b", score: 91, violations: [ "contains excluded orange" ])
          ]
        }.to_json } } ]
      }
    end
    judge.define_singleton_method(:client) { fake_client }

    with_fake_collages do
      result = judge.call

      assert_equal [ "a" ], result.fetch(:passing).map { |value| value.fetch("candidate_id") }
      assert_equal 0.004, result.dig(:usage, "estimated_cost_usd")
    end
  end

  test "rejects a malformed response that omits a candidate" do
    judge = OpenrouterOutfitVisualJudge.new(
      brief: {},
      candidates: [ { id: "a", items: [] }, { id: "b", items: [] } ]
    )
    build_evaluation = method(:evaluation)
    fake_client = Object.new
    fake_client.define_singleton_method(:post_json) do |**_args|
      { "choices" => [ { "message" => { "content" => { evaluations: [ build_evaluation.call("a", score: 80, violations: []) ] }.to_json } } ] }
    end
    judge.define_singleton_method(:client) { fake_client }

    with_fake_collages do
      error = assert_raises(RuntimeError) { judge.call }
      assert_match(/every outfit candidate/, error.message)
    end
  end

  test "extracts valid judgments from markdown and explanatory text" do
    judge = OpenrouterOutfitVisualJudge.new(brief: {}, candidates: [ { id: "a", items: [] } ])
    payload = { evaluations: [ evaluation("a", score: 82, violations: []) ] }.to_json
    fake_client = Object.new
    fake_client.define_singleton_method(:post_json) do |**_args|
      { "choices" => [ { "finish_reason" => "stop", "message" => { "content" => "Here are the results:\n```json\n#{payload}\n```" } } ] }
    end
    judge.define_singleton_method(:client) { fake_client }

    with_fake_collages do
      result = judge.call

      assert_equal [ "a" ], result.fetch(:passing).map { |value| value.fetch("candidate_id") }
      assert_equal 1, result.dig(:usage, "attempts")
    end
  end

  test "retries a truncated response with a larger concise output contract" do
    judge = OpenrouterOutfitVisualJudge.new(brief: {}, candidates: [ { id: "a", items: [] } ])
    complete = { evaluations: [ evaluation("a", score: 84, violations: []) ] }.to_json
    requests = []
    responses = [
      {
        "usage" => { "completion_tokens" => 2_600, "cost" => 0.003 },
        "choices" => [ { "finish_reason" => "length", "message" => { "content" => '{"evaluations":[' } } ]
      },
      {
        "usage" => { "completion_tokens" => 400, "cost" => 0.001 },
        "choices" => [ { "finish_reason" => "stop", "message" => { "content" => complete } } ]
      }
    ]
    fake_client = Object.new
    fake_client.define_singleton_method(:post_json) do |**args|
      requests << args
      responses.shift
    end
    judge.define_singleton_method(:client) { fake_client }

    with_fake_collages do
      result = judge.call

      assert_equal 2, requests.length
      assert_equal 6_000, requests.first.fetch(:body).fetch(:max_tokens)
      assert_equal 2, result.dig(:usage, "attempts")
      assert_equal 3_000, result.dig(:usage, "completion_tokens")
      assert_in_delta 0.004, result.dig(:usage, "estimated_cost_usd")
      assert_includes requests.last.dig(:body, :messages, 1, :content, 0, :text), "previous judging response was malformed"
    end
  end

  private

  def evaluation(candidate_id, score:, violations:)
    {
      candidate_id: candidate_id,
      prompt_accuracy: score,
      color_harmony: score,
      silhouette_proportion: score,
      pattern_texture: score,
      occasion_weather: score,
      overall_cohesion: score,
      overall_score: score,
      title: "Look #{candidate_id}",
      summary: "A complete look",
      reasons: [ "cohesive" ],
      hard_violations: violations
    }
  end

  def with_fake_collages
    original = OutfitCandidateCollageRenderer.method(:call)
    OutfitCandidateCollageRenderer.define_singleton_method(:call) do |_items|
      Tempfile.new([ "candidate", ".png" ]).tap { |file| file.write("png"); file.rewind }
    end
    yield
  ensure
    OutfitCandidateCollageRenderer.define_singleton_method(:call) { |*args| original.call(*args) } if original
  end
end
