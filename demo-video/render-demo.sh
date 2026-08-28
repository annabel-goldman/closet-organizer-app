#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RAW_VIDEO="${1:-/Users/Annie/Desktop/Screen Recording 2026-07-27 at 6.31.06 PM.mov}"
OUTPUT_VIDEO="${2:-$PROJECT_DIR/demo-video/final/Curated-Closet-Demo.mp4}"
VIDEO_PRESET="${VIDEO_PRESET:-medium}"
VIDEO_CRF="${VIDEO_CRF:-20}"
VIDEO_SCALE_FLAGS="${VIDEO_SCALE_FLAGS:-bicubic}"
OUTPUT_WIDTH="${OUTPUT_WIDTH:-1920}"
OUTPUT_HEIGHT="${OUTPUT_HEIGHT:-1080}"
CONTENT_WIDTH="${CONTENT_WIDTH:-1800}"
SIDE_PAD="${SIDE_PAD:-60}"
CAPTION_WIDTH="${CAPTION_WIDTH:-1200}"
CAPTION_HEIGHT="${CAPTION_HEIGHT:-170}"
CAPTION_X="${CAPTION_X:-40}"
CAPTION_Y="${CAPTION_Y:-850}"

if [[ "${VIDEO_HARDWARE:-0}" == "1" ]]; then
  VIDEO_OPTIONS=(
    -c:v h264_videotoolbox
    -b:v "${VIDEO_BITRATE:-8M}"
    -maxrate "${VIDEO_MAXRATE:-12M}"
    -bufsize "${VIDEO_BUFSIZE:-16M}"
    -realtime true
  )
else
  VIDEO_OPTIONS=(
    -c:v libx264
    -preset "$VIDEO_PRESET"
    -crf "$VIDEO_CRF"
  )
fi

ffmpeg -hide_banner -y \
  -i "$RAW_VIDEO" \
  -loop 1 -framerate 30 -t 5 -i "$PROJECT_DIR/demo-video/assets/intro.png" \
  -loop 1 -framerate 30 -t 5 -i "$PROJECT_DIR/demo-video/assets/outro.png" \
  -loop 1 -framerate 30 -t 6 -i "$PROJECT_DIR/demo-video/assets/lower-closet-cropped.png" \
  -loop 1 -framerate 30 -t 8 -i "$PROJECT_DIR/demo-video/assets/lower-outfit-cropped.png" \
  -loop 1 -framerate 30 -t 8 -i "$PROJECT_DIR/demo-video/assets/lower-ai-outfit-cropped.png" \
  -loop 1 -framerate 30 -t 8 -i "$PROJECT_DIR/demo-video/assets/lower-import-cropped.png" \
  -loop 1 -framerate 30 -t 8 -i "$PROJECT_DIR/demo-video/assets/lower-editing-cropped.png" \
  -loop 1 -framerate 30 -t 8 -i "$PROJECT_DIR/demo-video/assets/lower-filter-cropped.png" \
  -i "$PROJECT_DIR/demo-video/assets/deep-urban-eugenio-mininni.mp3" \
  -filter_complex "
    [1:v]trim=duration=5,setpts=PTS-STARTPTS,scale=$OUTPUT_WIDTH:$OUTPUT_HEIGHT,format=yuv420p,
      fade=t=in:st=0:d=0.4,fade=t=out:st=4.2:d=0.8[intro];
    [0:v]fps=30,
      select='
        between(t,0,29)*not(mod(n,2))
        +between(t,34,47)
        +between(t,50,51)
        +between(t,101,103)
        +between(t,109,111)
        +between(t,125,137)
        +between(t,137,155)*not(mod(n,2))
        +between(t,155,156)
        +between(t,164,168)
        +between(t,172,176)
        +between(t,227,230)
        +between(t,232,233)
        +between(t,254,267)
        +between(t,271,273)
        +between(t,285,291)
        +between(t,308,311)
        +between(t,328,343.9)',
      setpts=N/(30*TB),
      scale=$CONTENT_WIDTH:$OUTPUT_HEIGHT:flags=$VIDEO_SCALE_FLAGS,
      pad=$OUTPUT_WIDTH:$OUTPUT_HEIGHT:$SIDE_PAD:0:color=0xf6f3ed,
      setsar=1,format=yuv420p[content];
    [2:v]trim=duration=5,setpts=PTS-STARTPTS,scale=$OUTPUT_WIDTH:$OUTPUT_HEIGHT,format=yuv420p,
      fade=t=in:st=0:d=0.6,fade=t=out:st=4.4:d=0.6[outro];
    [intro][content][outro]concat=n=3:v=1:a=0[base];
    [3:v]scale=$CAPTION_WIDTH:$CAPTION_HEIGHT,format=rgba,setpts=PTS+5/TB[lower0];
    [4:v]scale=$CAPTION_WIDTH:$CAPTION_HEIGHT,format=rgba,setpts=PTS+20/TB[lower1];
    [5:v]scale=$CAPTION_WIDTH:$CAPTION_HEIGHT,format=rgba,setpts=PTS+35.5/TB[lower2];
    [6:v]scale=$CAPTION_WIDTH:$CAPTION_HEIGHT,format=rgba,setpts=PTS+59.5/TB[lower3];
    [7:v]scale=$CAPTION_WIDTH:$CAPTION_HEIGHT,format=rgba,setpts=PTS+72/TB[lower4];
    [8:v]scale=$CAPTION_WIDTH:$CAPTION_HEIGHT,format=rgba,setpts=PTS+96/TB[lower5];
    [base][lower0]overlay=x=$CAPTION_X:y=$CAPTION_Y:eof_action=pass:repeatlast=0[v0];
    [v0][lower1]overlay=x=$CAPTION_X:y=$CAPTION_Y:eof_action=pass:repeatlast=0[v1];
    [v1][lower2]overlay=x=$CAPTION_X:y=$CAPTION_Y:eof_action=pass:repeatlast=0[v2];
    [v2][lower3]overlay=x=$CAPTION_X:y=$CAPTION_Y:eof_action=pass:repeatlast=0[v3];
    [v3][lower4]overlay=x=$CAPTION_X:y=$CAPTION_Y:eof_action=pass:repeatlast=0[v4];
    [v4][lower5]overlay=x=$CAPTION_X:y=$CAPTION_Y:eof_action=pass:repeatlast=0[video];
    [9:a]loudnorm=I=-18:LRA=7:TP=-1.5,aresample=48000,
      alimiter=limit=0.84:attack=5:release=50:level=false,
      afade=t=in:st=0:d=2,afade=t=out:st=112:d=4.4,
      atrim=duration=116.4[audio]
  " \
  -map "[video]" \
  -map "[audio]" \
  -t 116.4 \
  "${VIDEO_OPTIONS[@]}" \
  -pix_fmt yuv420p \
  -c:a aac \
  -b:a 192k \
  -movflags +faststart \
  "$OUTPUT_VIDEO"
