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
