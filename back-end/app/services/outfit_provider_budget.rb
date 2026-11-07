# Reservations are never refunded: timeouts and provider-side retries may still bill.
# The cumulative maximum, not just reported successful usage, stays below $5.
class OutfitProviderBudget
  LimitExceeded = Class.new(StandardError)
  RATES = { "google/gemini-2.5-flash" => [ 0.30, 2.50 ], "google/gemini-embedding-2" => [ 0.22, 0 ] }.freeze

  def self.with(experiment: nil, run: nil)
    previous = Thread.current[:outfit_provider_budget]
    Thread.current[:outfit_provider_budget] = { experiment: experiment, run: run }
    yield
  ensure
    Thread.current[:outfit_provider_budget] = previous
  end

  def self.track(path, body)
    context = Thread.current[:outfit_provider_budget]
    return yield unless context

    model = body.fetch(:model)
    rates = RATES[model]
    raise LimitExceeded, "Unpriced model #{model}; no experiment call dispatched." unless rates

    # At most one token per UTF-8 byte, plus conservative overhead. Each capped image
    # reserves 8,192 input tokens, above Gemini's tiled 768px collage usage.
    text_bytes, images = measure(body)
    raise LimitExceeded, "Provider input exceeds experiment image/text caps." if images > 96 || text_bytes > 180_000
    output = Integer(body[:max_tokens] || 0)
    raise LimitExceeded, "Unbounded output request." if path.include?("completions") && !(1..6000).cover?(output)
    maximum = BigDecimal((((text_bytes + 4096 + images * 8192) * rates[0] + output * rates[1]) / 1_000_000).to_s)
    experiment = context[:experiment]
    attempt = nil
    OutfitProviderAttempt.transaction do
      if experiment
        # Atomic conditional UPDATE works across SQLite workers; provider I/O is outside this transaction.
        updated = OutfitExperiment.where(id: experiment.id).where("reserved_usd + ? <= ?", maximum, OutfitExperiment::CAP_USD)
          .update_all([ "reserved_usd = reserved_usd + ?", maximum ])
        raise LimitExceeded, "The $5 outfit experiment cap has been reached. No call dispatched." unless updated == 1
      end
      attempt = OutfitProviderAttempt.create!(outfit_experiment: experiment, outfit_recommendation_run: context[:run], model: model, endpoint: path, reserved_usd: maximum)
    end
    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    begin
      response = yield
      attempt.update!(status: "succeeded", usage: response["usage"] || {})
      response
    rescue StandardError => error
      attempt.update!(status: "failed", error_message: error.message.to_s.truncate(1000))
      raise
    ensure
      attempt.update!(latency_ms: ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round)
    end
  end

  def self.measure(value)
    case value
    when Hash
      value.values.map { |entry| measure(entry) }.reduce([ 0, 0 ]) { |sum, pair| sum.zip(pair).map(&:sum) }
    when Array
      value.map { |entry| measure(entry) }.reduce([ 0, 0 ]) { |sum, pair| sum.zip(pair).map(&:sum) }
    when String
      value.start_with?("data:image/") ? [ 0, 1 ] : [ value.bytesize, 0 ]
    else
      [ 32, 0 ]
    end
  end
end
