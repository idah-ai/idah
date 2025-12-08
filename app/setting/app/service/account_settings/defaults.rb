# frozen_string_literal: true

module AccountSettings
  module Defaults
    # keep string keys to put in db
    DEFAULT_ACCOUNT_SETTINGS = {
      # notifications
      "notification:organization:activities" => true,
      "notification:project:activities" => true,
    }
  end
end
