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
          @io.builder({ # CVAT export seems to have tasks/entries has root
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
        xml.annotations do |annotations|
          annotations.version 1.1
          annotations.meta do |meta|
            meta.task do |task|
              task.id entry.record[:id] #!!! -> Number: id of the task
              task.name entry.record[:attributes][:resource] # String: some task name
              task.size 0 # Number: count of frames/images in the task
              task.mode "interpolation" # String: interpolation or annotation
              task.overlap 0 # Number: number of overlapped frames between segments
              task.bugtracker "" # String: URL on an page which describe the task
              task.flipped false # Boolean: were images of the task flipped? (True/False)
              task.created entry.record[:attributes][:created_at] # String: date when the task was created
              task.updated entry.record[:attributes][:updated_at] # String: date when the task was updated
              task.labels do |labels|
                Hash(dataset.record[:attributes][:labeling_configuration]).flat_map do |type, config|
                  config[:values].map do |value|
                    {
                      name: value[:id], # value[:label] # String: name of the label (e.g. car, person)
                      type: case type
                      when :'entry:root'
                        'tag'
                      when :'idah-video:bounding-box'
                        'bbox'
                      else
                        raise "unexpected label type #{type}"
                      end, # String: any, bbox, cuboid, ellipse, mask, polygon, polyline, points, skeleton, tag
                      attributes: config[:properties].map do |property| # TODO visibility
                        # {
                        #   input_type:, # String: select, checkbox, radio, number, text
                        #   default_value: , # String: default value
                        #   values: [], #String: possible values, separated by newlines
                        # }
                        {
                          name: property[:id], # property[:label] # String: attribute name
                          mutable: false, # Boolean: mutable (allow different values between frames)
                        }.merge(
                          case property[:type]
                          when 'integer'
                            {input_type: 'number', default_value: 0, values: []}
                          when 'boolean'
                            {input_type: 'radio', default_value: false , values: [true, false]}
                          when 'text'
                            {input_type: 'text', default_value: "", values: []}
                          when 'single-select'
                            {input_type: 'select', default_value: "", values: []}
                          when 'multi-select'
                            {input_type: 'checkbox', default_value: "", values: []}
                          else
                            raise "unexpected property type #{property[:type]}"
                          end
                        )
                      end
                    }
                  end
                end.each do |h|
                  labels.label do |label|
                    label.name h[:name]
                    label.type h[:type]
                    label.tag!(:attributes) do |attributes|
                      h[:attributes].map do |h_attribute|
                        attributes.attribute do |attribute|
                          attribute.name = h_attribute[:name]
                          attribute.mutable = h_attribute[:mutable]
                          attribute.input_type = h_attribute[:input_type]
                          attribute.default_value = h_attribute[:default_value]
                          attribute.values = h_attribute[:values].join("\n")
                        end
                      end
                    end
                  end
                end
              end
              task.segments do |segment|
              end
              task.owner do |owner|
                owner.username "" # String: the author of the task
                owner.email "" # String: email of the author
              end
              task.original_size do |original_size|
                original_size.width 0 # Number: frame width
                original_size.height 0 # Number: frame height
              end
            end
            meta.dumped "" # String: date when the annotation was dumped
          end
          entry.annotations.index.each do |annotation|
            begin
              on_track entry, annotation, xml
            rescue Exception => e
              error e, entry.record
            end
          end
        end
      rescue Exception => e
        error e, dataset.record
      end
    end

    def on_track(entry, annotation, xml)
      begin
        xml.track(
          id: annotation.record[:id],
          label: annotation.record.dig(:attributes, :annotation, :category), # String: the associated label
          source:"manual" # manual or auto
        ) do |track|
          case Hash(annotation.record[:attributes][:dimensions])[:type]
          when "idah-video:bounding-box"
            Array(annotation.record.dig(:attributes, :dimensions, :frames)).each do |keyframe|
              track.box(
                frame: keyframe[:frame],
                xtl: keyframe[:points][0][0], # x top left
                ytl: keyframe[:points][0][1], # y top left
                xbr: keyframe[:points][2][0], # x bottom right
                ybr: keyframe[:points][2][1], # y bottom left
                outside: 0,
                occluded: 0,
                keyframe: 1
              ) do |box|
                Hash(annotation.record.dig(:attributes, :annotation, :attributes)).each do |name, value|
                  box.attribute(name: name.to_s) { box.text!(value.to_s) }
                end
              end
            end
          when 'entry:root'
            # video don't have tags only images does :/
            # https://docs.cvat.ai/docs/dataset_management/formats
            track.tag(label: "", source: "manual") do |tag|
              Hash(annotation.record.dig(:attributes, :annotation, :attributes)).each do |name, value|
                tag.attribute(name: name.to_s) { tag.text!(value.to_s) }
              end
            end
          else
            raise `unexpected annotation type: #{type}`
          end
        end
      rescue Exception => e
        error e, annotation.record
      end
    end
  end
end
