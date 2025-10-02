class PluginsExpo < BaseExpo
  http_path "/plugins"

  use_service Plugins::Service
end