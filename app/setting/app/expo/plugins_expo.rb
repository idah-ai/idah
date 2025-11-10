# frozen_string_literal: true

class PluginsExpo < BaseExpo
  http_path "/plugins"

  # GET plugins/modalities # return all modalities available
  # GET plugins/:plugin_name/files/plugin.js|css # Entrypoint pour le plugin
  # GET plugins/:plugin_name/files/entry.js|css # Entrypoint for show les entries
  # GET plugins/:plugin_name/assets/... # public static files

  use_service Plugins::Service

  expose on_http(
    :get,
    "modalities",
    auth: nil,
  ) do
    output do
      field :data, Hash, of: Verse::Schema.array(String)
    end
  end
  def modalities
    service.show_modalities
  end

  expose on_http(
    :get,
    "modalities/:modality_name",
    auth: nil
  ) do
    input do
      field :modality_name, String
    end
  end
  def show_modality
    service.show_modality(params[:modality_name])
  end

  expose on_http(
    :get,
    ":plugin/assets/*",
    auth: nil,
    renderer: Verse::Http::Renderer::Binary
  ) do
    input do
      field :plugin, String
      field :splat, Array, of: String
    end
  end
  def serve_asset
    # Sanitize path to prevent directory traversal
    if params[:splat].any?{ |part| ["..", "."].include?(part) }
      return server.not_found
    end

    io = service.serve_asset(
      params[:plugin],
      params[:splat].join("/")
    )

    return server.not_found unless io

    io
  end

  expose on_http(
    :get,
    ":plugin/files/:filename",
    auth: nil,
    # renderer: Verse::Http::Renderer::Identity
    renderer: Class.new do
      def render(result, server)
        case File.extname(server.request.env["verse.http.server"].params["filename"])
        when ".js"
          server.response["content-type"] = "text/javascript"
        when ".css"
          server.response["content-type"] = "text/css"
        end

        result
      end
    end
  ) do
    input do
      field :plugin, String
      field :filename, String
    end
  end
  def serve
    service.serve_file(
      params[:plugin],
      params[:filename]
    ) || server.not_found
  end
end
