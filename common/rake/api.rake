# frozen_string_literal: true

namespace :api do
  # Logs in to iam with this service's own account, through the same client and
  # address its service-to-service calls use. Exits non-zero on failure.
  desc "Check this service can reach the others"
  task check: :environment do
    base_url = Api[:idah].base_url
    account = ENV.fetch("IDAH_SERVICE_ACCOUNT")

    begin
      generate_token || raise("iam returned no token")
      puts "OK #{account} -> #{base_url}"
    rescue StandardError => e
      warn "FAILED #{account} -> #{base_url}: #{e.message}"
      exit 1
    end
  end
end
