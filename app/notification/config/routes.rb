# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    EmailsExpo,
    WebhooksExpo
  ].each(&:register)
end
