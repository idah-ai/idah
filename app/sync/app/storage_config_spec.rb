# frozen_string_literal: true

require "erb"
require "yaml"

RSpec.describe "Storage configuration" do
  config_path = File.expand_path("../config/config.yml", __dir__)

  s3_env = {
    "SYNC_FILES_ADAPTER" => "s3",
    "SYNC_FILES_BUCKET" => "bucket",
    "SYNC_FILES_ACCESS_KEY_ID" => "key",
    "SYNC_FILES_SECRET_ACCESS_KEY" => "secret",
    "SYNC_FILES_REGION" => "europe-west1",
    "SYNC_FILES_ENDPOINT" => "https://storage.googleapis.com"
  }

  # The default storage as config.yml renders it with these variables set, the
  # others left as they are.
  def storage(config_path, env)
    saved = env.keys.to_h { |key| [key, ENV.fetch(key, nil)] }
    env.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }

    config = YAML.safe_load(ERB.new(File.read(config_path)).result, aliases: true, permitted_classes: [Symbol])
    config.fetch("plugins")
          .find { |plugin| plugin["name"] == "shrine" }
          .dig("config", "storages")
          .find { |storage| storage["name"] == "default" }
  ensure
    saved&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end

  def prefix(config_path, env)
    storage(config_path, env).dig("config", "prefix")
  end

  it "stores under sync/files/ when SYNC_FILES_PREFIX is not set" do
    expect(prefix(config_path, s3_env.merge("SYNC_FILES_PREFIX" => nil))).to eq("sync/files")
  end

  it "stores under sync/files/ when SYNC_FILES_PREFIX is empty, as compose passes an unset one" do
    expect(prefix(config_path, s3_env.merge("SYNC_FILES_PREFIX" => ""))).to eq("sync/files")
  end

  it "stores under SYNC_FILES_PREFIX when it is set" do
    expect(prefix(config_path, s3_env.merge("SYNC_FILES_PREFIX" => "safran/exports"))).to eq("safran/exports")
  end

  it "drops leading and trailing slashes, which would double up in every key" do
    expect(prefix(config_path, s3_env.merge("SYNC_FILES_PREFIX" => "/archive/"))).to eq("archive")
  end

  it "has no prefix with the file_system adapter, which stores under a path" do
    config = storage(config_path, { "SYNC_FILES_ADAPTER" => nil, "SYNC_FILES_PREFIX" => "exports" })

    expect(config["adapter"]).to eq("file_system")
    expect(config["config"]).not_to have_key("prefix")
  end
end
