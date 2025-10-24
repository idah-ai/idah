RSpec.describe Plugins::AssetService, type: :service, as: :system do

  describe "#serve" do
    it "serves the plugin file if found (manual)" do
      plugin_name = "sample_plugin"

      allow(Verse.config.extra_fields).to receive(:dig).with(
        :idah, :plugins, :manual
      ).and_return([plugin_name])

      # allow(Plugin::Record).to receive(:from_path).and_return(
        # Plugin::Record.new(
        #   name: plugin_name,
        #   source_type: "manual",
        #   source_path: File.join("plugins", plugin_name)
        # )
      # )

      filename = "index.js"

      output = service.serve(plugin_name, filename)
    end
  end
end