# frozen_string_literal: true

require "spec_helper"
require_relative "../spec_data/annotation_fixture"

RSpec.describe AnnotationDiff do
  # `require "verse/ext"` (verse-redis) registers Time for msgpack, exactly as
  # production event serialization needs it.
  require "verse/ext"

  describe ".call" do
    it "reports a changed scalar and leaves an unchanged one out" do
      expect(AnnotationDiff.call({ a: 1, b: 2 }, { a: 1, b: 3 })).to eq([["~", "b", 2, 3]])
    end

    it "treats 1 and 1.0 as unchanged" do
      expect(AnnotationDiff.call({ a: 1 }, { a: 1.0 })).to eq([])
    end

    it "compares string and symbol keys the same" do
      expect(AnnotationDiff.call({ "a" => 1 }, { a: 1 })).to eq([])
      expect(AnnotationDiff.call({ a: 1 }, { "a" => 2 })).to eq([["~", "a", 1, 2]])
    end

    it "diffs hashes key by key, nested several levels" do
      old_h = { a: { b: { c: 1, d: 2 }, e: 3 }, keep: "x" }
      new_h = { a: { b: { c: 1, d: 3 }, e: 4 } }
      expect(AnnotationDiff.call(old_h, new_h)).to contain_exactly(
        ["~", "a.b.d", 2, 3],
        ["~", "a.e", 3, 4],
        ["-", "keep", "x", nil]
      )
    end

    it "distinguishes null from absent" do
      expect(AnnotationDiff.call({ a: nil }, {})).to eq([["-", "a", nil, nil]])
      expect(AnnotationDiff.call({}, { a: nil })).to eq([["+", "a", nil, nil]])
      expect(AnnotationDiff.call({ a: nil }, { a: 1 })).to eq([["~", "a", nil, 1]])
      expect(AnnotationDiff.call({ a: 1 }, { a: nil })).to eq([["~", "a", 1, nil]])
    end

    it "compares only the keys present in the new hash (partial update)" do
      # A caller that wants an untouched field ignored passes old and new
      # hashes sliced to the keys it writes (the repository's `update` does
      # exactly that).
      expect(AnnotationDiff.call({ b: 2 }, { b: 5 })).to eq([["~", "b", 2, 5]])

      # An old-only key in the input, present in old but absent in new, is
      # recorded as `-` (removed) — e.g. a tile deleted via write_shapes.
      expect(AnnotationDiff.call({ a: 1, b: 2 }, { b: 5 })).to eq([["-", "a", 1, nil], ["~", "b", 2, 5]])
    end

    shared_examples "a whole-array diff" do
      it "records one entry with both full arrays" do
        changes = AnnotationDiff.call(old_h, new_h, identity_keys: identity_keys)
        expect(changes.size).to eq(1)
        op, path, old_v, new_v = changes.first
        expect(op).to eq("~")
        expect(path).to eq("shape_args.frames")
        expect(old_v).to eq(old_h[:shape_args]["frames"])
        expect(new_v).to eq(new_h[:shape_args]["frames"])
      end
    end

    describe "keyed arrays" do
      let(:identity_keys) { { "frames" => "frame" } }

      let(:old_h) do
        { shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS, category: "vehicles/car" }
      end
      let(:new_h) do
        { shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS_MOVED_FRAME_57, category: "vehicles/car" }
      end

      # The added/removed/reorder examples only care about the frames diff; a
      # full call also reports `- category` when the new hash omits it, so
      # those examples compare against a frames-only hash.
      def frames_only(hash)
        { shape_args: hash[:shape_args] }
      end

      it "records a keyframe move under frames[frame=N]" do
        changes = AnnotationDiff.call(old_h, new_h, identity_keys:)

        expect(changes.size).to eq(1)
        op, path, old_v, new_v = changes.first
        expect([op, path]).to eq(["~", "shape_args.frames[frame=57].points"])
        expect(old_v).to eq(AnnotationFixture::VIDEO_SHAPE_ARGS["frames"].find { |f| f["frame"] == 57 }["points"])
        expect(new_v).to eq(
          AnnotationFixture::VIDEO_SHAPE_ARGS_MOVED_FRAME_57["frames"].find { |f| f["frame"] == 57 }["points"]
        )
      end

      it "records an added keyframe" do
        new_hash = frames_only(
          shape_args: old_h[:shape_args].merge(
            "frames" => old_h[:shape_args]["frames"] + [{ "frame" => 99,
                                                          "points" => [[0.5, 0.5], [0.6, 0.5], [0.6, 0.6],
                                                                       [0.5, 0.6]] }]
          )
        )
        changes = AnnotationDiff.call(frames_only(old_h), new_hash, identity_keys:)
        expect(changes).to contain_exactly(
          [
            "+", "shape_args.frames[frame=99]", nil,
            { "frame" => 99, "points" => [[0.5, 0.5], [0.6, 0.5], [0.6, 0.6], [0.5, 0.6]] }
          ]
        )
      end

      it "records a removed keyframe" do
        frames = old_h[:shape_args]["frames"].reject { |f| f["frame"] == 14 }
        new_hash = frames_only(shape_args: old_h[:shape_args].merge("frames" => frames))
        changes = AnnotationDiff.call(frames_only(old_h), new_hash, identity_keys:)
        expect(changes).to contain_exactly(
          ["-", "shape_args.frames[frame=14]", old_h[:shape_args]["frames"][1], nil]
        )
      end

      it "records nothing when only the order changes" do
        frames = old_h[:shape_args]["frames"].rotate
        new_hash = frames_only(shape_args: old_h[:shape_args].merge("frames" => frames))
        changes = AnnotationDiff.call(frames_only(old_h), new_hash, identity_keys:)
        expect(changes).to eq([])
      end
    end

    describe "without identity keys" do
      let(:identity_keys) { {} }

      let(:old_h) do
        { shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS, category: "vehicles/car" }
      end
      let(:new_h) do
        { shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS_MOVED_FRAME_57, category: "vehicles/car" }
      end

      include_examples "a whole-array diff"

      it "diffs an unkeyed video change as one whole-array entry" do
        changes = AnnotationDiff.call(old_h, new_h, identity_keys:)
        expect(changes.first[1]).to eq("shape_args.frames")
      end
    end

    describe "fallbacks for keyed arrays" do
      let(:identity_keys) { { "frames" => "frame" } }

      def h(frames)
        { shape_args: { "frames" => frames } }
      end

      it "treats duplicate key values as a whole array" do
        old_frames = [
          { "frame" => 1, "points" => [[0.1, 0.2]] },
          { "frame" => 2, "points" => [[0.3, 0.4]] },
          { "frame" => 2, "points" => [[0.5, 0.6]] } # duplicate key on the old side
        ]
        new_frames = [
          { "frame" => 1, "points" => [[0.1, 0.2]] },
          { "frame" => 2, "points" => [[0.3, 0.4]] }
        ]
        changes = AnnotationDiff.call(h(old_frames), h(new_frames), identity_keys:)
        expect(changes).to eq([["~", "shape_args.frames", old_frames, new_frames]])
      end

      it "treats a changed duplicate-key list as a whole array" do
        old_frames = [{ "frame" => 1, "points" => [[0.1, 0.2]] }]
        new_frames = [
          { "frame" => 1, "points" => [[0.1, 0.2]] },
          { "frame" => 1, "points" => [[0.3, 0.4]] } # duplicate key on the new side
        ]
        changes = AnnotationDiff.call(h(old_frames), h(new_frames), identity_keys:)
        expect(changes).to eq([["~", "shape_args.frames", old_frames, new_frames]])
      end

      it "treats a missing key as a whole array" do
        old_frames = [{ "frame" => 1, "points" => [[0.1, 0.2]] }]
        new_frames = [{ "name" => 1, "points" => [[0.1, 0.2]] }] # key replaced
        changes = AnnotationDiff.call(h(old_frames), h(new_frames), identity_keys:)
        expect(changes).to eq([["~", "shape_args.frames", old_frames, new_frames]])
      end

      it "treats a non-Hash item as a whole array" do
        old_frames = [{ "frame" => 1, "points" => [[0.1, 0.2]] }]
        new_frames = [[1]]
        changes = AnnotationDiff.call(h(old_frames), h(new_frames), identity_keys:)
        expect(changes).to eq([["~", "shape_args.frames", old_frames, new_frames]])
      end
    end

    it "diffs an unkeyed polygon points array as one whole-array entry" do
      old_h = { shape_args: { "points" => [[0, 0], [1, 1]] } }
      new_h = { shape_args: { "points" => [[0, 0], [1, 2]] } }
      expect(AnnotationDiff.call(old_h, new_h)).to eq(
        [["~", "shape_args.points", [[0, 0], [1, 1]], [[0, 0], [1, 2]]]]
      )
    end

    it "records one entry for a type change (Hash to Array)" do
      expect(AnnotationDiff.call({ a: { b: 1 } }, { a: [1] })).to eq([["~", "a", { "b" => 1 }, [1]]])
    end

    describe "paths" do
      it "builds keyed paths with JSON string values" do
        old_h = { shape_args: { "frames" => [{ "frame" => 1, "points" => [] }] } }
        new_h = { shape_args: { "frames" => [{ "frame" => 1, "points" => [1] }] } }

        expect(AnnotationDiff.call(old_h, new_h, identity_keys: { "frames" => "frame" })).to eq(
          [["~", "shape_args.frames[frame=1].points", [], [1]]]
        )

        str_old = { shape_args: { "frames" => [{ "id" => "a1", "points" => [1] }] } }
        str_new = { shape_args: { "frames" => [{ "id" => "a1", "points" => [2] }] } }

        expect(AnnotationDiff.call(str_old, str_new, identity_keys: { "frames" => "id" })).to eq(
          [["~", 'shape_args.frames[id="a1"].points', [1], [2]]]
        )
      end

      it "escapes segment separators in hash keys" do
        old_h = { "a.b" => 1, "c[d" => 2, "e]f" => 3, "g\\h" => 4, plain: 5 }
        new_h = old_h.merge("a.b" => 9)
        changes = AnnotationDiff.call(old_h, new_h)
        expect(changes.map(&:first)).to eq(["~"])
        expect(changes.first[1]).to eq('a\.b')

        expect(AnnotationDiff.parse_path(changes.first[1])).to eq(["a.b"])
      end

      it "round-trips parse_path(path(...))" do
        expect(AnnotationDiff.parse_path(AnnotationDiff.path("shape_args"))).to eq(["shape_args"])
        expect(AnnotationDiff.parse_path(AnnotationDiff.path("shape_args.frames"))).to eq(%w[shape_args frames])
        expect(
          AnnotationDiff.parse_path(AnnotationDiff.path("shape_args.frames[frame=57].points"))
        ).to eq(["shape_args", "frames[frame=57]", "points"])
        expect(
          AnnotationDiff.parse_path(AnnotationDiff.path("shape_args", 'frames[frame="5.7"]'))
        ).to eq(["shape_args", 'frames[frame="5.7"]'])
      end
    end
  end

  describe ".apply / .revert" do
    it "applies a scalar change and reverts it" do
      expect(AnnotationDiff.apply({ a: 1 }, [["~", "a", 1, 2]])).to eq({ "a" => 2 })
      expect(AnnotationDiff.revert({ a: 2 }, [["~", "a", 1, 2]])).to eq({ "a" => 1 })
    end

    it "adds a hash key with + and removes it with -" do
      changes = [["+", "a.b", nil, 5]]
      expect(AnnotationDiff.apply({}, changes)).to eq({ "a" => { "b" => 5 } })
      expect(AnnotationDiff.revert({ a: { b: 5 } }, changes)).to eq({})

      changes = [["-", "a.b", 5, nil]]
      expect(AnnotationDiff.apply({ a: { b: 5 } }, changes)).to eq({})
      expect(AnnotationDiff.revert({}, changes)).to eq({ "a" => { "b" => 5 } })
    end

    describe "keyed-array placement" do
      def base
        {
          shape_args: {
            "frames" => [
              { "frame" => 12, "points" => [[0, 0]] },
              { "frame" => 80, "points" => [[1, 1]] }
            ]
          }
        }
      end

      def added
        {
          shape_args: {
            "frames" => [
              { "frame" => 12, "points" => [[0, 0]] },
              { "frame" => 57, "points" => [[2, 2]] },
              { "frame" => 80, "points" => [[1, 1]] }
            ]
          }
        }
      end

      it "inserts an added keyed item in ascending key order" do
        changes = [["+", "shape_args.frames[frame=57]", nil, { "frame" => 57, "points" => [[2, 2]] }]]
        expect(AnnotationDiff.apply(base, changes)).to eq(AnnotationDiff.normalize(added))
      end

      it "re-inserts a removed keyed item in ascending key order" do
        # Reverting a `-` (removal) re-adds the item: from `base` (which no
        # longer has frame 57) back to `added`.
        changes = [["-", "shape_args.frames[frame=57]", { "frame" => 57, "points" => [[2, 2]] }, nil]]
        expect(AnnotationDiff.revert(base, changes)).to eq(AnnotationDiff.normalize(added))
      end
    end

    it "round-trips a bbox update" do
      old_h = { shape_args: { x: 10, y: 20, width: 30, height: 40 }, category: "cat" }
      new_h = { shape_args: { x: 11, y: 21, width: 31, height: 41 }, category: "dog" }

      changes = AnnotationDiff.call(old_h, new_h)
      expect(AnnotationDiff.apply(old_h, changes)).to eq(AnnotationDiff.normalize(new_h))
      expect(AnnotationDiff.revert(new_h, changes)).to eq(AnnotationDiff.normalize(old_h))
    end

    it "round-trips the video track fixture" do
      old_h = { shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS, category: "vehicles/car" }
      new_h = { shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS_MOVED_FRAME_57, category: "vehicles/car" }

      changes = AnnotationDiff.call(old_h, new_h, identity_keys: { "frames" => "frame" })
      expect(AnnotationDiff.apply(old_h, changes)).to eq(AnnotationDiff.normalize(new_h))
      expect(AnnotationDiff.revert(new_h, changes)).to eq(AnnotationDiff.normalize(old_h))
    end

    it "round-trips a mask with several tiles" do
      old_h = {
        shape_args: { x: 1 },
        "tile-0x0" => { "rle" => "A" },
        "tile-0x1" => { "rle" => "B" },
        "tile-2x3" => { "rle" => "C" }
      }
      new_h = {
        shape_args: { x: 1 },
        "tile-0x1" => { "rle" => "BB" },
        "tile-2x3" => { "rle" => "C" },
        "tile-9x9" => { "rle" => "D" }
      }

      changes = AnnotationDiff.call(old_h, new_h)
      expect(AnnotationDiff.apply(old_h, changes)).to eq(AnnotationDiff.normalize(new_h))
      expect(AnnotationDiff.revert(new_h, changes)).to eq(AnnotationDiff.normalize(old_h))
    end

    it "normalizes Time values to ISO 8601 UTC strings" do
      t = Time.now.utc
      old_h = { deleted_at: t }
      new_h = { deleted_at: t }

      expect(AnnotationDiff.call(old_h, new_h)).to eq([])
    end

    describe "with Sequel JSONB* wrappers (as read back from the table)" do
      require "sequel"
      Sequel.extension :pg_json

      def jsonb_wrap(value)
        ::Sequel.pg_json_wrap(value)
      end

      it "gives the same result as with plain values" do
        old_h = { shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS, category: "vehicles/car" }
        new_h = { shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS_MOVED_FRAME_57, category: "vehicles/car" }

        changes = AnnotationDiff.call(old_h, new_h, identity_keys: { "frames" => "frame" })

        wrapped_changes = changes.map do |op, path, old_v, new_v|
          [op, path, jsonb_wrap(old_v), jsonb_wrap(new_v)]
        end

        expect(AnnotationDiff.apply(old_h, wrapped_changes)).to eq(AnnotationDiff.normalize(new_h))
        expect(AnnotationDiff.revert(new_h, wrapped_changes)).to eq(AnnotationDiff.normalize(old_h))
      end
    end
  end
end
