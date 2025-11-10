# frozen_string_literal: true

Api[:idah].register(
  :dataset, :entries, :show
) do |id:, **opts|
  output = get(
    "dataset/entries/:id",
    params: {
      id:, **opts
    },
    options: { auth: :bearer }  # Enable authentication
  )

  deserialize output.body
end

Api[:idah].register(
  :dataset, :entries, :update
) do |id:, **attributes|
  output = patch(
    "dataset/entries/:id",
    params: {
      id:,
      data: {
        type: Resource::Dataset::Entries,
        attributes:
      }
    },
    options: { auth: :bearer }  # Enable authentication
  )

  deserialize output.body
end
