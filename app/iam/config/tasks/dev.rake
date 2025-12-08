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

  task users: :environment do
    hashed_password = BCrypt::Password.create(ENV["DEV_PASSWORD"])

    users = [
      {
        email: "admin@ingedata.ai",
        name: "Admin User",
        role: "anonymous"
      },
      {
        email: "user@ingedata.ai",
        name: "Staff User",
        role: "anonymous"
      },
    ]

    context = Verse::Auth::Context[:system]
    account_repo = Account::Repository.new(context)

    users.each do |user_data|
      account = account_repo.find_by({ email: user_data[:email] })

      next unless account.nil?

      account_repo.create(
        {
          name: user_data[:name],
          email: user_data[:email],
          hashed_password: hashed_password,
          enabled: true,
          role: user_data[:role]
        }
      )
    end
  end
end
