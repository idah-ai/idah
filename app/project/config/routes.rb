# frozen_string_literal: true

Verse.on_boot do
  HealthcheckExpo.register
  ProjectsExpo.register
  DatasetsExpo.register
end
