# frozen_string_literal: true

module AccountSettings
  module Defaults
    # keep string keys to put in db
    DEFAULT_ACCOUNT_SETTINGS = {
      # notifications
      "notification:organization:ownership.assigned" => true,
      "notification:organization:ownership.unassigned" => true,
      "notification:project:member.invited" => true,
      "notification:project:member.removed" => true,
      "notification:dataset.completed" => true,
    }
  end
end
