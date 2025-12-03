# frozen_string_literal: true

module AccountSetting
  class Record < Verse::Model::Record::Base
    type Resource::Setting::AccountSettings
    field :id, type: Integer, primary: true

    field :account_id, type: Integer
    field :key, type: String, readonly: true
    field :plugin, type: String, readonly: true
    field :value,
          type: [
            Hash, Array, String,
            Integer, Float, TrueClass, NilClass
          ]
  end

  class Repository < Verse::Sequel::Repository
    self.table = "account_settings"

    encoder :value, Verse::Sequel::JsonEncoder

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.own? {
          table if action == :create
          
          table.where(account_id: auth_context.metadata[:id])
        }
      end
    end

    query
    def get(key, account_id:, plugin: "", default: nil)
      find_by(
        {
          key:,
          account_id:,
          plugin:
        }
      )&.value || default
    end

    event(name: "updated")
    def set(key, value, account_id:, plugin: "")
      table = scoped(:update)

      value = Sequel.lit("?::jsonb", value.to_json)

      table.insert_conflict(
        target: %i[key account_id plugin],
        update: { value: }
      ).insert({
                 key:,
                 value:,
                 account_id:,
                 plugin:
               })

      true
    end
  end
end
