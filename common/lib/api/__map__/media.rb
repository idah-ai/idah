# frozen_string_literal: true

Api[:idah].register(
  :media, :jobs, :show,
) do |**params|
  output get(
    "media/jobs/:id",
    http_opts: { auth: nil },
    params:
  )
  deserialize output
end
