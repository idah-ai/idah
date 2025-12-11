module UniversalPortableDatasetContext
  class Entry
    attr_reader :entry, :media_info, :media_file, :annotations

    def initialize(entry, media_info, io, annotations)
      @entry = entry
      @media_info = media_info
      @media_file = io # todo IO
      @annotations = annotations
    end

    def self.from_entry(entry)
      media_response = Api[:idah].media.medias.resource_info(
        resource: entry[:attributes][:resource]
      ) # ? seems loose

      raise if media_response.errors

      media_info = media_response.data
      file_response = Api[:idah].media.medias.files(
        resource: entry[:attributes][:resource]
      )

      entry_id = entry[:id]

      Entry.new(
        entry,
        media_info,
        file_response,
        Verse::Util::Iterator.chunk_iterator(1) do |annotation_page|
          annotations_response = Api[:idah].dataset.annotations.index(
            filters: {entry_id:},
            page: {number: annotation_page, size: 100}, query_count: false)

          raise annotations_response.errors if annotations_response.errors

          annotations_response.data.lazy.map(&:data).map do |annotation|
            Annotation.from_annotation annotation
          end unless annotations_response.data.empty?
        end
      )
    end
  end
end