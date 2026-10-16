# frozen_string_literal: true

module IdahImage
  module Export
    module Helpers
      # A mask annotation's pixels, decoded from how the frontend stores them
      # (frontend/src/lib/mask): 128 x 128 tiles in image pixels, keyed
      # `tile-<col>x<row>`, each a base64 run-length encoding of its pixels in
      # row order. Runs alternate 0s and 1s, starting with 0s; the last run is
      # left out; each run takes 1 byte below 128, else 2 bytes (big-endian,
      # bit 7 of the first set).
      #
      # Pixels are kept in a window covering the mask's tiles only, one byte
      # per pixel, so a small mask on a large image stays small.
      class Mask
        TILE = 128
        ON = "\x01".b
        OFF = "\x00".b
        # Cell size, in pixels, of the grid that finds the nearest vertex when
        # joining holes.
        CELL = 16
        # Cell size, in pixels, of the grid that finds the pieces around a hole.
        BOX_CELL = 64

        attr_reader :width, :height

        # @param shape_args [Hash] the annotation's shape args, symbol keys
        # @param width [Integer] the image's width in pixels
        # @param height [Integer] the image's height in pixels
        def self.decode(shape_args, width, height)
          tiles = shape_args.filter_map do |key, value|
            match = key.to_s.match(/\Atile-(\d+)x(\d+)\z/)
            next unless match && value.is_a?(Hash) && value[:rle]

            [match[1].to_i, match[2].to_i, value[:rle].to_s]
          end

          new(tiles, width, height)
        end

        # Packs run lengths into a COCO RLE string, a port of pycocotools'
        # `rleToString`: from the third run on, each is stored as its
        # difference with the run two before; each value is then written 5 bits
        # at a time, low bits first, as characters from "0" (48), with 0x20 set
        # while more follow.
        def self.compress(counts)
          out = +""

          counts.each_with_index do |count, i|
            value = i > 2 ? count - counts[i - 2] : count

            loop do
              chunk = value & 0x1f
              value >>= 5
              # Bit 4 is the sign of what is left: stop once the rest is all 0s
              # or, for a negative value, all 1s.
              more = value != (chunk.anybits?(0x10) ? -1 : 0)
              out << ((more ? chunk | 0x20 : chunk) + 48).chr
              break unless more
            end
          end

          out
        end

        # The run lengths of one tile's encoding.
        def self.runs(rle)
          bytes = rle.unpack1("m").bytes
          runs = []
          index = 0
          while index < bytes.size
            byte = bytes[index]
            if byte < 0x80
              runs << byte
              index += 1
            else
              runs << (((byte & 0x7f) << 8) | bytes[index + 1])
              index += 2
            end
          end
          runs
        end

        def initialize(tiles, width, height)
          @width = width
          @height = height

          if tiles.empty?
            @x0 = @y0 = @window_width = @window_height = 0
            @pixels = "".b
            return
          end

          @x0 = tiles.map { |col, _, _| col }.min * TILE
          @y0 = tiles.map { |_, row, _| row }.min * TILE
          @window_width = [((tiles.map { |col, _, _| col }.max + 1) * TILE), width].min - @x0
          @window_height = [((tiles.map { |_, row, _| row }.max + 1) * TILE), height].min - @y0
          @window_width = 0 if @window_width.negative?
          @window_height = 0 if @window_height.negative?
          @pixels = (OFF * (@window_width * @window_height))

          tiles.each { |col, row, rle| paint(col, row, rle) }
        end

        def area = @pixels.count(ON)

        def empty? = area.zero?

        # [x, y, width, height] of the set pixels, or nil when empty.
        def bbox
          xs = []
          ys = []
          @window_height.times do |y|
            row = @pixels.byteslice(y * @window_width, @window_width)
            first = row.index(ON)
            next unless first

            xs << first << row.rindex(ON)
            ys << y
          end
          return if ys.empty?

          [@x0 + xs.min, @y0 + ys.min, xs.max - xs.min + 1, ys.max - ys.min + 1]
        end

        # COCO's compressed RLE, as pycocotools writes it: run lengths over the
        # whole image, column by column, starting with a run of 0s (Fortran
        # order), packed into a string by `Mask.compress`.
        def coco_rle
          counts = []
          bit = 0
          run = 0

          @width.times do |x|
            column = column(x)
            if column.nil?
              # A column outside the window holds only 0s.
              if bit.zero?
                run += @height
              else
                counts << run
                bit = 0
                run = @height
              end
              next
            end

            column.each_byte do |value|
              if value == bit
                run += 1
              else
                counts << run
                bit = value
                run = 1
              end
            end
          end
          counts << run

          { size: [@height, @width], counts: Mask.compress(counts) }
        end

        # Each separate piece as one polygon of pixel corners in image pixels,
        # simplified. A piece's holes are joined to it by zero-width cuts: the
        # outline runs from a vertex to the nearest hole, around the hole, and
        # back along the same line. The cut adds no area, so filling the
        # polygon, by the even-odd or the nonzero rule, leaves the holes empty.
        # With `holes: false`, holes are left out, for uses that only need the
        # pieces' extent.
        def outlines(holes: true)
          outers, inner = trace_loops.partition { |points| signed_area(points).positive? }
          holes_of = holes ? holes_by_owner(outers, inner) : {}

          outers.each_with_index.filter_map do |outer, i|
            polygon = simplify(outer)
            next if polygon.size < 3

            pieces = holes_of.fetch(i, []).map { |hole| simplify(hole) }.select { |hole| hole.size >= 3 }
            join_holes(polygon, pieces).map { |x, y| [x + @x0, y + @y0] }
          end
        end

        private

        def paint(col, row, rle)
          offset = 0
          bit = 0
          Mask.runs(rle).each do |run|
            fill(col, row, offset, run) if bit == 1
            offset += run
            bit = 1 - bit
          end
          # The left-out last run fills the tile.
          fill(col, row, offset, (TILE * TILE) - offset) if bit == 1 && offset < TILE * TILE
        end

        # Sets `length` pixels from position `offset` of a tile, in row order,
        # clipped to the image.
        def fill(col, row, offset, length)
          while length.positive?
            tile_y = offset / TILE
            tile_x = offset % TILE
            count = [length, TILE - tile_x].min

            y = (row * TILE) + tile_y - @y0
            x = (col * TILE) + tile_x - @x0
            if y < @window_height && x < @window_width
              span = [count, @window_width - x].min
              @pixels[(y * @window_width) + x, span] = ON * span
            end

            offset += count
            length -= count
          end
        end

        def on?(x, y)
          x >= 0 && y >= 0 && x < @window_width && y < @window_height &&
            @pixels.getbyte((y * @window_width) + x) == 1
        end

        def column(x)
          wx = x - @x0
          return if wx.negative? || wx >= @window_width

          values = OFF * @height
          @window_height.times do |y|
            values.setbyte(@y0 + y, 1) if @pixels.getbyte((y * @window_width) + wx) == 1
          end
          values
        end

        # Loops along the pixel edges between set and unset pixels, the set
        # pixels on the right: an outer edge runs clockwise on screen (positive
        # area), a hole counter-clockwise.
        def trace_loops
          edges = Hash.new { |hash, vertex| hash[vertex] = [] }
          @window_height.times do |y|
            @window_width.times do |x|
              next unless on?(x, y)

              edges[[x, y]] << [x + 1, y] unless on?(x, y - 1)
              edges[[x + 1, y]] << [x + 1, y + 1] unless on?(x + 1, y)
              edges[[x + 1, y + 1]] << [x, y + 1] unless on?(x, y + 1)
              edges[[x, y + 1]] << [x, y] unless on?(x - 1, y)
            end
          end

          loops = []
          until edges.empty?
            start, targets = edges.first
            loop_points = [start]
            previous = start
            current = targets.first
            take(edges, start, current)

            until current == start
              loop_points << current
              following = next_vertex(edges, previous, current)
              take(edges, current, following)
              previous = current
              current = following
            end
            loops << loop_points
          end
          loops
        end

        # Where two loops touch at a corner, turn right, keeping pieces that
        # only touch diagonally apart.
        def next_vertex(edges, previous, current)
          options = edges[current]
          return options.first if options.size == 1

          dx = current[0] - previous[0]
          dy = current[1] - previous[1]
          right = [current[0] - dy, current[1] + dx]
          options.include?(right) ? right : options.first
        end

        def take(edges, from, to)
          edges[from].delete_at(edges[from].index(to))
          edges.delete(from) if edges[from].empty?
        end

        def signed_area(points)
          points.each_with_index.sum do |(x, y), i|
            nx, ny = points[(i + 1) % points.size]
            (x * ny) - (nx * y)
          end / 2.0
        end

        # Drops points on straight runs, then Douglas-Peucker within 1 pixel,
        # which turns staircases along slanted edges into straight lines.
        def simplify(points)
          corners = points.each_with_index.reject do |point, i|
            before = points[i - 1]
            after = points[(i + 1) % points.size]
            ((point[0] - before[0]) * (after[1] - point[1])) == ((point[1] - before[1]) * (after[0] - point[0]))
          end.map(&:first)
          return corners if corners.size <= 4

          # Split the closed loop at its first point and the point farthest
          # from it, then simplify each half.
          far = corners.each_index.max_by { |i| distance(corners[0], corners[i]) }
          first_half = douglas_peucker(corners[0..far])
          second_half = douglas_peucker(corners[far..] + [corners[0]])
          first_half[0...-1] + second_half[0...-1]
        end

        def douglas_peucker(points, epsilon = 1.0)
          return points if points.size < 3

          a = points.first
          b = points.last
          index, farthest = points[1...-1].each_with_index
                                          .map { |point, i| [i + 1, segment_distance(point, a, b)] }
                                          .max_by(&:last)
          return [a, b] if farthest <= epsilon

          douglas_peucker(points[0..index], epsilon)[0...-1] + douglas_peucker(points[index..], epsilon)
        end

        def segment_distance(point, a, b)
          length = distance(a, b)
          return distance(point, a) if length.zero?

          (((b[0] - a[0]) * (a[1] - point[1])) - ((a[0] - point[0]) * (b[1] - a[1]))).abs / length
        end

        def distance(a, b) = Math.hypot(a[0] - b[0], a[1] - b[1])

        # Holes grouped by the index of their piece in `outers`.
        def holes_by_owner(outers, holes)
          boxes = outers.map { |points| Geometry.envelope(points) }
          index = box_index(boxes)
          holes.group_by { |hole| owner(outers, boxes, index, hole) }
        end

        # The outer loops' boxes by grid cell, to find the boxes around a point
        # without going through them all.
        def box_index(boxes)
          index = Hash.new { |hash, cell| hash[cell] = [] }
          boxes.each_with_index do |(x, y, w, h), i|
            ((x / BOX_CELL)..((x + w) / BOX_CELL)).each do |cx|
              ((y / BOX_CELL)..((y + h) / BOX_CELL)).each { |cy| index[[cx, cy]] << i }
            end
          end
          index
        end

        # The index in `outers` of the piece around a hole: the smallest outer
        # loop holding a pixel of the hole. Most holes have a single candidate
        # by box, which then needs no test.
        def owner(outers, boxes, index, hole)
          point = hole_pixel(hole)
          cell = [point[0].to_i / BOX_CELL, point[1].to_i / BOX_CELL]
          candidates = index.fetch(cell, []).select do |i|
            x, y, w, h = boxes[i]
            point[0].between?(x, x + w) && point[1].between?(y, y + h)
          end
          return candidates.first if candidates.size <= 1

          candidates.select { |i| inside?(outers[i], point) }.min_by { |i| signed_area(outers[i]) }
        end

        # The centre of an unset pixel inside a hole: the one on the left of
        # its first edge, as loops keep set pixels on their right. Being a
        # half-pixel off every edge, it is never on a loop.
        def hole_pixel(hole)
          (ax, ay), (bx, by) = hole
          dx = bx - ax
          dy = by - ay
          [((ax + bx) / 2.0) + (dy / 2.0), ((ay + by) / 2.0) - (dx / 2.0)]
        end

        # Even-odd test with a ray to the right.
        def inside?(points, (px, py))
          inside = false
          points.each_with_index do |(x1, y1), i|
            x2, y2 = points[i - 1]
            next if (y1 > py) == (y2 > py)

            inside = !inside if px < x1 + ((py - y1) * (x2 - x1) / (y2 - y1).to_f)
          end
          inside
        end

        # Joins the holes to the outline, each by a cut to the nearest vertex of
        # the outline or of a hole already joined, which keeps cuts short among
        # many holes. Holes are taken from left to right.
        def join_holes(outline, holes)
          return outline if holes.empty?

          loops = [outline]
          cuts = Hash.new { |hash, vertex| hash[vertex] = [] }
          grid = Hash.new { |hash, cell| hash[cell] = [] }
          add_to_grid(grid, loops, 0)

          holes.sort_by { |hole| hole.map(&:first).min }.each do |hole|
            best = nil
            hole.each_with_index do |point, vertex|
              found = nearest(grid, loops, point, best&.first)
              best = [*found, vertex] if found && (best.nil? || found[0] < best[0])
            end

            loops << hole
            cuts[[best[1], best[2]]] << [loops.size - 1, best[3]]
            add_to_grid(grid, loops, loops.size - 1)
          end

          walk(loops, cuts, 0, 0, [])
        end

        def add_to_grid(grid, loops, index)
          loops[index].each_with_index { |(x, y), vertex| grid[[x / CELL, y / CELL]] << [index, vertex] }
        end

        # The vertex nearest to `point`, as [distance, loop, vertex], searching
        # the grid ring by ring, or nil when none is closer than `bound`.
        def nearest(grid, loops, point, bound)
          cx = point[0] / CELL
          cy = point[1] / CELL
          best = nil

          (0..(([@window_width, @window_height].max / CELL) + 1)).each do |ring|
            ring_cells(cx, cy, ring).each do |cell|
              grid.fetch(cell, nil)&.each do |index, vertex|
                found = distance(point, loops[index][vertex])
                best = [found, index, vertex] if best.nil? || found < best[0]
              end
            end
            # Cells further out are at least `ring` cells away.
            break if best && best[0] <= ring * CELL
            break if bound && ring * CELL >= bound
          end

          best
        end

        def ring_cells(cx, cy, ring)
          return [[cx, cy]] if ring.zero?

          (-ring..ring).flat_map do |d|
            [[cx + d, cy - ring], [cx + d, cy + ring]] +
              (d.abs == ring ? [] : [[cx - ring, cy + d], [cx + ring, cy + d]])
          end
        end

        # Lists a loop's points from `start`, going around each hole cut at a
        # vertex and back to that vertex. A hole closes on its first point,
        # where the cut leads back out; the outline does not need to.
        def walk(loops, cuts, index, start, out)
          points = loops[index]
          points.size.times do |step|
            vertex = (start + step) % points.size
            out << points[vertex]
            cuts.fetch([index, vertex], []).each do |hole, hole_start|
              walk(loops, cuts, hole, hole_start, out)
              out << points[vertex]
            end
          end
          out << points[start] unless index.zero?
          out
        end
      end
    end
  end
end
