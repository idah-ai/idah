#!/usr/bin/env bash
# Transcode a video into HLS with adaptive bitrate streams.
# TS segments and variant playlists are placed in subdirectories (240p/, 480p/, 1080p/).
# Usage: ./transcode.sh input.mp4
set -euo pipefail

INPUT="${1:-input.mp4}"

# Create variant directories
mkdir -p 240p 480p 1080p

ffmpeg \
  -y \
  -v error \
  -progress pipe:1 \
  -avoid_negative_ts make_zero \
  -fflags +genpts \
  -i "$INPUT" \
  -filter_complex "[0:v]split=3[s0][s1][s2];[s0]scale=426:240[v240p];[s1]scale=854:480[v480p];[s2]scale=1920:1080[v1080p]" \
  -map "[v240p]" \
  -map "[v480p]" \
  -map "[v1080p]" \
  -c:v libx264 \
  -preset veryfast \
  -profile:v main \
  -pix_fmt yuv420p \
  -crf 20 \
  -g 6 \
  -keyint_min 6 \
  -sc_threshold 0 \
  -force_key_frames "expr:gte(t,n_forced*0.2)" \
  -f hls \
  -hls_time 2 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_type mpegts \
  -hls_start_number_source 0 \
  -var_stream_map "v:0,name:240p v:1,name:480p v:2,name:1080p" \
  -master_pl_name master.m3u8 \
  -hls_segment_filename "%v/segment_%05d.ts" \
  "%v/playlist.m3u8"
