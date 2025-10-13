# frozen_string_literal: true

Verse.on_boot do
  HealthcheckExpo.register
  JobsExpo.register
  MediasExpo.register
  VideosExpo.register
  ProcessorExpo.register
end
