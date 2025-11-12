# frozen_string_literal: true

module Validation
  module Service
    module_function

    def require!(field_name, value, action_label = "perform this action")
      return if value

      raise Verse::Error::ValidationFailed,
            "#{field_name} relationship is required to #{action_label}"
    end
  end
end
