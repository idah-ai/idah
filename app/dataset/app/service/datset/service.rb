# frozen_string_literal: true

module Datset
  class Service < Verse::Service::Base
    use dataset_repo: Dataset::Repository,
        entry_repo: Entry::Repository,
        annotation_repo: Annotation::Repository

    # import a datset file
    def import()
      # 1. receive .datset file and project id
      # 2. read file content and validate with DatsetSchema
      # 3. in transaction, create dataset, entries, annotations
      # 4. return created dataset
      pass
    end

    # export into a datset file
    def export(id)
      # prep data to DatsetSchema
      dataset = dataset_repo.find!("019960ab-1e80-78bf-b4d2-ebc62a6d3805") # testing id
      # mocking dataset
      # dataset = Dataset::Record.new({
      #   id: "1",
        # name: ,
        # topology: "video",
      # })

      entries = entry_repo.index({dataset_id: dataset.id}) # find with some kind of id ?
      # mocking entries
      # entry_1 = Entry::Record.new({ id: "e1" })
      # entry_2 = Entry::Record.new({ id: "e2" })
      # entries = [entry_1, entry_2] # sort by id ? created_at ? updated_at ?

      # sort by id ? created_at ? updated_at ?
      annotations = annotation_repo.index({entry_id__in: entries.map(&:id)})
      # mocking annotations
      # annotation_1_1 = Annotation::Record.new({ id: "a11", entry_id: "e1"})
      # annotation_1_2 = Annotation::Record.new({ id: "a12", entry_id: "e1"})
      # annotation_2_1 = Annotation::Record.new({ id: "a21", entry_id: "e2"})
      # annotations = [annotation_1_1, annotation_1_2, annotation_2_1]
      
      # - 1. turn records into datset schema
      # TODO - 2. verify the schema (on structure building section)

      formatted_datset = {
        dataset: { # this layer is not needed if we are stricting only 1 dataset ?
          id: dataset.id,
          name: dataset.name,
          topology: dataset.modality,
          metadata: "this should be some kind of a metadata",
          entries: []
        },
        # "media": {}, # optional ? or from media service ?
        metadata: { "type": "datset", "version": "1.0" } # this is default datset metadata
      }

      # loop through each entry
      entries.each do |entry|
        formatted_datset[:dataset][:entries] << { # add entries into dataset
          id: entry[:id],
          media_url: entry.resource,
          annotations: annotations.filter_map do |annotation| # build the entry object with annotations
            next unless annotation[:entry_id] == entry[:id]
            {
              id: annotation[:id],
              type: "bounding_box", # annotation.type ?
              dimensions: annotation.dimensions,
              category: "category", # Q: annotation.category ?
              # annotation: "", # Q: is this needed ?
              # metadata:,
            }
          end
        }
      end

      # testing structure to be exported, if it works as intended
      # datset = {
      #   dataset: { # this layer is not needed if we are stricting only 1 dataset ?
      #     id: dataset.id,
      #     name: "dataset 01", # dataset.name is missing from record ?
      #     topology: "video", # dataset.topology is missing from record ?
      #     metadata: "this should be some kind of a metadata",
      #     entries: [ # loop for entries here ?
      #       {
      #         id: entry_1.id,
      #         media_url: entry_1.resource,
      #         # metadata:,
      #         annotations: [
      #           {
      #             id: annotation_1_1.id,
      #             type: "bounding_box", # annotation_1_1.type ?
      #             dimensions: annotation_1_1.dimensions,
      #             category: "category", # annotation_1_1.category ?
      #             # metadata:,
      #           },
      #           {
      #             id: annotation_1_2.id,
      #             type: "bounding_box", # annotation_1_2.type ?
      #             dimensions: annotation_1_2.dimensions,
      #             category: "category", # annotation_1_2.category ?
      #             # metadata:,
      #           },
      #         ] # loop for annotations here ?
      #       },
      #       {
      #         id: entry_2.id,
      #         media_url: entry_2.resource,
      #         # metadata:,
      #         annotations: [
      #           {
      #             id: annotation_2_1.id,
      #             type: "bounding_box", # annotation_2_1.type ?
      #             dimensions: annotation_2_1.dimensions,
      #             category: "category", # annotation_2_1.category ? category record ?
      #             # metadata:,
      #           },
      #         ] # loop for annotations here ?
      #       }
      #     ]
      #   },
      #   # "media": {}, # optional ? or from media service ?
      #   metadata: { "type": "datset", "version": "1.0" } # default datset metadata
      # }

      binding.pry

      # TODO: save file in a proper place, currently just write here
      File.write("exported.datset", JSON.pretty_generate(formatted_datset))

      # DatasetSchema.validate(datset)
      
      # parse as JSON ? might not needed

      # export as .datset
      # pass
    end

  end
end
