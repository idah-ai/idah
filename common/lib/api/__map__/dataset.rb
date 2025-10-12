# frozen_string_literal: true

Api[:idah].register(
  :dataset, :entries, :show,
) do |id:|
  output = get(
    "entries/:id",
    options: { auth: nil },
    params: { id: }
  )

  deserialize output.body
end
