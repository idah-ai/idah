# frozen_string_literal: true

require "spec_helper"

RSpec.describe SecretBox do
  subject(:box) { described_class.new("a-master-key-long-enough-for-tests") }

  it "decrypts what it encrypted" do
    expect(box.decrypt(box.encrypt("LEAK-CANARY-123"))).to eq("LEAK-CANARY-123")
  end

  it "keeps the secret out of the ciphertext, which starts with its version" do
    ciphertext = box.encrypt("LEAK-CANARY-123")

    expect(ciphertext).to start_with("v1:")
    expect(ciphertext).not_to include("LEAK-CANARY-123")
  end

  it "uses a new nonce each time" do
    expect(box.encrypt("same")).not_to eq(box.encrypt("same"))
  end

  it "refuses a ciphertext that was tampered with" do
    version, nonce, ciphertext, tag = box.encrypt("LEAK-CANARY-123").split(":")
    flipped = Base64.strict_encode64(Base64.strict_decode64(ciphertext).bytes.tap { |b| b[0] ^= 1 }.pack("C*"))

    expect { box.decrypt([version, nonce, flipped, tag].join(":")) }.to raise_error(SecretBox::DecryptionFailed)
  end

  it "refuses a ciphertext encrypted with another master key" do
    other = described_class.new("another-master-key-long-enough-for-tests")

    expect { box.decrypt(other.encrypt("LEAK-CANARY-123")) }.to raise_error(SecretBox::DecryptionFailed)
  end

  it "refuses an unknown version" do
    expect { box.decrypt("v9:a:b:c") }.to raise_error(SecretBox::DecryptionFailed, /v9/)
  end

  it "never shows the master key when inspected" do
    expect(box.inspect).not_to include("a-master-key")
  end

  describe ".from_env" do
    it "reads STORAGE_TARGETS_MASTER_KEY" do
      ciphertext = described_class.from_env.encrypt("x")

      expect(described_class.new(ENV.fetch("STORAGE_TARGETS_MASTER_KEY")).decrypt(ciphertext)).to eq("x")
    end

    it "says what is missing when the key isn't set" do
      stub_const("ENV", ENV.to_h.except("STORAGE_TARGETS_MASTER_KEY"))

      expect { described_class.from_env }.to raise_error(SecretBox::MissingKey, /STORAGE_TARGETS_MASTER_KEY/)
    end

    it "refuses a key too short to be a real secret" do
      expect { described_class.new("short") }.to raise_error(SecretBox::MissingKey, /32/)
    end
  end
end
