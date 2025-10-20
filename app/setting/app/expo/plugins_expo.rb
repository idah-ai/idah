class PluginsExpo < BaseExpo
  http_path "/plugins"

  use_service Plugins::Service

  expose on_http(:get, ":plugin/file/:filename",
    auth: nil,
    renderer: Verse::Http::Renderer::Identity
  ) do
    input do
      field :plugin, String
      field :filename, String
    end
  end
  def serve
    service.serve(
      params[:plugin],
      params[:filename]
    ) || server.not_found
  end
end