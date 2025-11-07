# frozen_string_literal: true

Api[:idah].register(
  :media, :jobs, :show,
) do |id:|
  output = get(
    "media/jobs/:id",
    params: { id: }
  )
  deserialize output.body
end

Api[:idah].register(
  :media, :videos, :process,
) do |attributes:|
  output = post(
    "media/videos/process",
    params: { data: attributes }
  )
  deserialize output.body
end
