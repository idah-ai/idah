module Export
  class EntryContext
    attr_reader :entry, :annotations

    def initialize(entry, annotations)
      @entry = entry
      @annotations = annotations
    end

    def self.from_entry(entry)
        # media_response = Api[:idah].media.medias.resource_info(
        #   resource: entry.data[:attributes][:resource]
        # ) # ? seems loose

        # raise if media_response.errors

        # media = media_response.data
        # file_response = Api[:idah].media.medias.files(
        #   resource: entry.data[:attributes][:resource]
        # )
        # # raise if errors ?

        # file = Tempfile.new(entry.data[:attributes][:resource])
        # file.write(file_response)
        # file.close


      EntryContext.new(
        entry,
        Verse::Util::Iterator.chunk_iterator(1) do |annotation_page|
          annotations_response = Api[:idah].dataset.annotations.index(
            filters: {entry_id: entry[:id]},
            page: {number: annotation_page, size: 100}, query_count: false)

          raise annotations_response.errors if annotations_response.errors

          if annotations_response.data.empty?
            nil
          else
            annotations_response.data.lazy.map(&:data).map do |annotation|
              AnnotationContext.from_annotation annotation
            end
          end
        end
      )
    end
  end
end