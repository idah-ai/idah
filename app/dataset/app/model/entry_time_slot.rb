# frozen_string_literal: true

module EntryTimeSlot
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::EntryTimeSlots

    field :id, type: String, primary: true
    field :entry_id, type: String, readonly: true
    field :account_id, type: Integer
    field :wf_step, type: String
    field :slot_start, type: Time
    belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "entry_time_slots"
    self.resource = Resource::Dataset::EntryTimeSlots

    def insert_slot(entry_id, account_id, wf_step, slot_start)
      # Returns true when a new row was inserted, false when the slot already
      # existed (INSERT … ON CONFLICT DO NOTHING — no rows inserted).
      table.insert_conflict.insert(
        id: UUIDv7.generate,
        entry_id: entry_id,
        account_id: account_id,
        wf_step: wf_step,
        slot_start: slot_start
      ) != 0
    end
  end
end
