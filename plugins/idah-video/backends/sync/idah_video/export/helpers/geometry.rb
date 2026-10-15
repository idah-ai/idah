# frozen_string_literal: true

module IdahVideo
  module Export
    module Helpers
      # Pixel-space helpers for writing COCO geometry from IDAH's normalized
      # points.
      module Geometry
        extend self

        def to_pixels(points, width, height)
          points.map { |x, y| [x.to_f * width, y.to_f * height] }
        end

        # Turns points around their centroid, clockwise on screen (y points
        # down), as the frontend's rotatePoint.
        def rotate(points, radians)
          cx = points.sum(&:first) / points.size
          cy = points.sum(&:last) / points.size
          cos = Math.cos(radians)
          sin = Math.sin(radians)

          points.map do |x, y|
            dx = x - cx
            dy = y - cy
            [cx + (dx * cos) - (dy * sin), cy + (dx * sin) + (dy * cos)]
          end
        end

        def clamp(points, width, height)
          points.map { |x, y| [x.clamp(0.0, width.to_f), y.clamp(0.0, height.to_f)] }
        end

        # The axis-aligned box around the points, as COCO's [x, y, width, height].
        def envelope(points)
          xs = points.map(&:first)
          ys = points.map(&:last)

          [xs.min, ys.min, xs.max - xs.min, ys.max - ys.min]
        end

        # The smallest rectangle, rotated or not, around the points, as its 4
        # corners in order. Found on the convex hull: one side of the smallest
        # rectangle lies along an edge of the hull (rotating calipers).
        def min_area_rect(points)
          hull = convex_hull(points)
          return hull if hull.size < 3

          best = nil
          hull.each_with_index do |(x1, y1), i|
            x2, y2 = hull[(i + 1) % hull.size]
            length = Math.hypot(x2 - x1, y2 - y1)
            next if length.zero?

            # Unit vectors along the edge (u) and across it (v).
            ux = (x2 - x1) / length
            uy = (y2 - y1) / length
            along = hull.map { |x, y| (x * ux) + (y * uy) }
            across = hull.map { |x, y| (-x * uy) + (y * ux) }
            area = (along.max - along.min) * (across.max - across.min)
            next if best && area >= best[:area]

            best = { area:, ux:, uy:, along: along.minmax, across: across.minmax }
          end

          a0, a1 = best[:along]
          c0, c1 = best[:across]
          [[a0, c0], [a1, c0], [a1, c1], [a0, c1]].map do |a, c|
            [(a * best[:ux]) - (c * best[:uy]), (a * best[:uy]) + (c * best[:ux])]
          end
        end

        # Shoelace formula, positive whatever the point order.
        def polygon_area(points)
          sum = points.each_with_index.sum do |(x, y), i|
            nx, ny = points[(i + 1) % points.size]
            (x * ny) - (nx * y)
          end

          sum.abs / 2
        end

        # COCO's flat [x1, y1, x2, y2, ...], rounded to 2 decimals.
        def flatten(points)
          points.flatten.map { |v| round(v) }
        end

        # Radians to degrees in [0, 360).
        def degrees(radians)
          round((radians.to_f * 180 / Math::PI) % 360)
        end

        def round(value) = value.to_f.round(2)

        # Andrew's monotone chain, counter-clockwise, without repeated points.
        def convex_hull(points)
          sorted = points.uniq.sort
          return sorted if sorted.size < 3

          cross = ->(o, a, b) { ((a[0] - o[0]) * (b[1] - o[1])) - ((a[1] - o[1]) * (b[0] - o[0])) }
          half = lambda do |list|
            list.each_with_object([]) do |point, chain|
              chain.pop while chain.size >= 2 && cross.call(chain[-2], chain[-1], point) <= 0
              chain << point
            end
          end

          lower = half.call(sorted)
          upper = half.call(sorted.reverse)
          lower[0...-1] + upper[0...-1]
        end
      end
    end
  end
end
