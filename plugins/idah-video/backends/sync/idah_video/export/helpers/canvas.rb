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

        # Whether the pixel is painted; pixels outside the canvas are not.
        def set?(x, y)
          x.between?(0, @width - 1) && y.between?(0, @height - 1) && @pixels.getbyte((y * @width) + x) != 0
        end

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

        # Draws a closed polygon's outline, 1 pixel thick: the pixels the fill
        # would set that have an unset neighbour above, below, left or right,
        # so the outline is the edge of the filled shape.
        def outline_polygon(points, value)
          return if points.size < 3

          xs = points.map(&:first)
          ys = points.map(&:last)
          left = [(xs.min - 0.5).ceil, 0].max
          top = [(ys.min - 0.5).ceil, 0].max
          right = [(xs.max - 0.5).floor, @width - 1].min
          bottom = [(ys.max - 0.5).floor, @height - 1].min
          return if right < left || bottom < top

          # The fill, alone, in a canvas over the polygon's pixels.
          shape = Canvas.new(right - left + 1, bottom - top + 1)
          shape.fill_polygon(points.map { |x, y| [x - left, y - top] }, 1)

          shape.height.times do |y|
            shape.width.times do |x|
              next unless shape.set?(x, y)
              next if shape.set?(x - 1, y) && shape.set?(x + 1, y) && shape.set?(x, y - 1) && shape.set?(x, y + 1)

              plot(left + x, top + y, value)
            end
          end
        end

        private

        def plot(x, y, value)
          @pixels.setbyte((y * @width) + x, value) if x.between?(0, @width - 1) && y.between?(0, @height - 1)
        end

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
