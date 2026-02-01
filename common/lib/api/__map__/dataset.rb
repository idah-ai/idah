# frozen_string_literal: true

Api[:idah].register(
  :dataset, :annotations, :index
) do |params = {}|
  output = get(
    "dataset/annotations",
    params:,
    options: { auth: :bearer },
  )

  deserialize output.body
end

Api[:idah].register(
  :dataset, :entries, :index
) do |params = {}|
  output = get(
    "dataset/entries",
    params:,
    options: { auth: :bearer }  # Enable authentication
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
    options: { auth: :bearer }  # Enable authentication
  )

  deserialize output.body
end

Api[:idah].register(
  :dataset, :datasets, :index
) do |**opts|
  output = get(
    "dataset/datasets",
    params: { **opts },
    options: { auth: :bearer },
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
    options: { auth: :bearer },
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

Api[:idah].register(
  :dataset, :projects, :index
) do |params = {}|
  output = get(
    "dataset/projects",
    params:,
    options: { auth: :bearer }  # Enable authentication
  )

  deserialize output.body
end

Api[:idah].register(
  :dataset, :projects, :index_all
) do |params = {}|
  params[:page] ||= {}
  params[:page][:size] ||= 1_000
  params[:page][:number] ||= 1

  items_per_page = params[:page][:size]

  break_next_page = false

  Verse::Util::Iterator.chunk_iterator(params[:page][:number]) do |current_page|
    params[:page][:number] = current_page

    next nil if break_next_page

    output = get(
      "dataset/projects",
      params:,
      options: { auth: :bearer }  # Enable authentication
    )

    break_next_page = result.count < items_per_page
    result.count == 0 ? nil : deserialize(output.body)
  end
end

Api[:idah].register(
  :dataset, :project_members, :index
) do |params = {}|
  output = get(
    "dataset/project_members",
    params:,
    options: { auth: :bearer }  # Enable authentication
  )

  deserialize output.body
end
