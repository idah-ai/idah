class PluginsExpo < BaseExpo
  http_path "/plugins"

  use asset_service: Plugins::AssetService

  expose on_http(:get, ":plugin/files/:filename",
    auth: nil,
    renderer: Verse::Http::Renderer::Identity
  ) do
    input do
      field :plugin, String

      field :module, String
      field :filename, String
    end
  end
  def serve
    asset_service.serve(
      params[:plugin],
      params[:filename]
    ) || server.not_found
  end
end