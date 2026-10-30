#!/usr/bin/env bash
# Generates the e2e test media into tests/fixtures/audio/ (committed):
#   tone.mp3, tone.ogg  8 s, 440 Hz, 64 kbps
#   hls/                index.m3u8 + 2 s AAC segments of the tone
#   dash/               manifest.mpd + segments of the tone
#   intro.mp3           2 s, 880 Hz (distinguishable from the live tone)
#   hls-id3/            HLS of packed AAC with ID3 song titles (make-id3-hls.mjs, spec 0020)
# Requires ffmpeg with libmp3lame and libvorbis, and Node. Output is bit-exact so a
# re-run does not dirty the tree.
set -euo pipefail

OUT="$(cd "$(dirname "$0")/../.." && pwd)/tests/fixtures/audio"
FF=(ffmpeg -v error -y)
ENC=(-fflags +bitexact -map_metadata -1 -flags:a +bitexact -ac 1 -ar 44100 -b:a 64k)

rm -rf "$OUT"
mkdir -p "$OUT/hls" "$OUT/dash"

"${FF[@]}" -f lavfi -i "sine=frequency=440:duration=8" "${ENC[@]}" -c:a libmp3lame "$OUT/tone.mp3"
"${FF[@]}" -f lavfi -i "sine=frequency=440:duration=8" "${ENC[@]}" -c:a libvorbis "$OUT/tone.ogg"
"${FF[@]}" -f lavfi -i "sine=frequency=880:duration=2" "${ENC[@]}" -c:a libmp3lame "$OUT/intro.mp3"

"${FF[@]}" -f lavfi -i "sine=frequency=440:duration=8" "${ENC[@]}" -c:a aac \
	-f hls -hls_time 2 -hls_playlist_type vod -hls_segment_filename "$OUT/hls/seg-%03d.ts" \
	"$OUT/hls/index.m3u8"
"${FF[@]}" -f lavfi -i "sine=frequency=440:duration=8" "${ENC[@]}" -c:a aac \
	-f dash -seg_duration 2 -use_timeline 1 -use_template 1 \
	-init_seg_name 'init-$RepresentationID$.m4s' -media_seg_name 'seg-$RepresentationID$-$Number%03d$.m4s' \
	"$OUT/dash/manifest.mpd"

node "$(dirname "$0")/make-id3-hls.mjs"

du -sh "$OUT"
