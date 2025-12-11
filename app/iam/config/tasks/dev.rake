# frozen_string_literal: true

namespace :dev do
  task setup: :environment do
    ENV["SERVICES"] = %w[
      audit
      dataset
      iam
      media
      notification
      setting
      sync
    ].join(",")
    Rake::Task["service_accounts:create"].invoke
  end

  task users: :environment do
    password = "password"
    hashed_password = BCrypt::Password.create(password)

    users = [
      {
        email: "admin@idah.ai",
        name: "Admin User",
        role_name: "admin"
      },
      {
        email: "orgowner@idah.ai",
        name: "Organization Owner",
        role_name: "org_owner",
        role_scope: { org: [1] }
      },
      {
        email: "projectowner@idah.ai",
        name: "Project Owner",
        role_name: "user"
      },
      {
        email: "reviewer@idah.ai",
        name: "Reviewer",
        role_name: "user"
      },
      {
        email: "annotator@idah.ai",
        name: "Annotator",
        role_name: "user"
      },
    ]

    context = Verse::Auth::Context[:system]
    account_repo = Account::Repository.new(context)

    puts "Creating dev users..."

    users.each do |user_data|
      account = account_repo.find_by({ email: user_data[:email] })

      params = {
        name: user_data[:name],
        email: user_data[:email],
        hashed_password: hashed_password,
        enabled: true,
        joined_at: Time.now,
        role_name: user_data[:role_name]
      }

      if user_data[:role_scope]
        params[:role_scope] = Sequel.pg_json(user_data[:role_scope])
      end

      if account.nil?
        puts "create #{user_data[:email]}, password = #{password}"
        account_repo.create(params)
      else
        puts "update #{user_data[:email]}, password = #{password}"
        account_repo.update(account.id, params)
      end
    end

    puts "Done."
  end
end
