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
    WorkflowsExpo,
  ].each(&:register)
end
