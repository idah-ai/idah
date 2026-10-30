# frozen_string_literal: true

namespace :entry_stats do
  # DRY_RUN=1 bundle exec rake entry_stats:backfill_orphans
  desc "Recompute orphan_category.count for entries with orphaned annotation categories"
  task backfill_orphans: :environment do
    system = Verse::Auth::Context[:system]
    dataset_repo  = Dataset::Repository.new(system)
    entry_repo    = Entry::Repository.new(system)
    annotation_repo = Annotation::Repository.new(system)
    dry_run = ENV.fetch("DRY_RUN", "") == "1"

    Verse.logger.level = Logger::WARN

    affected = {}

    dataset_repo.chunked_index({}).each do |dataset|
      configured = dataset.configured_category_ids
      next if configured.empty?

      orphan_entry_ids = annotation_repo.table
                                        .where(dataset_id: dataset.id, deleted_at: nil)
                                        .exclude(category: configured)
                                        .distinct(:entry_id)
                                        .select_map(:entry_id)

      next if orphan_entry_ids.empty?

      affected[dataset.id] = {
        dataset_name: dataset.name,
        entry_ids: orphan_entry_ids
      }
    end

    if affected.empty?
      puts "No entries with orphan categories found."
    else
      total = affected.values.map{ |v| v[:entry_ids].size }.sum
      puts "Found #{total} entries with orphan categories across #{affected.size} datasets:"
      affected.each_value do |info|
        puts "  #{info[:dataset_name]} -> #{info[:entry_ids].size} entries"
      end

      if dry_run
        puts "DRY_RUN=1 - no changes written."
      else
        puts "Recomputing orphan_category.count for each entry..."
        count = 0
        affected.each_value do |info|
          info[:entry_ids].each do |entry_id|
            begin
              entry = entry_repo.find!(entry_id, included: [:dataset, :annotations])
              EntryStats::Recompute.orphan_only(entry)
            rescue StandardError => e
              Verse.logger.error(
                "[backfill_orphans] Failed for entry #{entry_id} " \
                "(dataset #{info[:dataset_name]}): #{e.message}"
              )
            end
            count += 1
            $stdout.write(".") if count % 100 == 0
          end
        end
        $stdout.write("\nDone.\n")
      end
    end
  end
end
