# frozen_string_literal: true

# Builds an account's auth context from its role and scope, as its token would.
module AuthContextBuilder
  module_function

  def build(account_id:, role_name:, role_scope: {})
    custom_scopes = (role_scope || {}).to_h do |key, values|
      [key.to_sym, Array(values).map(&:to_s)]
    end

    Verse::Auth::Context.from_role(
      role_name.to_s,
      custom_scopes:,
      metadata: { id: account_id, role: role_name.to_sym }
    )
  end
end
