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

# A storage target's location and decrypted credentials. The setting service
# serves them to the system role only (the media and sync service accounts).
Api[:idah].register(
  :setting, :storage_targets, :credentials
) do |id:|
  output = get(
    "setting/storage_targets/:id/_credentials",
    params: { id: },
    options: { auth: :bearer }
  )

  deserialize output.body
end
