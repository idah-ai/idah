# frozen_string_literal: true

class StorageRegistry
  # The credentials provider the media and sync services give the registry:
  # fetches a target's location and decrypted credentials from the setting
  # service, which serves them to the system role only. The result stays in the
  # registry's memory; nothing here logs or stores it.
  module SettingCredentials
    FIELDS = %i[endpoint region bucket prefix path_style access_key_id secret_access_key].freeze

    module_function

    def call(target_id)
      target = Api[:idah].setting.storage_targets.credentials(id: target_id)

      FIELDS.to_h { |field| [field, target.attributes&.[](field)] }
    rescue Api::HTTPError => e
      # No such target: the registry reports it as unavailable.
      raise unless e.status == 404

      nil
    end
  end
end
