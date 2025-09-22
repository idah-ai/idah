# frozen_string_literal: true

module Datset
  class Service < Verse::Service::Base
    use dataset_repo: Dataset::Repository,
        entry_repo: Entry::Repository,
        annotation_repo: Annotation::Repository

    # import a datset file
    def import(file_path:, project_id:)
      # 1. receive .datset file and project id
      # 2. read file content and validate with DatsetSchema
      # TODO: properly read from file store
      datset_data = JSON.parse(File.read(file_path)).transform_keys(&:to_sym)
      # datset_data = JSON.parse(File.read("exported.datset")).transform_keys(&:to_sym) # mocking file path
      dataset_data = datset_data[:dataset].transform_keys(&:to_sym)
      # TODO: check/process metadata ?
      # TODO: DatsetSchema validation ?

      # 3. in transaction, create dataset, entries, annotations
      dataset_repo.transaction do
        # create dataset
        dataset_id = dataset_repo.create({
          project_id:,
          # project_id: "019960aa-f756-71e1-8397-899be8413bb5", # mocking param
          name: dataset_data[:name],
          modality: dataset_data[:topology],
          workflow_configuration: {},
          labeling_configuration: {},
        })

        # create entries and their annotations
        dataset_data[:entries].each do |entry_data|
          entry_data = entry_data.transform_keys(&:to_sym)
          # create the entry
          # TODO: EntrySchema validation ?
          entry_id = entry_repo.create(
            id: entry_data[:id],
            dataset_id: dataset_id,
            resource: entry_data[:media_url]
            # add other entry fields as needed
          )
          
          # create annotations for this entry
          entry_data[:annotations].each do |annotation_data|
            annotation_data = annotation_data.transform_keys(&:to_sym)
            # TODO: AnnotationSchema validation ?
            annotation_repo.create(
              id: annotation_data[:id],
              entry_id: entry_id,
              # type: annotation_data[:type],
              # category: annotation_data[:category]
              dimensions: annotation_data[:dimensions] || {},
              annotation: annotation_data[:annotation] || {}, # Q: is this needed to be imported ?
              # add other annotation fields as needed
            )
          end
        end

        # 4. return created dataset
        dataset_repo.find!(dataset_id)
      end
    end

    # export into a datset file
    def export(dataset_id)
      # prep data to DatsetSchema
      dataset = dataset_repo.find!("019960ab-1e80-78bf-b4d2-ebc62a6d3805") # testing id
      # TODO: handle not found error

      entries = entry_repo.index({dataset_id: dataset.id}) # sort by id ? created_at ? updated_at ?
      annotations = annotation_repo.index({entry_id__in: entries.map(&:id)}) # sort by id ? created_at ? updated_at ?
      
      # - 1. turn records into datset schema
      # TODO - 2. verify the schema (on structure building section)

      formatted_datset = {
        dataset: { # this layer is not needed if we are stricting only 1 dataset ?
          id: dataset.id,
          name: dataset.name,
          topology: dataset.modality, # topology = modality ?
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
              category: "category", # Q: annotation.category ?
              dimensions: annotation.dimensions,
              # annotation: "", # Q: is this needed ?
              # metadata:,
            }
          end
        }
      end

      # export as .datset
      # TODO: save file in a proper file store, currently just write here
      File.write("exported.datset", JSON.pretty_generate(formatted_datset))
    end
  end
end
