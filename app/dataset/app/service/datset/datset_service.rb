# frozen_string_literal: true

module Datset
  class Service < Verse::Service::Base
    # import a datset file
    def import
      pass
    end

    # export into a datset file
    def export
      # prep data to DatsetSchema
      
      # - 1. turn records intio datset schema
      # - 2. verify the schema

      datset = {
        "dataset": {},
        # "media": {}, # optional ?
        "metadata": { "type": "datset", "version": "1.0" }
      }

      binding.pry

      DatasetSchema.validate(datset)
      
      # parse as JSON ? might not needed

      # export as .datset
      pass
    end

  end
end
