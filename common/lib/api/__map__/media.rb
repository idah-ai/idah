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
