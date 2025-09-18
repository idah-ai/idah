# frozen_string_literal: true

module Datset
  class Service < Verse::Service::Base
    use dataset_repo: Dataset::Repository,
        entry_repo: Entry::Repository,
        annotation_repo: Annotation::Repository


    # import a datset file
    def import
      pass
    end

    # export into a datset file
    def export
      # prep data to DatsetSchema
      dataset = Dataset::Record.new({
        id: "1",
        # name: ,
        # topology: "video",
      })
      # datasets = dataset_repo.index({}) # TOFIX: should accept this as input ? or some id ?
      
      entry_1 = Entry::Record.new({})
      entry_2 = Entry::Record.new({})
      # entries = entry_repo.index({}) # find with some kind of id ?
      
      annotation_1_1 = Annotation::Record.new({})
      annotation_1_2 = Annotation::Record.new({})
      annotation_2_1 = Annotation::Record.new({})
      # annotations = annotation_repo.index({entry_id__in: entries_ids})
      
      # - 1. turn records into datset schema
      # - 2. verify the schema (on structure building section)

      # testing structure to be exported, if it works as intended
      datset = {
        dataset: { # this layer is not needed if we are stricting only 1 dataset ?
          id: dataset.id,
          name: "dataset 01", # dataset.name is missing from record ?
          topology: "video", # dataset.topology is missing from record ?
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
                  category: "category", # annotation_1_1.category ?
                  # metadata:,
                },
                {
                  id: annotation_1_2.id,
                  type: "bounding_box", # annotation_1_2.type ?
                  dimensions: annotation_1_2.dimensions,
                  category: "category", # annotation_1_2.category ?
                  # metadata:,
                },
              ] # loop for annotations here ?
            },
            {
              id: entry_2.id,
              media_url: entry_2.resource,
              # metadata:,
              annotations: [
                {
                  id: annotation_2_1.id,
                  type: "bounding_box", # annotation_2_1.type ?
                  dimensions: annotation_2_1.dimensions,
                  category: "category", # annotation_2_1.category ? category record ?
                  # metadata:,
                },
              ] # loop for annotations here ?
            }
          ]
        },
        # "media": {}, # optional ? or from media service ?
        metadata: { "type": "datset", "version": "1.0" } # default datset metadata
      }

      binding.pry

      # TODO: save file in a proper place, currently just write here
      File.write("exported.datset", JSON.pretty_generate(datset))

      # DatasetSchema.validate(datset)
      
      # parse as JSON ? might not needed

      # export as .datset
      # pass
    end

  end
end
