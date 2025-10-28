RSpec.describe Plugins::Service, type: :service, as: :system do

  describe "#serve" do
    it "serves the plugin file if found (manual)" do
      plugin_name = "fake_plugin"

      allow(Verse.config).to receive(:extra_fields).and_return(
        idah: {
          plugins: {
            manual: [plugin_name],
            path: "app/spec_data"
          }
        }
      )

      filename = "plugin.js"

      output = service.serve_file(plugin_name, filename)

      expect(output).to eq("/* I am a javascript plugin file */")
    end
  end
end