# frozen_string_literal: true

namespace :admin do
  # ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... bundle exec rake admin:create
  desc "Create or update the administrator account"
  task create: :environment do
    Verse.logger.level = Logger::WARN

    email = ENV.fetch("ADMIN_EMAIL")
    password = ENV.fetch("ADMIN_PASSWORD")

    repo = Account::Repository.new(Verse::Auth::Context[:system])

    data = {
      name: ENV.fetch("ADMIN_NAME", "Administrator"),
      email:,
      hashed_password: BCrypt::Password.create(password),
      enabled: true,
      joined_at: Time.now,
      role_name: "admin"
    }

    repo.no_event do
      account = repo.find_by({ email: })

      if account
        repo.update(account.id, data)
        puts "Updated administrator #{email}"
      else
        repo.create(data)
        puts "Created administrator #{email}"
      end
    end
  end
end
