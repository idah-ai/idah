# frozen_string_literal: true

module IdahVideo
  module Export
    module Coco
      # COCO categories built from the datasets' labeling configurations.
      #
      # A category is named by its IDAH value id, such as
      # "human/civilian/armed": labels repeat across a category tree ("armed"
      # under several parents) or are blank, while ids are unique and are what
      # annotations store. The parent path is the supercategory. Ids start at 1
      # and follow configuration order, so a category keeps its id across the
      # datasets of one export.
      class CategoryIndex
        # Shape types whose categories become COCO categories. Frame tags and
        # entry-level categories are written as attributes instead.
        SHAPE_TYPES = %i[idah-video:bounding-box idah-video:polygon].freeze

        def initialize
          @parents = {} # value id => parent id
          @categories = {} # value id => COCO category
        end

        def add_configuration(configuration)
          configuration = Helpers::Keys.symbolize(configuration || {})

          SHAPE_TYPES.each do |shape_type|
            Array(configuration.dig(shape_type, :values)).each do |value|
              id = value[:id].to_s
              @parents[id] ||= value[:parent].to_s if value[:parent]
              add_category(id)
            end
          end
        end

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
