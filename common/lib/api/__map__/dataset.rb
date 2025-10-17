# frozen_string_literal: true

Api[:idah].register(
  :dataset, :entries, :show
) do |id:, **opts|
  output = get(
    "entries/:id",
    params: {
      id:, **opts
    },
    options: { auth: nil },
  )

  deserialize output.body
end

Api[:idah].register(
  :dataset, :entries, :update
) do |id:, **attributes|
  output = patch(
    "entries/:id",
    {
      id:,
      data: {
        type: Resource::Dataset::Entries,
        attributes:
      }
    },
    options: { auth: nil }
  )

  deserialize output.body
end
