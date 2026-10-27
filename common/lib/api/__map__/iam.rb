# frozen_string_literal: true

Api[:idah].register(
  :iam, :accounts, :index,
) do |params = {}|
  output = get(
    "iam/accounts",
    params:,
    options: { auth: :bearer } # Enable authentication
  )

  deserialize output.body
end

Api[:idah].register(
  :iam, :accounts, :show,
) do |id:|
  output = get(
    "iam/accounts/:id",
    params: { id: },
    options: { auth: :bearer }
  )
  deserialize output.body
end

Api[:idah].register(
  :iam, :accounts, :invite,
) do |attributes:|
  output = post(
    "iam/accounts/invite",
    params: attributes,
    options: { auth: :bearer } # Enable authentication
  )
  deserialize output.body
end

Api[:idah].register(
  :iam, :accounts, :resend_invitation,
) do |id:|
  output = post(
    "iam/accounts/:id/resend_invitation",
    params: { id: },
    options: { auth: :bearer } # Enable authentication
  )
  deserialize output.body
end

Api[:idah].register(
  :iam, :auth, :login,
) do |email:, password:|
  output = post(
    "iam/auth/login",
    params: { email:, password: }
  )

  deserialize output.body
end

Api[:idah].register(
  :iam, :auth, :logout,
) do |_d|
  output = get(
    "iam/auth/logout"
  )
  deserialize output.body
end

Api[:idah].register(
  :iam, :organizations, :index
) do |params = {}|
  output = get(
    "iam/organizations",
    params:,
    options: { auth: :bearer } # Enable authentication
  )

  deserialize output.body
end

Api[:idah].register(
  :iam, :organizations, :show,
) do |id:|
  output = get(
    "iam/organizations/:id",
    params: { id: },
    options: { auth: :bearer }
  )
  deserialize output.body
end
