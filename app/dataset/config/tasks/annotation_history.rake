# frozen_string_literal: true

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
