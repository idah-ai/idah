# frozen_string_literal: true

Api[:idah].register(
  :media, :medias, :index_all
) do |params = {}|
  Api.all(params) do
    output = get(
      "media/medias",
      params:,
      options: { auth: :bearer } # Enable authentication
    )
    deserialize(output.body)
  end
end

Api[:idah].register(
  :media, :jobs, :show,
) do |id:|
  output = get(
    "media/jobs/:id",
    params: { id: },
    options: { auth: :bearer }  # Enable authentication
  )
  deserialize output.body
end

Api[:idah].register(
  :media, :videos, :process,
) do |attributes:|
  output = post(
    "media/videos/process",
    params: { data: attributes },
    options: { auth: :bearer }  # Enable authentication
  )
  deserialize output.body
end

Api[:idah].register(
  :media, :medias, :resource_info,
) do |resource:, **opts|
  output = get(
    "media/medias/info/:resource",
    options: { auth: :bearer },
    params: { resource:, **opts }
  )
  deserialize output.body
end

Api[:idah].register(
  :media, :medias, :files,
) do |resource:, **opts|
  output = get(
    "media/medias/files/:resource",
    options: { auth: :bearer },
    params: { resource:, **opts }
  )
  output.body
end

# Streaming variant of +files+ — yields response body chunks to the block
# without loading the entire file into memory. Wraps the request in a
# configurable timeout (default 300s).
#
# @param resource [String] media resource ID
# @param key [String, nil] optional media key filter
# @yield [String] response body chunk
Api[:idah].register(
  :media, :medias, :files_stream,
) do |resource:, **opts, &block|
  get_stream(
    "media/medias/files/:resource",
    options: { auth: :bearer },
    params: { resource:, **opts },
    &block
  )
end
