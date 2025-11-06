# frozen_string_literal: true

class SettingsExpo < BaseExpo
  http_path "/settings"

  use_service Settings::Service
end
