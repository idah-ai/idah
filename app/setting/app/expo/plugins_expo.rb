class PluginsExpo < BaseExpo
  http_path "/plugins"

  # GET plugins/modalities # return all modalities available
  # GET plugins/:plugin_name/files/plugin.js|css # Entrypoint pour le plugin
  # GET plugins/:plugin_name/files/entry.js|css # Entrypoint for show les entries
  # GET plugins/:plugin_name/assets/... # public static files

  use_service Plugins::AssetService

  expose on_http(:get, "modalities",
    auth: nil,
  ) do
    output do
      field :data, Hash, of: Verse::Schema.array(String)
    end
  end
  def modalities
    service.show_modalities
  end

  expose on_http(:get, ":plugin/files/assets/*filepath",
    auth: nil,
    renderer: Verse::Http::Renderer::Identity
  ) do
    input do
      field :plugin, String
      field :filepath, String
    end
  end
  def serve_asset
    binding.pry

    asset_service.serve_asset(
      params[:plugin],
      params[:filepath]
    ) || server.not_found
  end

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