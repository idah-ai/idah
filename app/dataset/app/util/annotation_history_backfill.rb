# frozen_string_literal: true

# One-off backfill for the annotation change history: every annotation that has
# no version-1 row gets a `baseline` row describing its state when change
# tracking started. Runs in batches (the annotations table is large) and is
# safe to re-run thanks to the unique (annotation_id, version) index.
#
# The baseline row's state is rebuilt the way `AnnotationChange::Service#rebuild`
# does it: the current state (with annotation_shape tiles merged) with every
# later row reverted. `changes` holds one `+` entry per non-nil tracked field,
# exactly as a `created` row does. `changed_at` is when the task runs and both
# `account_id` and `account_email` are null, so the card shows "system": the
# state predates change tracking and is not one person's work.
#
# The rows to revert are capped at the version that was read (`version <=
# current.version`), so a write that commits between the state read and this
# read is not reverted from a state that does not contain it.
#
# The rake task (`config/tasks/annotation_history.rake`) is a thin wrapper that
# calls `run` and prints the result.
class AnnotationHistoryBackfill
  def initialize
    @system_context = Verse::Auth::Context[:system]
    @annotation_service = Annotation::Service.new(@system_context)
    @change_repo = AnnotationChange::Repository.new(@system_context)
  end

  # Iterate every annotation (including soft-deleted ones) in batches and insert
  # a version-1 baseline row for those without one. Returns [inserted, skipped].
  def run(items_per_page: 1_000)
    inserted = 0
    skipped = 0

    @annotation_service.annotations.chunked_index({}, items_per_page:).each do |annotation|
      if @change_repo.find_by({ annotation_id: annotation.id, version: 1 })
        skipped += 1
        next
      end

      if insert_baseline_row(annotation.id)
        inserted += 1
      else
        skipped += 1
      end
    end

    [inserted, skipped]
  end

  private

  # Rebuild the annotation as it was at version 1 (the state when tracking
  # started) and insert a `baseline` row for it. Returns true when a row was
  # inserted, false when the annotation vanished or a concurrent run won.
  def insert_baseline_row(annotation_id)
    current = @annotation_service.show(annotation_id)

    # Page through every later row up to the version we read, as in
    # `AnnotationChange::Service#rebuild` (see its comment on lazy paging). The
    # `version__lte` cap keeps the state and the reverted rows consistent if a
    # write commits between the state read and this read.
    rows = @change_repo.chunked_index(
      { annotation_id:, version__gt: 1, version__lte: current.version },
      sort: ["-version"]
    )

    state = {
      "shape_type" => current.shape_type,
      "shape_args" => current.shape_args,
      "category" => current.category,
      "properties" => current.properties,
      "metadata" => current.metadata,
      "deleted_at" => current.deleted_at,
      "deleted_by_email" => current.deleted_by_email
    }

    reverted = AnnotationDiff.revert(state, rows.lazy.flat_map(&:changes))

    changes = Annotation::Repository::TRACKED_CREATE_FIELDS.filter_map do |field|
      value = reverted[field.to_s]
      next if value.nil?

      ["+", field.to_s, nil, value]
    end

    now = Time.now.utc
    @change_repo.client do |db|
      db[:annotation_changes].insert(
        id: UUIDv7.generate,
        annotation_id:,
        entry_id: current.entry_id,
        project_id: current.project_id,
        account_id: nil,
        account_email: nil,
        op: "baseline",
        version: 1,
        changes: Verse::Sequel::JsonEncoder.encode(changes),
        changed_at: now
      )
    end
    true
  rescue Verse::Error::RecordNotFound
    # The annotation was purged between the chunked iteration and this insert.
    false
  rescue ::Sequel::UniqueConstraintViolation
    # A concurrent run (or a re-run) already inserted this annotation's
    # version-1 row; the unique (annotation_id, version) index makes this safe.
    false
  end
end
