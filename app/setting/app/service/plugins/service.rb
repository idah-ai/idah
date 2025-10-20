module Plugins
  class Service < Verse::Service::Base
    use repo: Plugin::Repository

    def install(plugin_name)
      Manager.run do
        install_plugin()
      end
    end

    def find(plugin_name)
      # 1. check for manual plugins

      # 2. if manual plugin not found, check in the database
      repo.find_by({name: plugin_name})

      # if not found, return nil
    end

    def serve(plugin_name, filename)
      raise "TODO: Implement plugin frontend serving"
    end
  end
end