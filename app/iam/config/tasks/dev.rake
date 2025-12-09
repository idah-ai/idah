# frozen_string_literal: true

namespace :dev do
  task setup: :environment do
    ENV["SERVICES"] = %w[
      iam
      dataset
      media
      setting
      notification
      sync
      audit
    ].join(",")
    Rake::Task["service_accounts:create"].invoke
  end

  task create_admin_account: :environment do
    context = Verse::Auth::Context[:system]
    account_repo = Account::Repository.new(context)

    account_repo.create(
      {
        name: "admin",
        email: "admin@idah.ai",
        hashed_password: BCrypt::Password.create("password"),
        enabled: true,
        role_name: "admin",
        joined_at: Time.now,
      }
    )
  end
end
