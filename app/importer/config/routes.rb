# frozen_string_literal: true

Verse.on_boot do
  Expo::Healthcheck.register
end
