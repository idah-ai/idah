# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    ProjectsExpo,
    ProjectMembersExpo,
    DatasetsExpo,
    EntriesExpo,
    AnnotationsExpo,
    AnnotationChangesExpo,
    NoteFeedsExpo,
    NoteCommentsExpo,
    EntryStatsExpo,
    LabelConfigTemplatesExpo,
    FeedbackConfigTemplatesExpo
  ].each(&:register)
end
