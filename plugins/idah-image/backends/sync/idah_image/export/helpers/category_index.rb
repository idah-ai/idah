# frozen_string_literal: true

module IdahImage
  module Export
    module Helpers
      # The categories of a dataset's labeling configuration, numbered for
      # export.
      #
      # A category is named by its IDAH value id, such as
      # "human/civilian/armed": labels repeat across a category tree ("armed"
      # under several parents) or are blank, while ids are unique and are what
      # annotations store. The parent path is the supercategory. Ids start at 1
      # (COCO's numbering; YOLO classes are the id minus 1) and follow
      # configuration order; a category missing from the configuration is added
      # at the end when an annotation uses it.
      class CategoryIndex
        # Shape types whose categories are exported as categories. Lines have
        # no place in the formats, and image-level categories are not objects.
        SHAPE_TYPES = %i[
          idah-image:bounding-box idah-image:polygon idah-image:circle idah-image:ellipse idah-image:mask
        ].freeze

        # @param shape_types [Array<Symbol>] the configurations to read, for
        #   formats that hold other shapes, such as lines
        def initialize(shape_types: SHAPE_TYPES)
          @shape_types = shape_types
          @parents = {} # value id => parent id
          @colors = {} # value id => "#RRGGBB"
          @categories = {} # value id => COCO category
        end

        def add_configuration(configuration)
          configuration = Keys.symbolize(configuration || {})

          @shape_types.each do |shape_type|
            Array(configuration.dig(shape_type, :values)).each do |value|
              id = value[:id].to_s
              @parents[id] ||= value[:parent].to_s if value[:parent]
              # A value configured for several shapes keeps its first colour.
              @colors[id] ||= value[:color].to_s if value[:color]
              add_category(id)
            end
          end
        end

        # The colour the labeling configuration gives a category, as
        # "#RRGGBB", or nil.
        def color_for(value_id) = @colors[value_id.to_s]

        # The COCO id of a category, adding it when the configuration lacks it.
        def id_for(value_id)
          add_category(value_id.to_s)[:id]
        end

        def categories = @categories.values

        private

        def add_category(value_id)
          @categories[value_id] ||= {
            id: @categories.size + 1,
            name: value_id,
            supercategory: @parents.fetch(value_id) { value_id.include?("/") ? File.dirname(value_id) : "" }
          }
        end
      end
    end
  end
end
