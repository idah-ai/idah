# frozen_string_literal: true

Verse.on_boot do
  HealthcheckExpo.register
  JobsExpo.register
  MediasExpo.register
  ProcessorExpo.register
end
