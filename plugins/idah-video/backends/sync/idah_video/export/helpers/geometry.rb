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
      end
    end
  end
end
