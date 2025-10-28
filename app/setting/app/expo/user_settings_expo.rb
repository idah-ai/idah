# frozen_string_literal: true

class UserSettingsExpo < BaseExpo
  http_path "/user_settings"

  use_service UserSettings::Service
end
