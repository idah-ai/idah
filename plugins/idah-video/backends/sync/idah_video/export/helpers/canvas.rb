# frozen_string_literal: true

module IdahVideo
  module Export
    module Helpers
      # A class mask being painted: one byte per image pixel, row by row, 0 for
      # background. Each shape sets the pixels it covers to its class, so a
      # shape painted later wins where shapes overlap.
      #
      # A pixel belongs to a shape when its centre lies inside it, the rule
      # polygon fills use, so shapes that share an edge do not overlap.
      class Canvas
        attr_reader :width, :height, :pixels

        def initialize(width, height)
          @width = width
          @height = height
          @pixels = "\x00".b * (width * height)
        end

        def empty? = !@pixels.match?(/[^\x00]/n)

        # Fills a closed polygon of [x, y] points in pixels, by the even-odd
        # rule.
        def fill_polygon(points, value)
          return if points.size < 3

          ys = points.map(&:last)
          first_row = [(ys.min - 0.5).ceil, 0].max
          last_row = [(ys.max - 0.5).floor, @height - 1].min

          (first_row..last_row).each do |row|
            centre = row + 0.5
            crossings(points, centre).each_slice(2) do |from, to|
              fill_span(row, from, to, value) if to
            end
          end
        end

        private

        # Where the polygon's edges cross the horizontal line `y`, sorted.
        def crossings(points, y)
          xs = []
          points.each_with_index do |(x1, y1), i|
            x2, y2 = points[i - 1]
            next if (y1 > y) == (y2 > y)

            xs << (x1 + ((y - y1) * (x2 - x1) / (y2 - y1)))
          end
          xs.sort!
        end

        # Sets the pixels of `row` whose centres lie between `from` and `to`.
        def fill_span(row, from, to, value)
          first = [(from - 0.5).ceil, 0].max
          last = [(to - 0.5).ceil - 1, @width - 1].min
          return if last < first

          @pixels[(row * @width) + first, last - first + 1] = value.chr.b * (last - first + 1)
        end
      end
    end
  end
end
