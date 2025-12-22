# frozen_string_literal: true

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
