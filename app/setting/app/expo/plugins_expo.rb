# frozen_string_literal: true

class PluginsExpo < BaseExpo
  http_path "/plugins"

  # GET plugins/modalities                  # list all available modalities
  # GET plugins/modalities/:modality_name   # shapes for a single modality
  # GET plugins/:plugin/files/:filename      # serve an allowlisted plugin file
  #   (plugin.js|css, details.js|css, dataset_config.json, plugin_shortcut.json)
  # GET plugins/:plugin/assets/*             # serve public static plugin assets

  use_service Plugins::Service

  desc <<~MD
    Manage and serve plugins within the system, including
    listing available modalities, retrieving modality details,
    and serving plugin assets and files.
  MD

  expose on_http(
    :get,
    "modalities",
    auth: nil,
  ) do
    output do
      field :data, Hash do
        field(:modalities, Hash).meta(description: "Mapping of modality IDs to their details")
        field(:plugins, Hash).meta(description: "Mapping of modality IDs to plugin names")
      end
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

    output do
      field :data, Hash do
        field(:shapes, Hash).meta(description: "Mapping of shape names to their details")
      end
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

    # Explicit content type + no MIME sniffing on untrusted plugin assets.
    renderer.content_type = PluginMimeType.for(params[:splat].last)
    server.response.headers["X-Content-Type-Options"] = "nosniff"

    io
  end

  expose on_http(
    :get,
    ":plugin/files/:filename",
    auth: nil,
    renderer: Verse::Http::Renderer::Identity
  ) do
    input do
      field :plugin, String
      field :filename, String
    end
  end
  def serve
    content = service.serve_file(
      params[:plugin],
      params[:filename]
    )

    return server.not_found unless content

    # Content type is derived from the requested filename (not the on-disk
    # manifest path), with sniffing disabled on untrusted plugin files.
    server.response.headers["Content-Type"] = PluginMimeType.for(params[:filename])
    server.response.headers["X-Content-Type-Options"] = "nosniff"

    content
  end
end
