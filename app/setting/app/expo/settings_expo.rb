# frozen_string_literal: true

class SettingExpo < BaseExpo
  http_path "/setting"

  use_service Setting::Service

end
