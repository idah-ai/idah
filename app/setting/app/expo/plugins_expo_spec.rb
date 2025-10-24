# frozen_string_literal: true

RSpec.describe PluginsExpo, type: :exposition, as: :system do
  context "#serve" do
    it "serves the frontend file for the given plugin" do
      service = instance_double(Plugins::Service)
      expect(Plugins::Service).to receive(:new).and_return(service)

      plugin_name = "sample_plugin"
      filename = "index.js"
      expect(service).to receive(:serve).with(
        plugin_name,
        filename
      ).and_return("file content")

      get "/plugins/#{plugin_name}/file/#{filename}"

      puts last_response.body

      expect(last_response.status).to eq(200)
      expect(last_response.body).to eq("file content")
    end

    it "returns 404 if the plugin file is not found" do
      service = instance_double(Plugins::Service)
      expect(Plugins::Service).to receive(:new).and_return(service)

      plugin_name = "non_existent_plugin"
      filename = "missing.js"
      expect(service).to receive(:serve).with(
        plugin_name,
        filename
      ).and_return(nil)

      get "/plugins/#{plugin_name}/file/#{filename}"

      expect(last_response.status).to eq(404)
    end
  end

  context "#serve asset" do
    it "serves the asset file for the given plugin" do
      asset_service = instance_double(Plugins::AssetService)
      expect(Plugins::AssetService).to receive(:new).and_return(asset_service)

      plugin_name = "sample_plugin"
      filename = "asset.png"
      expect(asset_service).to receive(:serve).with(
        plugin_name,
        filename
      ).and_return("asset content")

      get "/plugins/#{plugin_name}/asset/#{filename}"

      puts last_response.body

      expect(last_response.status).to eq(200)
      expect(last_response.body).to eq("asset content")
    end

    it "sanitize the path to prevent directory traversal" do
      asset_service = instance_double(Plugins::AssetService)
      expect(Plugins::AssetService).to receive(:new).and_return(asset_service)
      plugin_name = "sample_plugin"
      filename = "../secret.txt"
      expect(asset_service).to receive(:serve).with(
        plugin_name,
        filename
      ).and_return(nil)
      get "/plugins/#{plugin_name}/asset/#{filename}"
      expect(last_response.status).to eq(404)
    end

    it "returns 404 if the plugin asset is not found" do
      asset_service = instance_double(Plugins::AssetService)
      expect(Plugins::AssetService).to receive(:new).and_return(asset_service)

      plugin_name = "non_existent_plugin"
      filename = "missing_asset.png"
      expect(asset_service).to receive(:serve).with(
        plugin_name,
        filename
      ).and_return(nil)

      get "/plugins/#{plugin_name}/asset/#{filename}"

      expect(last_response.status).to eq(404)
    end
  end
end
