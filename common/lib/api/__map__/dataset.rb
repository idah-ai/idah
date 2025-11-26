# frozen_string_literal: true

Api[:idah].register(
  :dataset, :annotations, :index
) do |**opts|
  output = get(
    "dataset/annotations",
    params: { **opts },
    options: { auth: nil },
  )

  deserialize output.body
end

Api[:idah].register(
  :dataset, :entries, :index
) do |**opts|
  output = get(
    "dataset/entries",
    params: { **opts },
    options: { auth: nil },
  )

  deserialize output.body
end

Api[:idah].register(
  :dataset, :entries, :show
) do |id:, **opts|
  output = get(
    "dataset/entries/:id",
    params: {
      id:, **opts
    },
    options: { auth: nil },
  )

  deserialize output.body
end

Api[:idah].register(
  :dataset, :datasets, :show
) do |id:, **opts|
  output = get(
    "dataset/datasets/:id",
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
    "dataset/entries/:id",
    params: {
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
