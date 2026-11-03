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
# `account_id` and `account_email` are null, so the card shows "system": for an
# annotation edited before #682 the state is not one person's work.
#
# Run it once on existing data:
#
#   bundle exec rake annotation_history:backfill
namespace :annotation_history do
  desc "Insert a version-1 baseline history row for every annotation without one"
  task backfill: :environment do
    system_context = Verse::Auth::Context[:system]
    annotation_service = Annotation::Service.new(system_context)
    change_repo = AnnotationChange::Repository.new(system_context)

    total = 0

    # `chunked_index` pages through the annotations table in batches (1,000
    # rows at a time) instead of loading it all into memory.
    annotation_service.annotations.chunked_index({}).each do |annotation|
      next if change_repo.find_by({ annotation_id: annotation.id, version: 1 })

      insert_baseline_row(annotation_service, change_repo, annotation.id)
      total += 1
    end

    puts "Done. #{total} baseline rows inserted."
  end

  # Rebuild the annotation as it was at version 1 (the state when tracking
  # started) and insert a `baseline` row for it. Mirrors
  # `AnnotationChange::Service#rebuild` for the version-1 target.
  def insert_baseline_row(annotation_service, change_repo, annotation_id)
    current = annotation_service.show(annotation_id)

    # Page through every later row (a mask-heavy annotation can have more
    # than 10,000 of them) instead of capping at a single page. `chunked_index`
    # returns an Enumerator; `lazy.flat_map` chains it into a lazy stream of
    # change entries that `AnnotationDiff.revert` (it calls `each`) consumes
    # without materializing the whole history into memory.
    rows = change_repo.chunked_index(
      { annotation_id:, version__gt: 1 },
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
    change_repo.client do |db|
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
  rescue Verse::Error::RecordNotFound
    # The annotation was purged between the chunked iteration and this insert.
    nil
  rescue ::Sequel::UniqueConstraintViolation
    # A concurrent run (or a re-run) already inserted this annotation's
    # version-1 row; the unique (annotation_id, version) index makes this safe.
    nil
  end
end
