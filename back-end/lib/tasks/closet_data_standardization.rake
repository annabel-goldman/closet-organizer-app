namespace :closet_data do
  desc "Dry-run or apply Annabel's local closet taxonomy cleanup. Set APPLY=1 to update records."
  task standardize_annabel: :environment do
    email = ENV.fetch("EMAIL", ClosetDataStandardizer::DEFAULT_EMAIL)
    apply = ActiveModel::Type::Boolean.new.cast(ENV["APPLY"])

    ClosetDataStandardizer
      .new(email: email, apply: apply, output: $stdout)
      .call
  end
end
