# frozen_string_literal: true

module Setting
  class Record < Verse::Model::Record::Base
    type Resource::Setting::Settings

    field :id, type: Integer, primary: true

    field :key, type: String, readonly: true
    field :value, type: [
      Hash, Array, String,
      Integer, Float, TrueClass, NilClass
    ]
  end

  class Repository < Verse::Sequel::Repository
    self.table = "settings"
    self.resource = Resource::Setting::Settings

    encoder :value, Verse::Sequel::JsonEncoder

    query
    def get(key, default: nil)
      find(key:)&.value || default
    end

    event(name: "updated")
    def set(key, value)
      table = scoped(:update)

      table.insert_conflict(
        target: %i[key],
        update: { value: }
      ).insert({ key:, value: }).returning_all.first
    end
  end
end
