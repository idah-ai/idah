module Export
  class CvatVideo
    def initialize(context)
      @context = context
      puts context.ios
      @io = context.ios.find {|io| io.name == "CvatVideo"}
      raise "#{self} error locating required CvatVideo io" unless @io
    end

    def run
      begin
        loop_processing
      rescue Exception => e
        Verse::logger::error{
          [
            "#{self} Error processing #{@io.name} #{e}",
            [e, "#{e.backtrace.join("\n")}"].join("\n")
          ].join("\n")
        }
        raise e
      end
    end

    private
    def start
      Verse::logger::debug{"#{self} Start processing #{@io.name}"}
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
      Verse::logger::debug{"#{self} #{@io.name} Process complete"}
    end

    def loop_processing
      start
      @context.api.datasets.index.each do |dataset|
        dataset.entries.index.each do |entry|
          @io.builder({
            dataset: dataset.record[:id],
            entry: entry.record[:id]
          }) do |xml|
            on_task dataset, entry, xml
          end
        end
      end
      done
    end

    def on_task(dataset, entry, xml)
      # media / store images by frames
      begin
        xml.annotations do |task|
          task.id dataset.record[:id]
          task.tag!(:attributes) do |task_attrs|
            task_attrs.name dataset.record[:attributes][:name]
            task_attrs.labels dataset.record[:attributes][:labels]
            task_attrs.modality dataset.record[:attributes][:modality]
            task_attrs.status dataset.record[:attributes][:status]
            task_attrs.progress dataset.record[:attributes][:progress]
            task_attrs.project_id dataset.record[:attributes][:project_id]
            task_attrs.metadata do |m|
              m.created_at dataset.record[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2')
              m.updated_at dataset.record[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2')
              m.created_by nil
            end
            task_attrs.entry do |e|
              e.id entry.record[:id]
              e.tag!(:attributes) do |entry_attrs|
                entry_attrs.dataset_id entry.record[:attributes][:dataset_id]
                entry_attrs.priority entry.record[:attributes][:priority]
                entry_attrs.wf_step entry.record[:attributes][:wf_step]
                entry_attrs.resource entry.record[:attributes][:resource]
                entry_attrs.assigned_to_id entry.record[:attributes][:assigned_to_id]
                entry_attrs.metadata do |m|
                  m.created_at entry.record[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2')
                  m.updated_at entry.record[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2')
                  m.created_by nil
                end
                entry_attrs.annotations do |e|
                  entry.annotations.index.each do |annotation|
                    on_track annotation, xml
                  end
                end
              end
            end
          end
        end
      rescue Exception => e
        error e, entry.record
      end
    end

    def on_track(annotation, xml)
      begin
        xml.track do |track|
          track.id annotation.record[:id]
          track.tag!(:attributes) do |track_attrs|
            track_attrs.entry_id annotation.record[:attributes][:entry_id]
            track_attrs.shape_type Hash(annotation.record[:attributes][:dimensions])[:type]
            track_attrs.shape_args Hash(annotation.record[:attributes][:dimensions]).select {|k, _| k != :type}.to_json
            track_attrs.annotation Hash(annotation.record[:attributes][:annotation]).to_json
            track_attrs.metadata do |m|
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
# ======
# common
# ======
# <?xml version="1.0" encoding="utf-8"?>
# <annotations>
#   <version>1.1</version>
#   <meta>
#     <task>
#       <id>Number: id of the task</id>
#       <name>String: some task name</name>
#       <size>Number: count of frames/images in the task</size>
#       <mode>String: interpolation or annotation</mode>
#       <overlap>Number: number of overlapped frames between segments</overlap>
#       <bugtracker>String: URL on an page which describe the task</bugtracker>
#       <flipped>Boolean: were images of the task flipped? (True/False)</flipped>
#       <created>String: date when the task was created</created>
#       <updated>String: date when the task was updated</updated>
#       <labels>
#         <label>
#           <name>String: name of the label (e.g. car, person)</name>
#           <type>String: any, bbox, cuboid, ellipse, mask, polygon, polyline, points, skeleton, tag</type>
#           <attributes>
#             <attribute>
#               <name>String: attribute name</name>
#               <mutable>Boolean: mutable (allow different values between frames)</mutable>
#               <input_type>String: select, checkbox, radio, number, text</input_type>
#               <default_value>String: default value</default_value>
#               <values>String: possible values, separated by newlines
# ex. value 2
# ex. value 3</values>
#             </attribute>
#           </attributes>
#           <svg>String: label representation in svg, only for skeletons</svg>
#           <parent>String: label parent name, only for skeletons</parent>
#         </label>
#       </labels>
#       <segments>
#         <segment>
#           <id>Number: id of the segment</id>
#           <start>Number: first frame</start>
#           <stop>Number: last frame</stop>
#           <url>String: URL (e.g. http://cvat.example.com/?id=213)</url>
#         </segment>
#       </segments>
#       <owner>
#         <username>String: the author of the task</username>
#         <email>String: email of the author</email>
#       </owner>
#       <original_size>
#         <width>Number: frame width</width>
#         <height>Number: frame height</height>
#       </original_size>
#     </task>
#     <dumped>String: date when the annotation was dumped</dumped>
#   </meta>
#   ...
# </annotations>

# =============
# interpolation
# =============

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
