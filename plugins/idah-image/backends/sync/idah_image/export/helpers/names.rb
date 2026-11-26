# frozen_string_literal: true

module IdahImage
  module Export
    module Helpers
      # File and folder names in an export.
      module Names
        extend self

        # A name made safe for a file system, unique among `taken`: characters
        # other than letters, digits, ".", "-" and "_" become "_", and a name
        # already taken (duplicated entries, datasets with the same name) gets
        # a numbered suffix.
        #
        # @param taken [Set] names already used; the result is added to it
        # @param fallback [String] used when nothing is left of the name
        def unique(name, taken, fallback)
          base = name.to_s.gsub(/[^\w.-]+/, "_")
          base = fallback if base.empty?

          stem = base
          suffix = 1
          stem = "#{base}_#{suffix += 1}" until taken.add?(stem)
          stem
        end
      end
    end
  end
end
