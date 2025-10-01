# frozen_string_literal: true

module Expo
  module Util
    module DuplicateFieldHelper
      module_function

      def duplicate(resource, repository_class:, foreign_key:, fields: {}, raise_exception: false)
        expo = self

        method_name = resource.gsub(/[^a-z_]/, "_")
        method_name = "duplicate_field_on_#{method_name}_change"

        hook_update = expo.on_resource_event(resource, "updated")

        expo.define_method(method_name) do
          auth_context.mark_as_checked!

          record_id = message.content[:resource_id]
          repo = repository_class.new(auth_context)
          records = repo.table.select(:id).where({ foreign_key => record_id }).all

          if records.empty?
            raise Verse::Error::RecordNotFound, { id: record_id } if raise_exception

            next
          end

          # Only update the fields that are present in the message content
          update_values = message.content.dig(:args, 0)
          fields_to_update = fields.select { |k, _| update_values.key?(k) }

          records.each do |record|
            repo.update(record[:id], fields_to_update.transform_values { |v| update_values[v] })
          end
        end

        expo.attach_exposition(method_name, expo.build_expose(hook_update))
      end
    end
  end
end
