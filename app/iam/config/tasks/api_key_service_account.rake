# frozen_string_literal: true

namespace :api_key_service_account do
  desc "Create the api_keys service account user"
  task create: :environment do
    Verse.logger.level = Logger::WARN

    repo = Account::Repository.new(Verse::Auth::Context[:system])


    environment = ENV.fetch("APP_ENVIRONMENT")
    password ||= \
      if environment == "production"
        SecureRandom.base64(15)
      elsif environment == "staging"
        ENV.fetch("IDAH_SERVICE_PASSWORD")
      else
        "password"
      end


    puts "Creating api_keys service account..."

    repo.no_event do
      repo.transaction do
        email = "api-#{SecureRandom.hex(6)}@host.to.idah.tld"

        record = repo.find_by({ role_name: "api_service" })

        if record
          puts "update #{email}, password = #{password}"

          repo.update(
            record.id,
            {
              hashed_password: BCrypt::Password.create(password),
              enabled: true,
              role_name: "api_service"
            }
          )
        else
          puts "create #{email}, password = #{password}"

          repo.create(
            {
              name: "API Service Account",
              email:,
              hashed_password: BCrypt::Password.create(password),
              enabled: true,
              role_name: "api_service"
            }
          )
        end
      end

      puts "Done."
    end
  end
end
