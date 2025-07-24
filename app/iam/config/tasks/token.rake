# frozen_string_literal: true

namespace :token do
  desc "Generate a new token"
  task generate: :environment do
    auth_token = Verse::Http::Auth::Token.encode(
      {
        id: 1,
        name: "system",
        email: "system@idah.ai",
      }.compact,
      "system",
      {},
      exp: Time.now.to_i + ( 3650 * 86_400 )
    )

    puts auth_token
  end
end
