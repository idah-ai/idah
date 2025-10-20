RSpec.describe Plugins::Service, type: :service, as: :system do

  describe "#serve" do
    it "serves the plugin file or returns nil if not found" do
      plugin_name = "sample_plugin"
      filename = "index.js"

      output = service.serve(plugin_name, filename)
    end
  end
end