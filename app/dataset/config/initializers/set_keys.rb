# frozen_string_literal: true

# :nocov:

# Key can be public or private. If public, the service won't be able to
# forge new tokens, but will be able to validate them.
key_path = ENV.fetch("SERVICE_JWT_KEY")

# content of the env variable can be a path to a file or the key itself
# Expected PEM file.
key_content = \
  if key_path[/^file:/]
    key_path = key_path.gsub(/^file:/, "")
    File.read(key_path)
  else
    key_path
  end

# Set the signing key.
key = OpenSSL::PKey::EC.new(key_content)

unless key.private?
  Verse.logger = Logger.new($stdout)
  Verse.logger.debug{ "Using a public key to sign tokens. This service won't be able to forge new tokens." }
end

Verse::Http::Auth::Token.sign_key = key
# :nocov:
