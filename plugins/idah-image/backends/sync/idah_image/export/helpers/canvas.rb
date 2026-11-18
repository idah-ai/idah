# frozen_string_literal: true

module IdahImage
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

        # Strokes an open line of [x, y] points, `width` pixels wide, with round
        # ends and joints: each segment as a rectangle, each point as a disc.
        def stroke_line(points, width, value)
          radius = width / 2.0
          points.each_cons(2) do |(ax, ay), (bx, by)|
            length = Math.hypot(bx - ax, by - ay)
            next if length.zero?

            # Half the width, across the segment.
            nx = -(by - ay) / length * radius
            ny = (bx - ax) / length * radius
            fill_polygon([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]], value)
          end
          points.each { |x, y| fill_polygon(Geometry.ellipse(x, y, radius, radius, count: 16), value) }
        end

        # Draws the outline of an ellipse (a circle when the radii are equal),
        # 1 pixel thick: centre (cx, cy), radii rx and ry, turned by `angle`
        # radians around its centre, clockwise on screen.
        #
        # An upright ellipse (turned by a multiple of 90 degrees) is drawn with
        # the midpoint algorithm, as paint programs draw circles: symmetric,
        # its centre and radii rounded to the pixel grid, so it moves by half a
        # pixel at most. Other ellipses are traced along the exact curve.
        def trace_ellipse(cx, cy, rx, ry, angle, value)
          quarter_turns = angle / (Math::PI / 2)
          return trace_curve(cx, cy, rx, ry, angle, value) unless (quarter_turns - quarter_turns.round).abs < 1e-4

          rx, ry = ry, rx if quarter_turns.round.odd?
          # The pixel holding the centre; the midpoint algorithm works in whole
          # pixels around it.
          midpoint_ellipse((cx - 0.5).round, (cy - 0.5).round, rx.round, ry.round, value)
        end

        # Paints the set pixels of a mask.
        def paint_mask(mask, value)
          byte = value.chr.b
          mask.each_span do |row, from, length|
            @pixels[(row * @width) + from, length] = byte * length
          end
        end

        private

        # Traces an ellipse along the exact curve: the pixel under each sample,
        # the samples at most half a pixel apart, then thinned to 1 pixel.
        def trace_curve(cx, cy, rx, ry, angle, value)
          # Samples at most half a pixel apart, so the outline has no gap.
          count = [(2 * Math::PI * [rx, ry].max / 0.5).ceil, 8].max
          samples = Geometry.ellipse(cx, cy, rx, ry, count:)
          samples = Geometry.rotate(samples, angle) unless angle.zero?

          # The pixel under each sample, once each in order along the curve.
          path = samples.map { |x, y| [x.floor, y.floor] }.chunk_while { |a, b| a == b }.map(&:first)
          thin(path).each { |x, y| plot(x, y, value) }
        end

        # The midpoint ellipse algorithm, a circle when the radii are equal:
        # walks one quarter, from the top, and sets the same pixel in all four.
        # Region 1 steps across while the curve is flatter than 45 degrees,
        # region 2 steps down after.
        def midpoint_ellipse(cx, cy, rx, ry, value)
          return plot(cx, cy, value) if rx.zero? && ry.zero?

          rx2 = rx * rx
          ry2 = ry * ry
          x = 0
          y = ry
          dx = 0
          dy = 2 * rx2 * y
          decision = ry2 - (rx2 * ry) + (rx2 / 4.0)
          while dx < dy
            plot_quarters(cx, cy, x, y, value)
            x += 1
            dx += 2 * ry2
            if decision.negative?
              decision += dx + ry2
            else
              y -= 1
              dy -= 2 * rx2
              decision += dx - dy + ry2
            end
          end

          decision = (ry2 * ((x + 0.5) ** 2)) + (rx2 * ((y - 1) ** 2)) - (rx2 * ry2)
          while y >= 0
            plot_quarters(cx, cy, x, y, value)
            y -= 1
            dy -= 2 * rx2
            if decision.positive?
              decision += rx2 - dy
            else
              x += 1
              dx += 2 * ry2
              decision += dx - dy + rx2
            end
          end
        end

        def plot_quarters(cx, cy, x, y, value)
          [[x, y], [-x, y], [x, -y], [-x, -y]].uniq.each { |dx, dy| plot(cx + dx, cy + dy, value) }
        end

        def plot(x, y, value)
          @pixels.setbyte((y * @width) + x, value) if x.between?(0, @width - 1) && y.between?(0, @height - 1)
        end

        # Drops the corner pixel of each staircase step in a closed path of
        # pixels: one whose neighbours on the path touch diagonally, so the
        # outline stays connected and 1 pixel thick.
        def thin(path)
          path = path[0...-1] if path.size > 1 && path.first == path.last
          return path if path.size < 4

          kept = []
          path.each_with_index do |pixel, i|
            before = kept.last || path[-1]
            after = path[(i + 1) % path.size]
            next if (before[0] - after[0]).abs <= 1 && (before[1] - after[1]).abs <= 1 && before != after

            kept << pixel
          end
          kept
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
