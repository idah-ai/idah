# frozen_string_literal: true

require "open3"

module IdahVideo
  module Processor
    module Ffmpeg
      extend self

      StreamVariant = Data.define(
        :name, :width, :height, :bitrate, :audiobitrate
      )

      DECODING_THREADS = Verse.config.extra_fields.dig(
        :idah,
        :plugins,
        :config,
        :idah_video,
        :decoding_threads
      )&.to_s
      ENCODING_THREADS = Verse.config.extra_fields.dig(
        :idah,
        :plugins,
        :config,
        :idah_video,
        :encoding_threads
      )&.to_s

      def gen_stream(
        dir:,
        file:,
        variants:,
        fps:,
        streaming_time_per_segment: 5,
        &
      )
        args = []

        # Logging and progress reporting
        args += ["-y"]                       # Overwrite output files without asking
        args += ["-v", "quiet"]              # Suppress console output
        args += ["-progress", "pipe:1"]      # Send progress info to stdout for monitoring

        # Input handling flags (must come before -i)
        args += ["-avoid_negative_ts", "make_zero"]  # Shift timestamps to start at zero
        args += ["-fflags", "+genpts"]               # Generate PTS if missing

        # Input file
        args += ["-i", file]

        # Build filter_complex to create all scaled variants efficiently
        # Uses split to decode video once, then scales to multiple resolutions
        args += ["-filter_complex", build_filter_complex(variants)]

        # Check if any variant has audio configured
        has_audio = variants.any?(&:audiobitrate)

        # Map streams for each variant
        variants.each do |variant|
          args += ["-map", "[v#{variant.name}]"] # Map scaled video stream
          args += ["-map", "0:a?"] if has_audio # Map original audio stream (optional)
        end

        # Global video encoding settings (apply to all outputs)
        args += ["-c:v", "libx264"]          # Use H.264 video codec
        args += ["-preset", "veryfast"]      # Encoding speed preset
        args += ["-profile:v", "main"]       # H.264 profile for compatibility

        # Per-variant video bitrates (must specify for each mapped stream)
        variants.each do |variant|
          args += ["-b:v", variant.bitrate.to_s]
        end

        # Calculate keyframe interval (keyint = fps * segment_duration)
        keyint = (fps * streaming_time_per_segment).round
        args += ["-g", keyint.to_s]          # GOP size: frames between keyframes
        args += ["-keyint_min", keyint.to_s] # Minimum GOP size
        args += ["-sc_threshold", "0"]       # Disable scene cut detection
        args += ["-force_key_frames", "expr:gte(t,n_forced*#{streaming_time_per_segment})"]

        # Global audio encoding settings (apply to all outputs if audio exists)
        if has_audio
          args += ["-c:a", "aac"]              # Use AAC audio codec
          args += ["-ar", "48000"]             # Audio sample rate: 48kHz

          # Per-variant audio bitrates (must specify for each mapped audio stream)
          variants.each do |variant|
            if variant.audiobitrate
              args += ["-b:a", variant.audiobitrate.to_s]
            end
          end
        end

        # Encoding threads (if configured)
        args += ["-threads", ENCODING_THREADS] if ENCODING_THREADS

        # HLS output format and settings (global for all variants)
        args += ["-f", "hls"]                                   # Output format: HLS
        args += ["-hls_time", streaming_time_per_segment.to_s]  # Target segment duration
        args += ["-hls_playlist_type", "vod"]                   # VOD playlist type
        args += ["-hls_flags", "independent_segments"]          # Independent segments
        args += ["-hls_segment_type", "mpegts"]                 # Segment type: MPEG-TS
        args += ["-hls_start_number_source", "0"]               # Start numbering from 0

        # Build var_stream_map: defines which video/audio pairs go to which variant
        # Format with audio: "v:0,a:0,name:240p v:1,a:1,name:360p ..."
        # Format without audio: "v:0,name:240p v:1,name:360p ..."
        var_stream_map = variants.each_with_index.map do |variant, index|
          if has_audio
            "v:#{index},a:#{index},name:#{variant.name}"
          else
            "v:#{index},name:#{variant.name}"
          end
        end.join(" ")
        args += ["-var_stream_map", var_stream_map]

        # Master playlist filename
        args += ["-master_pl_name", "master.m3u8"]

        # Segment filename pattern: %v will be replaced with variant name
        args += ["-hls_segment_filename", "%v_%05d.ts"]

        # Output playlist pattern: %v will be replaced with variant name
        args += ["%v.m3u8"]

        # Execute ffmpeg and monitor progress
        call(*args, chdir: dir) do |stdout|
          stdout.each_line do |line|
            key, value = line.chomp.split("=")
            next unless key == "out_time_us"

            time = value.to_i / 1_000_000.0 # Convert microseconds to seconds

            yield time if block_given?
          end
        end
      end

      def gen_thumbnail(
        file, fps, chdir,
        images: 10,
        scale: "240:-1",
        output: "thumb_%02d.jpg"
      )
        args = []
        args += ["-threads", DECODING_THREADS] if DECODING_THREADS
        args += [
          "-i",
          file,
          "-vf",
          "fps=#{fps},scale=#{scale}",
          "-fps_mode",
          "vfr",
          "-frames:v",
          images.to_s,
          "-q:v",
          "2"
        ]
        args += ["-threads", ENCODING_THREADS] if ENCODING_THREADS
        args += [output, "-y"]

        call(*args, chdir:)
      end

      def call(*args, **kv, &)
        Verse.logger&.info { "Running ffmpeg" }
        Verse.logger&.debug { "ffmpeg #{args.join(" ")} #{kv.map{ |k, v| "#{k}=#{v}" }.join(" ")}" }

        Open3.popen3("ffmpeg", *args, **kv) do |_, stdout, stderr, wait_thr|
          captured_stderr = nil

          if block_given?
            yield stdout, stderr
          else
            err_t = Thread.new { stderr.read }
            out_t = Thread.new { stdout.read }

            err_t.join
            out_t.join

            captured_stderr = err_t.value
          end

          result = wait_thr.value

          unless result.success?
            err = captured_stderr || stderr.read
            error = "Failed to execute `ffmpeg #{args.join(" ")}`: #{result}\n#{err}"
            Verse.logger&.error { error }
            raise error
          end
        end
      end

      private

      def build_filter_complex(variants)
        # Build an optimized FFmpeg filter_complex that decodes video once
        # and scales to multiple resolutions in parallel
        #
        # Example output for 3 variants:
        # "[0:v]split=3[s0][s1][s2];[s0]scale=428:240[v240p];[s1]scale=640:360[v360p];[s2]scale=854:480[v480p]"
        #
        # This is more efficient than scaling each variant separately because:
        # - Video is decoded only once (split filter)
        # - All scaled outputs are generated in parallel

        variant_count = variants.size

        # Generate split output names: [s0][s1][s2]...
        split_outputs = (0...variant_count).map { |i| "[s#{i}]" }.join

        filter_parts = []

        # First filter: split input video into N streams
        # [0:v] = input video stream
        # split=N = split into N identical streams
        # [s0][s1]...[sN-1] = output labels for each split stream
        filter_parts << "[0:v]split=#{variant_count}#{split_outputs}"

        # Subsequent filters: scale each split stream to target resolution
        # [s0] = input from split stream 0
        # scale=W:H = resize to width x height
        # [vNAME] = output label (e.g., [v240p], [v360p])
        variants.each_with_index do |variant, index|
          filter_parts << "[s#{index}]scale=#{variant.width}:#{variant.height}[v#{variant.name}]"
        end

        # Join all filters with semicolons into a single filter_complex string
        filter_parts.join(";")
      end
    end
  end
end
