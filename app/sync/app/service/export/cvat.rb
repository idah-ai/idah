module Export
  class Cvat
    def self.name
      "Cvat"
    end

    def initialize(context)
      @context = context
    end

    def run
      @context.datasets.each do |dataset|
        dataset_directory = "dataset.#{dataset[:id]}"
        dataset.entries.each do |entry|
          task_directory = File.join(
            dataset_directory,
            "task.#{entry[:attributes][:resource]}"
          )
          @context.io.mkdir task_directory
          file = File.join(task_directory, "annotations.xml")
          @context.io.xml(file) do |xml|
            on_task dataset, entry, xml
          end
          @context.io.mkdir File.join(task_directory, "images")
          # TODO: media / store images by frames
          # create cvat zip task export (images folder + annotations.xml)
          @context.io.zip("**/**", task_directory)
        end
      end
      @context.io.zip("**/*.zip") # bundle all zipped tasks as export
    end

    private
    def error(e, record)
      Verse::logger::error {
        "#{self} failed to process #{[record[:type], record[:id]].join(":")}"
      }
      raise e
    end

    def on_task(dataset, entry, xml)
      begin
        xml.annotations do |annotations|
          annotations.version 1.1
          annotations.meta do |meta|
            meta.task do |task|
              task.id entry[:id] #!!! -> Number: id of the task
              task.name entry[:attributes][:resource] # String: some task name
              task.size 0 # TODO: Number: count of frames/images in the task
              task.mode "interpolation" # String: interpolation or annotation
              task.overlap 0 # Number: number of overlapped frames between segments
              task.bugtracker "" # String: URL on an page which describe the task
              task.flipped false # Boolean: were images of the task flipped? (True/False)
              task.created entry[:attributes][:created_at] # String: date when the task was created
              task.updated entry[:attributes][:updated_at] # String: date when the task was updated
              task.labels do |labels|
                Hash(dataset[:attributes][:labeling_configuration]).flat_map do |type, config|
                  config[:values].map do |value|
                    {
                      name: value[:id],
                      type: case type
                      when :'entry:root'
                        'tag'
                      when :'idah-video:bounding-box'
                        'bbox'
                      else
                        raise "unexpected label type #{type}"
                      end,
                      attributes: config[:properties].map do |property| # TODO visibility
                        {
                          name: property[:id],
                          mutable: false,
                        }.merge(
                          case property[:type]
                          when 'integer'
                            {input_type: 'number'}
                          when 'boolean'
                            {input_type: 'radio', default_value: false , values: [true, false]}
                          when 'text'
                            {input_type: 'text'}
                          when 'single-select'
                            {input_type: 'select', values: property[:format][:options].map{ |o| o[:id]}}
                          when 'multi-select'
                            {input_type: 'checkbox', values: property[:format][:options].map{ |o| o[:id]}}
                          else
                            raise "unexpected property type #{property[:type]}"
                          end
                        )
                      end
                    }
                  end
                end.each do |h|
                  labels.label do |label|
                    label.name h[:name] # value[:label] # String: name of the label (e.g. car, person)
                    label.type h[:type] # String: any, bbox, cuboid, ellipse, mask, polygon, polyline, points, skeleton, tag
                    label.tag!(:attributes) do |attributes|
                      h[:attributes].map do |h_attribute|
                        attributes.attribute do |attribute|
                          attribute.name h_attribute[:name] # property[:label] # String: attribute name
                          attribute.mutable h_attribute[:mutable] # Boolean: mutable (allow different values between frames)
                          attribute.input_type h_attribute[:input_type] # String: select, checkbox, radio, number, text
                          attribute.default_value h_attribute[:default_value] if h_attribute[:default_value] # String: default value
                          attribute.values h_attribute[:values].join("\n") if h_attribute[:values] #String: possible values, separated by newlines
                        end
                      end
                    end
                  end
                end
              end
              task.segments do |segment|
              end
              task.owner do |owner|
                owner.username "" # TODO: String: the author of the task
                owner.email "" # TODO: String: email of the author
              end
              task.original_size do |original_size|
                original_size.width 0 # TODO: Number: frame width
                original_size.height 0 # TODO: Number: frame height
              end
            end
            meta.dumped "" # String: date when the annotation was dumped
          end
          tags = [] # for now while shape_type still doesn't exist outside of dimensions
          entry.annotations.each do |annotation|
            begin
              case Hash(annotation[:attributes][:dimensions])[:type]
              when "entry:root"
                tags << annotation # for now while shape_type still doesn't exist outside of dimensions
              else
                on_track entry, annotation, xml
              end
            rescue Exception => e
              error e, entry
            end
          end
          # once shape_type extracted from dimensions # query tag only annotations
          # on_framed_annotations(entry, entry.annotations.index(shape_type__in: ["entry:root"]), xml)
          on_framed_annotations(entry, tags, xml)
        end
      rescue Exception => e
        error e, dataset
      end
    end

    def on_track(entry, annotation, xml)
      begin
        xml.track(
          id: annotation[:id],
          label: annotation.dig(:attributes, :annotation, :category), # String: the associated label
          source:"manual" # manual or auto
        ) do |track|
          case Hash(annotation[:attributes][:dimensions])[:type]
          when "idah-video:bounding-box"
            Array(annotation.dig(:attributes, :dimensions, :frames)).each do |keyframe|
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
                Hash(annotation.dig(:attributes, :annotation, :attributes)).each do |name, value|
                  box.attribute(name: name.to_s) do |attribute|
                    attribute.text!([value.to_s,"\n"].join)
                  end
                end
              end
            end
          else
            # do nothing
          end
        end
      rescue Exception => e
        error e, annotation
      end
    end

    def on_framed_annotations(entry, annotations, xml)
      number_of_frames = 42 # TODO extract value from media
      width = 1 # TODO extract value from media
      height = 1 # TODO extract value from media

      number_of_frames.times do |i|
        current_frame = i + 1
        xml.image(
          id: current_frame, # Number: id of the image (the index in lexical order of images)
          name: "", #String: path to the image
          width: , # Number: image width
          height: , # Number: image height
        ) do |image|
          annotations.map do |annotation|
            case Hash(annotation[:attributes][:dimensions])[:type]
            when 'entry:root'
              annotation
            # when 'entry:frame_tag'
            #   # check dimensions with current_frame
            # when 'entry:range_tag'
            #   # check dimensions with current_frame
            else
              # do nothing
            end
          end.compact.each do |annotation|
            image.tag(
              label: annotation.dig(:attributes, :annotation, :category), # String: the associated label
              source: "manual" # manual or auto
            ) do |tag|
              Hash(annotation.dig(:attributes, :annotation, :attributes)).each do |name, value|
                tag.attribute(name: name.to_s) do |attribute|
                    attribute.text!([value.to_s,"\n"].join)
                end
              end
            end
          end
        end
      end
    end
  end
end
