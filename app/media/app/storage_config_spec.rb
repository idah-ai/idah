# frozen_string_literal: true

require "erb"
require "yaml"

RSpec.describe "Storage configuration" do
  config_path = File.expand_path("../config/config.yml", __dir__)

  s3_env = {
    "MEDIAS_FILES_ADAPTER" => "s3",
    "MEDIAS_FILES_BUCKET" => "bucket",
    "MEDIAS_FILES_ACCESS_KEY_ID" => "key",
    "MEDIAS_FILES_SECRET_ACCESS_KEY" => "secret",
    "MEDIAS_FILES_REGION" => "europe-west1",
    "MEDIAS_FILES_ENDPOINT" => "https://storage.googleapis.com"
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

  it "stores under media/files/ when MEDIAS_FILES_PREFIX is not set" do
    expect(prefix(config_path, s3_env.merge("MEDIAS_FILES_PREFIX" => nil))).to eq("media/files")
  end

  it "stores under media/files/ when MEDIAS_FILES_PREFIX is empty, as compose passes an unset one" do
    expect(prefix(config_path, s3_env.merge("MEDIAS_FILES_PREFIX" => ""))).to eq("media/files")
  end

  it "stores under MEDIAS_FILES_PREFIX when it is set" do
    expect(prefix(config_path, s3_env.merge("MEDIAS_FILES_PREFIX" => "safran/media"))).to eq("safran/media")
  end

  it "drops leading and trailing slashes, which would double up in every key" do
    expect(prefix(config_path, s3_env.merge("MEDIAS_FILES_PREFIX" => "/uploads/"))).to eq("uploads")
  end

  it "has no prefix with the file_system adapter, which stores under a path" do
    config = storage(config_path, { "MEDIAS_FILES_ADAPTER" => nil, "MEDIAS_FILES_PREFIX" => "media" })

    expect(config["adapter"]).to eq("file_system")
    expect(config["config"]).not_to have_key("prefix")
  end
end
