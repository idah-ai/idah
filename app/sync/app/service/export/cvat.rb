module Export
  class Cvat
    def initialize(context)
      @context = context
    end

    def run
      begin
        # linear_processing
        loop_processing
      rescue Exception => e
        Verse::logger::error{
          [
            "#{self} Error processing #{@context.io.name} #{e}",
            [e, "#{e.backtrace.join("\n")}"].join("\n")
          ].join("\n")
        }
        raise e
      end
    end

    private
    def start
      Verse::logger::debug{"#{self} Start processing #{@context.io.name}"}
    end

    def error(e, record)
      Verse::logger::error {
        "#{self} failed to process #{[record[:type], record[:id]].join(":")}"
      }
      raise e
    end

    def done
      #zip it all
      # context.io.zip or on release ?
      Verse::logger::debug{"#{self} #{@context.io.name} Process complete"}
    end

    def linear_processing
      start
      @context.api.datasets.index.each do |dataset| on_dataset dataset end
      @context.api.entries.index.each do |entry| on_entry entry end
      @context.api.annotations.index.each do |annotation| on_annotation annotation end
      done
    end

    def loop_processing
      start
      @context.api.datasets.index.each do |dataset|
        on_dataset dataset
        dataset.entries.index.each do |entry|
          on_entry entry
          entry.annotations.index.each do |annotation|
            on_annotation annotation
          end
        end
      end
      done
    end

    def on_dataset(dataset)
      begin
        @context.io.xml.dataset do |d|
          d.id dataset.record[:id],
          @context.io.xml.attributes do |a|
            a.name dataset.record[:attributes][:name]
            a.labels dataset.record[:attributes][:labels]
            a.modality dataset.record[:attributes][:modality]
            a.status dataset.record[:attributes][:status]
            a.progress dataset.record[:attributes][:progress]
            a.project_id dataset.record[:attributes][:project_id]
            @context.io.xml.metadata do |m|
              m.created_at dataset.record[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2')
              m.updated_at dataset.record[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2')
              m.created_by nil
            end
          end
        end
      rescue Exception => e
        error e, dataset.record
      end
    end

    def on_entry(entry)
      begin
        # media ? store media
        # context io.add_media ?
        @context.io.xml.entry do |d|
          d.id entry.record[:id],
          @context.io.xml.attributes do |a|
            a.dataset_id entry.record[:attributes][:dataset_id]
            a.priority entry.record[:attributes][:priority]
            a.wf_step entry.record[:attributes][:wf_step]
            a.resource entry.record[:attributes][:resource]
            a.assigned_to_id entry.record[:attributes][:assigned_to_id]
            @context.io.xml.metadata do |m|
              m.created_at entry.record[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2')
              m.updated_at entry.record[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2')
              m.created_by nil
            end
          end
        end

      rescue Exception => e
        error e, entry.record
      end
    end

    def on_annotation(annotation)
      begin
        @context.io.xml.entry do |d|
          d.id annotation.record[:id],
          @context.io.xml.attributes do |a|
            a.entry_id annotation.record[:attributes][:id]
            a.shape_type Hash(annotation.record[:attributes][:dimensions])[:type]
            a.shape_args Hash(annotation.record[:attributes][:dimensions]).select {|k, _| k != :type}.to_json]
            a.annotation Hash(annotation.record[:attributes][:annotation]).to_json,
            @context.io.xml.metadata do |m|
              m.created_at annotation.record[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2')
              m.updated_at annotation.record[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2')
              m.created_by nil
            end
          end
        end
      rescue Exception => e
        error e, annotation.record
      end
    end
  end
end


# reference
# interpolation
# <?xml version="1.0" encoding="utf-8"?>
# <annotations>
#   ...
#   <track id="Number: id of the track (doesn't have any special meeting)" label="String: the associated label" source="manual or auto">
#     <box frame="Number: frame" xtl="Number: float" ytl="Number: float" xbr="Number: float" ybr="Number: float" outside="Number: 0 - False, 1 - True" occluded="Number: 0 - False, 1 - True" keyframe="Number: 0 - False, 1 - True">
#       <attribute name="String: an attribute name">String: the attribute value</attribute>
#       ...
#     </box>
#     <polygon frame="Number: frame" points="x0,y0;x1,y1;..." outside="Number: 0 - False, 1 - True" occluded="Number: 0 - False, 1 - True" keyframe="Number: 0 - False, 1 - True">
#       <attribute name="String: an attribute name">String: the attribute value</attribute>
#     </polygon>
#     <polyline frame="Number: frame" points="x0,y0;x1,y1;..." outside="Number: 0 - False, 1 - True" occluded="Number: 0 - False, 1 - True" keyframe="Number: 0 - False, 1 - True">
#       <attribute name="String: an attribute name">String: the attribute value</attribute>
#     </polyline>
#     <points frame="Number: frame" points="x0,y0;x1,y1;..." outside="Number: 0 - False, 1 - True" occluded="Number: 0 - False, 1 - True" keyframe="Number: 0 - False, 1 - True">
#       <attribute name="String: an attribute name">String: the attribute value</attribute>
#     </points>
#     <mask frame="Number: frame" outside="Number: 0 - False, 1 - True" occluded="Number: 0 - False, 1 - True" rle="RLE mask" left="Number: left coordinate of the image where the mask begins" top="Number: top coordinate of the image where the mask begins" width="Number: width of the mask" height="Number: height of the mask" z_order="Number: z-order of the object">
#     </mask>
#     ...
#   </track>
#   <track id="Number: id of the track (doesn't have any special meeting)" label="String: the associated label" source="manual or auto">
#     <skeleton frame="Number: frame" keyframe="Number: 0 - False, 1 - True">
#       <points label="String: the associated label" outside="Number: 0 - False, 1 - True" occluded="Number: 0 - False, 1 - True" keyframe="Number: 0 - False, 1 - True" points="x0,y0;x1,y1">
#       </points>
#       ...
#     </skeleton>
#     ...
#   </track>
#   ...
# </annotations>
