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
      dataset = Model::Dataset::Record.new({
        id: "1",
        name: "dataset 01",
        # topology: "video",
      })

      entry_1 = Model::Entry::Record.new()
      entry_2 = Model::Entry::Record.new()

      annotation_1_1 = Model::annotation::Record.new()
      annotation_1_2 = Model::annotation::Record.new()
      annotation_2_1 = Model::annotation::Record.new()
       
      # - 1. turn records into datset schema
      # - 2. verify the schema (on structure building section)

      # testing structure to be exported, if it works as intended
      datset = {
        dataset: {
          id: dataset.id,
          name: dataset.name,
          topology: "video",
          metadata: "this should be some kind of a metadata",
          entries: [ # loop for entries here ?
            {
              id: entry_1.id,
              media_url: entry_1.resource,
              # metadata:,
              annotations: [
                {
                  id: annotation_1_1.id,
                  type: "bounding_box", # annotation_1_1.type ?
                  dimensions: annotation_1_1.dimensions,
                  category:, # annotation_1_1.category ?
                  # metadata:,
                },
              ] # loop for annotations here ?
            },
            {
              id: entry_2.id,
              media_url: entry_2.resource,
              # metadata:,
              annotations: [] # loop for annotations here ?
            }
          ]
        },
        # "media": {}, # optional ? or from media service ?
        "metadata": { "type": "datset", "version": "1.0" } # default datset metadata
      }

      binding.pry

      DatasetSchema.validate(datset)
      
      # parse as JSON ? might not needed

      # export as .datset
      pass
    end

  end
end
