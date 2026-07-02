# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    ProjectsExpo,
    ProjectMembersExpo,
    DatasetsExpo,
    EntriesExpo,
    AnnotationsExpo,
    NoteFeedsExpo,
    NoteCommentsExpo,
    EntryStatsExpo,
    LabelingConfigurationTemplatesExpo
  ].each(&:register)
end
