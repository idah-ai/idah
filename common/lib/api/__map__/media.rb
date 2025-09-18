# frozen_string_literal: true

Api[:idah].register(
  :media, :jobs, :show,
) do |id:|
  output = get(
    "media/jobs/:id",
    options: { auth: nil },
    params: {id:}
  )
  deserialize output.body
end

Api[:idah].register(
  :media, :videos, :process,
) do |attributes:|
  output = post(
    "media/videos/process",
    options: { auth: nil },
    params: { data: attributes }
  )
  deserialize output.body
end
