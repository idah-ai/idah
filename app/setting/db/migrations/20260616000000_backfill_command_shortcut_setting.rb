# frozen_string_literal: true

# Existing accounts only receive account_settings rows at account-creation time,
# so backfill an empty "command:shortcut" override row for every account that
# already has settings but lacks this key. This gives the frontend a row to
# UPDATE. New accounts get the key via AccountSettings::Defaults.
Sequel.migration do
  up do
    account_ids = from(:account_settings)
                  .exclude(account_id: nil)
                  .distinct
                  .select_map(:account_id)

    account_ids.each do |account_id|
      from(:account_settings)
        .insert_conflict(target: %i[account_id key plugin])
        .insert(
          account_id:,
          key: "command:shortcut",
          plugin: "",
          value: Sequel.lit("?::jsonb", "{}"),
        )
    end
  end

  down do
    from(:account_settings).where(key: "command:shortcut", plugin: "").delete
  end
end
