# frozen_string_literal: true

namespace :token do
  desc "Generate a new token"
  task :generate do
    begin
      # Suppress all output during key generation
      original_stdout = $stdout

      require "stringio"

      $stdout = StringIO.new

      Rake::Task["environment"].invoke

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
    ensure
      $stdout = original_stdout
    end

    puts auth_token
  end
end
