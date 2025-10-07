class PluginsExpo < BaseExpo
  http_path "/plugins"

  use_service Plugins::Service

  expose on_http(:get, ":plugin/index.js") do
    input do
      field :plugin, String
    end
  end
  def serve_frontend
    service.serve_frontend(
      params[:plugin]
    )
  end
end