# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    ProjectsExpo,
    DatasetsExpo,
    EntriesExpo,
    AnnotationsExpo
  ].each(&:register)
end
