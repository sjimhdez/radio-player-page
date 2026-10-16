#!/usr/bin/env bash
# Generates the test media (60 s, 440 Hz tone) into media/: progressive MP3, HLS and DASH.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf media && mkdir -p media/hls media/dash
ffmpeg -v error -f lavfi -i "sine=frequency=440:duration=60" -ac 2 -ar 44100 -c:a libmp3lame -b:a 128k media/tone.mp3
ffmpeg -v error -i media/tone.mp3 -c:a aac -b:a 128k -f hls -hls_time 4 -hls_playlist_type vod \
  -hls_segment_filename media/hls/seg-%03d.ts media/hls/index.m3u8
ffmpeg -v error -i media/tone.mp3 -c:a aac -b:a 128k -f dash -seg_duration 4 media/dash/manifest.mpd
ls -R media | head -20
