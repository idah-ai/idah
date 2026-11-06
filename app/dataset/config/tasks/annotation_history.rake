# frozen_string_literal: true

# One-off backfill for the annotation change history: every annotation that has
# no version-1 row gets a `baseline` row describing its state when change
# tracking started. The logic lives in `AnnotationHistoryBackfill` (under
# `app/util/`) so it can be tested; this task is a thin wrapper that calls it
# and prints the result.
#
# Run it once on existing data:
#
#   bundle exec rake annotation_history:backfill
namespace :annotation_history do
  desc "Insert a version-1 baseline history row for every annotation without one"
  task backfill: :environment do
    inserted, skipped = AnnotationHistoryBackfill.new.run
    puts "Done. #{inserted} baseline rows inserted, #{skipped} skipped."
  end
end
