module Plugins
  class Service < Verse::Service::Base
    def install(plugin_name)
      Manager.run do
        install_plugin()
      end
    end
  end
end