# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:entries) do
      set_column_default :wf_step, "annotate"
    end

    # Update existing "start" steps to "annotate"
    from(:entries).where(wf_step: "start").update(wf_step: "annotate")
  end
end
