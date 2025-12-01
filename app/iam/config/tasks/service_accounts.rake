# frozen_string_literal: true

namespace :service_accounts do
  # SERVICES=iam,dataset,media,setting bundle exec rake service_accounts:create
  desc "Create the different service users for each services of idah"
  task create: :environment do
    Verse.logger.level = Logger::WARN

    repo = Account::Repository.new(Verse::Auth::Context[:system])

    service_name = "services.idah.ai"

    services = ENV.fetch("SERVICES"){ raise "please provide SERVICES" }
    services = services.split(",")

    services.map!{ |x|
      username, password = x.split(":")

      environment = ENV.fetch("APP_ENVIRONMENT")
      password ||= \
        if environment == "production"
          SecureRandom.base64(15)
        elsif environment == "staging"
          ENV.fetch("IDAH_SERVICE_PASSWORD")
        else
          "password"
        end

      [username, password]
    }

    repo.no_event do
      repo.transaction do
        services.each do |(service, password)|
          email = "#{service}@#{service_name}"
          role = "system"

          record = repo.find_by({ email: })

          if record
            puts "update #{email}, password = #{password}"

            repo.update(
              record.id,
              {
                hashed_password: BCrypt::Password.create(password),
                enabled: true,
                role_name: role
              }
            )
          else
            puts "create #{email}, password = #{password}"

            repo.create(
              {
                name: service,
                email:,
                hashed_password: BCrypt::Password.create(password),
                enabled: true,
                role_name: role
              }
            )
          end
        end
      end

      puts "Done."
    end
  end
end
