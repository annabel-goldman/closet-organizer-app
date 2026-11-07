require "test_helper"

class OutfitProviderBudgetTest < ActiveSupport::TestCase
  setup do
    @experiment = OutfitExperiment.create!(user: users(:one), name: "budget-test")
    @body = { model: "google/gemini-2.5-flash", max_tokens: 1000, messages: [ { role: "user", content: "test" } ] }
  end

  test "reserves before dispatch and retains the reservation on failure" do
    assert_raises(RuntimeError) do
      OutfitProviderBudget.with(experiment: @experiment) do
        OutfitProviderBudget.track("/chat/completions", @body) do
          assert_operator @experiment.reload.reserved_usd, :>, 0
          raise "timeout"
        end
      end
    end
    attempt = @experiment.outfit_provider_attempts.sole
    assert_equal "failed", attempt.status
    assert_equal "timeout", attempt.error_message
    assert_equal attempt.reserved_usd, @experiment.reload.reserved_usd
  end

  test "cap blocks dispatch including retries and unpriced models" do
    @experiment.update!(reserved_usd: 4.99999)
    called = false
    assert_raises(OutfitProviderBudget::LimitExceeded) do
      OutfitProviderBudget.with(experiment: @experiment) do
        OutfitProviderBudget.track("/chat/completions", @body) { called = true }
      end
    end
    refute called
    assert_empty @experiment.outfit_provider_attempts
    assert_raises(OutfitProviderBudget::LimitExceeded) do
      OutfitProviderBudget.with(experiment: @experiment) do
        OutfitProviderBudget.track("/chat/completions", @body.merge(model: "unknown/model")) { flunk }
      end
    end
  end

  test "records actual usage and restores outer contexts" do
    OutfitProviderBudget.with(experiment: @experiment) do
      OutfitProviderBudget.with { assert_equal "inside", OutfitProviderBudget.track("/embeddings", { model: "google/gemini-embedding-2", input: "query" }) { { "usage" => {}, "value" => "inside" } }["value"] }
      OutfitProviderBudget.track("/chat/completions", @body) { { "usage" => { "cost" => 0.001 } } }
    end
    assert_equal 0.001, @experiment.outfit_provider_attempts.sole.usage["cost"]
    assert_nil Thread.current[:outfit_provider_budget]
  end
end
