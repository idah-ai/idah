# frozen_string_literal: true

# Access checks for the notification service (system only).
class AccessExpo < BaseExpo
  http_path "/access"

  use_service Access::Service

  json_rpc http_path: "_rpc"

  CHECK_PARAMS = %i[rule principals action resource id own_account_id].freeze

  expose json_rpc_method(:check) do
    input do
      field(:rule, String)
      field(:principals, Array)
      field(:action, String)
      field(:resource, String)
      field(:id, String)
      field?(:own_account_id, [Integer, String])
    end
  end
  def rpc_check
    { allowed: service.check(**params.slice(*CHECK_PARAMS)) }
  end
end
