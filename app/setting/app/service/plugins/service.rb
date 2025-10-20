module Plugins
  class Service < Verse::Service::Base
    def install(plugin_name)
      Manager.run do
        install_plugin()
      end
    end

    def serve(plugin_name, filename)
      raise "TODO: Implement plugin frontend serving"
    end
  end
end