# frozen_string_literal: true

Api[:idah].register(
  :iam, :accounts, :index,
) do
  output = get(
    "iam/accounts",
    options: { auth: nil },
    params: { filters: {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false }
  )
  deserialize output.body
end

Api[:idah].register(
  :iam, :accounts, :show,
) do |id:|
  output = get(
    "iam/accounts/:id",
    options: { auth: nil },
    params: {id:}
  )
  deserialize output.body
end

Api[:idah].register(
  :iam, :accounts, :create,
) do |attributes:|
  output = post(
    "iam/accounts",
    options: { auth: nil },
    body: { data: { type: "iam:accounts", attributes: } }
  )
  deserialize output.body
end