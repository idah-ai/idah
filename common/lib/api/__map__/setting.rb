# frozen_string_literal: true

Api[:idah].register(
  :setting, :account_settings, :index
) do |params = {}|
  output = get(
    "setting/account_settings",
    params:,
    options: { auth: :bearer } # Enable authentication
  )

  deserialize output.body
end
