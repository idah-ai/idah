# frozen_string_literal: true

module IdahVideo
  module Export
    # Ruby port of flubber 0.4.2's single-polygon interpolation, as the
    # frontend calls it in `utils/math/polygon.ts`: `interpolate(from, to,
    # { maxSegmentLength: Infinity })`. The steps and the order of the
    # arithmetic follow flubber's `src/interpolate.js`, `normalize.js`,
    # `add.js`, `rotate.js` and d3-polygon, so an exported frame matches the
    # one drawn on screen. `interpolation_parity.json` checks it.
    #
    # Works on normalized coordinates, like the frontend: distances there are
    # not proportional to pixels on a non-square video.
    module PolygonMorph
      extend self

      # Two points closer than this are the same point (flubber's samePoint).
      SAME_POINT_EPSILON = 1e-9

      # @param from [Array<Array(Numeric, Numeric)>] polygon at t = 0
      # @param to [Array<Array(Numeric, Numeric)>] polygon at t = 1
      # @param t [Float] position between the two, from 0 to 1
      # @return [Array<Array(Float, Float)>] the interpolated polygon
      def interpolate(from, to, t)
        from_ring = normalize_ring(from)
        to_ring = normalize_ring(to)

        diff = from_ring.size - to_ring.size

        add_points(from_ring, diff.negative? ? -diff : 0)
        add_points(to_ring, diff.positive? ? diff : 0)

        rotate(from_ring, to_ring)

        from_ring.each_with_index.map do |a, i|
          b = to_ring[i]
          [a[0] + (t * (b[0] - a[0])), a[1] + (t * (b[1] - a[1]))]
        end
      end

      private

      # Drop a closing point that repeats the first one, and make the ring
      # clockwise.
      def normalize_ring(ring)
        raise ArgumentError, "a polygon needs at least one point" if ring.nil? || ring.empty?

        points = ring.map { |point| to_point(point) }

        points.pop if points.size > 1 && same_point?(points.first, points.last)
        points.reverse! if polygon_area(points).positive?

        points
      end

      def to_point(point)
        unless point.is_a?(Array) && point.size >= 2 && point[0, 2].all? { |v| v.is_a?(Numeric) && v.to_f.finite? }
          raise ArgumentError, "invalid polygon point: #{point.inspect}"
        end

        [point[0].to_f, point[1].to_f]
      end

      # Insert `count` points spread evenly along the ring's perimeter.
      def add_points(ring, count)
        return if count.zero?

        desired_size = ring.size + count
        step = polygon_length(ring) / count

        i = 0
        cursor = 0.0
        insert_at = step / 2

        while ring.size < desired_size
          a = ring[i]
          b = ring[(i + 1) % ring.size]
          segment = distance(a, b)

          if insert_at <= cursor + segment
            ring.insert(i + 1, segment.zero? ? a.dup : point_along(a, b, (insert_at - cursor) / segment))
            insert_at += step
            next
          end

          cursor += segment
          i += 1
        end
      end

      # Rotate the ring's starting point to the offset closest to `target`,
      # by sum of squared distances.
      def rotate(ring, target)
        size = ring.size
        min = Float::INFINITY
        best_offset = nil

        size.times do |offset|
          sum_of_squares = 0.0

          target.each_with_index do |point, i|
            d = distance(ring[(offset + i) % size], point)
            sum_of_squares += d * d
          end

          if sum_of_squares < min
            min = sum_of_squares
            best_offset = offset
          end
        end

        ring.rotate!(best_offset) if best_offset&.positive?
      end

      def distance(a, b)
        Math.sqrt(((a[0] - b[0]) * (a[0] - b[0])) + ((a[1] - b[1]) * (a[1] - b[1])))
      end

      def point_along(a, b, pct)
        [a[0] + ((b[0] - a[0]) * pct), a[1] + ((b[1] - a[1]) * pct)]
      end

      def same_point?(a, b)
        distance(a, b) < SAME_POINT_EPSILON
      end

      # d3-polygon's polygonArea: signed, positive for counter-clockwise rings
      # in y-down screen space.
      def polygon_area(points)
        area = 0.0
        b = points.last

        points.each do |point|
          a = b
          b = point
          area += (a[1] * b[0]) - (a[0] * b[1])
        end

        area / 2
      end

      # d3-polygon's polygonLength: the perimeter, closing segment included.
      def polygon_length(points)
        xb, yb = points.last
        perimeter = 0.0

        points.each do |x, y|
          xa = xb - x
          ya = yb - y
          xb = x
          yb = y
          perimeter += Math.sqrt((xa * xa) + (ya * ya))
        end

        perimeter
      end
    end
  end
end
