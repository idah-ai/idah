# frozen_string_literal: true

# Existing accounts only receive account_settings rows at account-creation time,
# so backfill the annotation category-label visibility preference for every
# account that already has settings but lacks it. The setting is stored per
# plugin (idah-image / idah-video) so image and video preferences stay
# independent; each account gets one row per plugin, defaulting to "never".
# This gives the frontend a row to UPDATE. New accounts get these rows via
# AccountSettings::Defaults.
Sequel.migration do
  up do
    account_ids = from(:account_settings)
                  .exclude(account_id: nil)
                  .distinct
                  .select_map(:account_id)

    account_ids.each do |account_id|
      %w[idah-image idah-video].each do |plugin|
        from(:account_settings)
          .insert_conflict(target: %i[account_id key plugin])
          .insert(
            account_id:,
            key: "annotation:category.label-visibility",
            plugin:,
            value: Sequel.lit("?::jsonb", '"never"'),
          )
      end
    end
  end

  down do
    from(:account_settings).where(key: "annotation:category.label-visibility").delete
  end
end
