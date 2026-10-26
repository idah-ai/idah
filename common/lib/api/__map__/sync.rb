# frozen_string_literal: true

Api[:idah].register(
  :sync, :exports, :index
) do |params = {}|
  output = get(
    "sync/exports",
    params:,
    options: { auth: :bearer }
  )

  deserialize output.body
end

# Accounts allowed to perform an action on an export row (system only).
Api[:idah].register(
  :sync, :access, :check
) do |**params|
  output = post(
    "sync/access/_rpc",
    params: { jsonrpc: "2.0", method: "check", params:, id: 1 },
    options: { auth: :bearer }
  )

  body = JSON.parse(output.body, symbolize_names: true)
  raise "sync access check failed: #{body[:error].to_json}" if body[:error]

  body.dig(:result, :allowed)
end
