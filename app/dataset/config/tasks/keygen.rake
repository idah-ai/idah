# frozen_string_literal: true

desc "Generate a new key pair"
task :keygen do
  require "openssl"

  key = OpenSSL::PKey::EC.generate("prime256v1")

  puts "Key will be generated on ./private.pem and ./public.pem"

  File.write("private.pem", key.to_pem)

  # I can't figure out how to do with OpenSSL 3.0 inside ruby :(
  system("openssl ec -in private.pem -pubout -out public.pem")
end
