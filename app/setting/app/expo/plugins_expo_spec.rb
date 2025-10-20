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
end
