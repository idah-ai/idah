# frozen_string_literal: true

module IdahVideo
  module Export
    # Ruby port of the frontend's `getInterpolatedFrame`
    # (`utils/interpolation.ts`): the geometry of a video annotation at a
    # frame. IDAH stores only keyframes; the frontend computes every other
    # frame on screen, and the export computes it here the same way.
    # `interpolation_parity.json` checks both against the same fixtures.
    module Interpolator
      extend self

      BOUNDING_BOX = "idah-video:bounding-box"
      POLYGON = "idah-video:polygon"

      # Normalized points and angle (radians) at a frame. `keyframe` is true
      # when they are a stored keyframe rather than computed.
      Geometry = Data.define(:points, :angle, :keyframe)

      # @param shape_type [String] the annotation's shape type
      # @param shape_args [Hash] `{ start:, end:, frames: [{ frame:, angle:, points: }] }`,
      #   with symbol or string keys
      # @param frame [Integer] the frame number, from 0
      # @return [Geometry, nil] nil when nothing is drawn on that frame: outside
      #   `start..end`, or before the first or after the last keyframe
      def at(shape_type, shape_args, frame)
        frames = Array(value(shape_args, :frames))
        return if frames.empty?

        start = value(shape_args, :start)
        finish = value(shape_args, :end)
        return if (start && start > frame) || (finish && finish < frame)

        exact = frames.find { |f| value(f, :frame) == frame }
        return geometry(value(exact, :points), angle(exact), keyframe: true) if exact

        before, after = surrounding_keyframes(frames, frame)
        return unless before && after

        t = (frame - value(before, :frame)).to_f / (value(after, :frame) - value(before, :frame))
        angle = ((angle(after) - angle(before)) * t) + angle(before)

        case shape_type
        when BOUNDING_BOX
          geometry(lerp_points(value(before, :points), value(after, :points), t), angle, keyframe: false)
        when POLYGON
          geometry(PolygonMorph.interpolate(value(before, :points), value(after, :points), t), 0.0, keyframe: false)
        else
          raise ArgumentError, "cannot interpolate shape type `#{shape_type}`"
        end
      end

      private

      def geometry(points, angle, keyframe:)
        return if points.nil? || points.empty?

        Geometry.new(points: points.map { |x, y| [x.to_f, y.to_f] }, angle:, keyframe:)
      end

      # The closest keyframes before and after the frame. On a tie the first
      # one listed wins, as in the frontend.
      def surrounding_keyframes(frames, frame)
        before = nil
        after = nil

        frames.each do |f|
          number = value(f, :frame)
          before = f if number < frame && (before.nil? || number > value(before, :frame))
          after = f if number > frame && (after.nil? || number < value(after, :frame))
        end

        [before, after]
      end

      def lerp_points(a, b, t)
        a.each_with_index.map do |p, i|
          [p[0] + ((b[i][0] - p[0]) * t), p[1] + ((b[i][1] - p[1]) * t)]
        end
      end

      # A missing angle is 0, as `angle || 0` in the frontend.
      def angle(keyframe)
        (value(keyframe, :angle) || 0).to_f
      end

      # Shape args come from JSON, with symbol or string keys.
      def value(hash, key)
        hash.key?(key) ? hash[key] : hash[key.to_s]
      end
    end
  end
end
