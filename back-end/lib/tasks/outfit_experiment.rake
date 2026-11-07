namespace :outfits do
  desc "Import blind human ratings and report promotion eligibility (USER_ID, RATINGS_FILE)"
  task review: :environment do
    experiment = OutfitExamples.experiment(User.find(ENV.fetch("USER_ID")))
    ratings = JSON.parse(File.read(ENV.fetch("RATINGS_FILE")))
    puts OutfitExperimentReview.import!(experiment, ratings).to_json
  end

  desc "Run resumable, $5-capped single-look comparisons (USER_ID, LIMIT=1, SPLIT=development)"
  task experiment: :environment do
    user = User.find(ENV.fetch("USER_ID"))
    result = OutfitExperimentRunner.new(user).call(limit: Integer(ENV.fetch("LIMIT", "1")), split: ENV.fetch("SPLIT", "development"))
    puts result.except(:manifest).merge(status: "experimental; blind human ratings required").to_json
  end

  desc "Export a blind review HTML and rating template (USER_ID, OUTPUT_DIR required)"
  task export_review: :environment do
    require "base64"
    require "cgi"
    user = User.find(ENV.fetch("USER_ID"))
    experiment = OutfitExamples.experiment(user)
    output = Pathname.new(ENV.fetch("OUTPUT_DIR")).expand_path
    FileUtils.mkdir_p(output)
    rows = []
    cards = experiment.manifest.fetch("trials", {}).flat_map do |prompt_id, trial|
      trial.fetch("results").values.select { |result| result["blind_label"].present? }.sort_by { |result| result.fetch("blind_label") }.map do |result|
        items = user.clothing_items.where(id: result.fetch("item_ids")).to_a
        collage = OutfitCandidateCollageRenderer.call(items) if items.any?
        begin
          label = result.fetch("blind_label")
          rows << { prompt_id: prompt_id, label: label, completeness: nil, request_accuracy: nil, wearability: nil, explicit_constraint_failure: nil }
          preview = collage ? "<img width='480' src='data:image/png;base64,#{Base64.strict_encode64(File.binread(collage.path))}'>" : "<p>No outfit returned.</p>"
          "<article><h2>#{CGI.escapeHTML(trial.fetch('prompt'))}</h2><p>Look #{label}</p>#{preview}</article>"
        ensure
          collage&.close!
        end
      end
    end
    File.write(output.join("review.html"), "<!doctype html><meta charset='utf-8'><title>Blind outfit review</title><h1>Rate each look 1–5 for completeness, request accuracy, and wearability.</h1><p>Record explicit constraint failures separately. Method names and AI scores are hidden.</p>#{cards.join}")
    File.write(output.join("ratings.json"), JSON.pretty_generate(rows))
    puts "Wrote #{rows.length} blind looks to #{output}"
  end
end
