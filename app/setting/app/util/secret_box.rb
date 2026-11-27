# frozen_string_literal: true

require "base64"
require "openssl"

# Encrypts storage target secrets at rest with AES-256-GCM.
#
# The AES key is derived (HKDF-SHA256) from the master key in
# STORAGE_TARGETS_MASTER_KEY, which only the Setting service has. A ciphertext
# reads `v1:<nonce>:<ciphertext>:<tag>` (base64 parts); the version lets the
# master key be rotated later by re-encrypting with a new one. GCM's tag makes a
# changed ciphertext, or one encrypted with another key, fail to decrypt rather
# than return garbage.
#
# Losing the master key loses every stored secret: they have to be entered
# again.
class SecretBox
  # Raised when the master key is not set or too short.
  class MissingKey < StandardError; end

  # Raised when a ciphertext can't be decrypted: changed, from another master
  # key, or of an unknown version.
  class DecryptionFailed < StandardError; end

  ENV_KEY = "STORAGE_TARGETS_MASTER_KEY"
  MIN_KEY_LENGTH = 32
  VERSION = "v1"
  CIPHER = "aes-256-gcm"
  HKDF_INFO = "idah storage target secrets v1"

  def self.from_env
    new(ENV.fetch(ENV_KEY) { raise MissingKey, "#{ENV_KEY} is not set: storage targets can't store secrets" })
  end

  def initialize(master_key)
    if master_key.to_s.length < MIN_KEY_LENGTH
      raise MissingKey, "#{ENV_KEY} must be at least #{MIN_KEY_LENGTH} characters"
    end

    @key = OpenSSL::KDF.hkdf(master_key, salt: "", info: HKDF_INFO, length: 32, hash: "SHA256")
  end

  def encrypt(plaintext)
    cipher = OpenSSL::Cipher.new(CIPHER).encrypt
    cipher.key = @key
    nonce = cipher.random_iv
    cipher.auth_data = VERSION

    ciphertext = cipher.update(plaintext.to_s) + cipher.final

    [VERSION, *[nonce, ciphertext, cipher.auth_tag].map { |part| Base64.strict_encode64(part) }].join(":")
  end

  def decrypt(value)
    version, *parts = value.to_s.split(":")
    raise DecryptionFailed, "unknown secret version `#{version}`" unless version == VERSION && parts.size == 3

    nonce, ciphertext, tag = parts.map { |part| Base64.strict_decode64(part) }

    cipher = OpenSSL::Cipher.new(CIPHER).decrypt
    cipher.key = @key
    cipher.iv = nonce
    cipher.auth_tag = tag
    cipher.auth_data = VERSION

    cipher.update(ciphertext) + cipher.final
  rescue OpenSSL::Cipher::CipherError, ArgumentError
    raise DecryptionFailed, "the secret can't be decrypted with this master key"
  end

  def inspect
    "#<#{self.class.name}>"
  end
  alias to_s inspect
end
