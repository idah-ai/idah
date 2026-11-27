# frozen_string_literal: true

require "spec_helper"

# StorageRegistry lives in common/lib; it is specced here because media has the
# shrine and aws-sdk-s3 gems it builds storages with.
RSpec.describe StorageRegistry do
  let(:now) { [1_000.0] }
  let(:fetches) { [] }
  let(:credentials) do
    {
      endpoint: "https://s3.example.com",
      region: "eu-west-1",
      bucket: "customer-bucket",
      prefix: "/acme/",
      access_key_id: "AKIAEXAMPLE",
      secret_access_key: "LEAK-CANARY-123"
    }
  end

  let(:provider) do
    lambda do |target_id|
      fetches << target_id
      credentials
    end
  end

  subject(:registry) do
    described_class.new(service: :media, credentials_provider: provider, ttl: 300, clock: -> { now.first })
  end

  after { ::Shrine.storages.delete_if { |key, _| key.to_s.start_with?("target_") } }

  describe "#for" do
    it "returns the plugin's default storage for a nil target, without fetching credentials" do
      expect(registry.for(nil)).to equal(Verse::Plugin[:shrine].storage)
      expect(fetches).to be_empty
    end

    it "builds an S3 storage for a target under its prefix and the service's folder" do
      manager = registry.for("target-1")
      storage = ::Shrine.storages[manager.adapter]

      expect(storage).to be_a(::Shrine::Storage::S3)
      expect(storage.bucket.name).to eq("customer-bucket")
      expect(storage.prefix).to eq("acme/media/files")
      expect(storage.public).to be(false)
    end

    it "addresses virtual-host style by default, as AWS and GCS expect" do
      storage = ::Shrine.storages[registry.for("target-1").adapter]

      expect(storage.client.config.force_path_style).to be(false)
    end

    it "addresses by path for a target that asks for it, as MinIO or Ceph need" do
      credentials[:path_style] = true

      expect(::Shrine.storages[registry.for("target-1").adapter].client.config.force_path_style).to be(true)
    end

    it "uses a placeholder region for a target without one, as the SDK needs one to sign" do
      credentials[:region] = nil

      expect(::Shrine.storages[registry.for("target-1").adapter].client.config.region).to eq("us-east-1")
    end

    it "uses the sync folder in the sync service" do
      sync = described_class.new(service: :sync, credentials_provider: provider, ttl: 300, clock: -> { now.first })

      expect(::Shrine.storages[sync.for("target-1").adapter].prefix).to eq("acme/sync/files")
    end

    it "uses only the service's folder when the target has no prefix" do
      credentials[:prefix] = ""

      expect(::Shrine.storages[registry.for("target-1").adapter].prefix).to eq("media/files")
    end

    it "fetches the credentials once while the entry is fresh" do
      registry.for("target-1")
      registry.for("target-1")

      expect(fetches).to eq(["target-1"])
    end

    it "fetches them again once the TTL has passed" do
      registry.for("target-1")
      now[0] += 301
      registry.for("target-1")

      expect(fetches).to eq(%w[target-1 target-1])
    end

    it "builds one storage when several threads ask for the same target at once" do
      slow_provider = lambda do |target_id|
        sleep 0.01
        fetches << target_id
        credentials
      end
      registry = described_class.new(service: :media, credentials_provider: slow_provider, ttl: 300)

      Array.new(8) { Thread.new { registry.for("target-1") } }.each(&:join)

      expect(fetches).to eq(["target-1"])
    end

    it "raises when no credentials provider is configured" do
      registry = described_class.new(service: :media)

      expect { registry.for("target-1") }.to raise_error(StorageRegistry::TargetUnavailable, /target-1/)
    end
  end

  describe "#evict" do
    it "makes the next call fetch the credentials again" do
      registry.for("target-1")
      registry.evict("target-1")
      registry.for("target-1")

      expect(fetches).to eq(%w[target-1 target-1])
    end

    it "keeps the current storage registered, so an operation already running can finish" do
      key = registry.for("target-1").adapter
      registry.evict("target-1")

      expect(::Shrine.storages[key]).to be_a(::Shrine::Storage::S3)
    end
  end

  describe "#with_storage" do
    def auth_error(code)
      Class.new(StandardError) { define_method(:code) { code } }.new("denied")
    end

    it "yields the default storage for a nil target" do
      expect { |block| registry.with_storage(nil, &block) }.to yield_with_args(Verse::Plugin[:shrine].storage)
    end

    it "returns the block's value" do
      expect(registry.with_storage("target-1") { :done }).to eq(:done)
    end

    it "evicts and retries once when the credentials are rejected" do
      attempts = 0
      result = registry.with_storage("target-1") do
        attempts += 1
        raise auth_error("InvalidAccessKeyId") if attempts == 1

        :ok
      end

      expect(result).to eq(:ok)
      expect(fetches).to eq(%w[target-1 target-1])
    end

    it "gives up after the retry" do
      attempts = 0
      expect {
        registry.with_storage("target-1") do
          attempts += 1
          raise auth_error("SignatureDoesNotMatch")
        end
      }.to raise_error(StandardError, "denied")
      expect(attempts).to eq(2)
    end

    it "evicts without retrying when the block can't run twice" do
      attempts = 0
      expect {
        registry.with_storage("target-1", retriable: false) do
          attempts += 1
          raise auth_error("InvalidAccessKeyId")
        end
      }.to raise_error(StandardError, "denied")
      registry.for("target-1")

      expect(attempts).to eq(1)
      expect(fetches).to eq(%w[target-1 target-1])
    end

    it "does not retry other errors" do
      attempts = 0
      expect {
        registry.with_storage("target-1") do
          attempts += 1
          raise auth_error("NoSuchKey")
        end
      }.to raise_error(StandardError)
      expect(attempts).to eq(1)
    end

    it "does not retry the default storage" do
      attempts = 0
      expect {
        registry.with_storage(nil) do
          attempts += 1
          raise auth_error("InvalidAccessKeyId")
        end
      }.to raise_error(StandardError)
      expect(attempts).to eq(1)
    end
  end

  it "never shows the credentials when inspected" do
    registry.for("target-1")

    expect(registry.inspect).not_to include("LEAK-CANARY-123")
    expect(registry.inspect).not_to include("AKIAEXAMPLE")
  end

  describe ".instance" do
    after { described_class.reset! }

    it "is configured for the service this process runs" do
      expect(described_class.instance.service).to eq(:media)
    end
  end
end
