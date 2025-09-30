# frozen_string_literal: true

desc "Generate a new key pair"
task :keygen do
  require "openssl"

  key = OpenSSL::PKey.generate_key("EC", "group" => "prime256v1")

  puts "Key will be generated on ./private.pem and ./public.pem"

  File.write("config/keys/private.pem", key.private_to_pem)
  File.write("config/keys/public.pem", key.public_to_pem)
end
