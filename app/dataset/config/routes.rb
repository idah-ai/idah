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
    EntryStatsExpo
  ].each(&:register)
end
