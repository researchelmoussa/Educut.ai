#!/bin/sh
# Lay the ElevenLabs voice-over onto the silent render, one chunk per scene,
# over the score from music.py (ducked under the voice).
# Each row: chunk start, chunk end (cut in the read's own pauses), where its first word lands in the film.
set -e
cd "$(dirname "$0")"
CHUNKS="0:5.27:0.40 5.27:14.07:6.46 14.07:20.43:15.55 20.43:30.14:23.70 30.14:40.25:33.90 40.25:47.08:44.70 47.08:51.47:54.60 51.47:55.25:59.80"
F=""; L=""; i=0
for c in $CHUNKS; do
  s=${c%%:*}; r=${c#*:}; e=${r%%:*}; at=${r#*:}
  # delay so the first word (not the chunk edge) lands at "at"
  first=$(ffmpeg -v info -ss "$s" -to "$e" -i voiceover.mp3 -af silencedetect=noise=-40dB:d=0.05 -f null - 2>&1 | awk '/silence_end/{print $5; exit}')
  [ -z "$first" ] && first=0
  case "$first" in 0.0*|0.1*|0.2*|0.3*|0.4*) ;; *) first=0;; esac
  d=$(awk -v a="$at" -v f="$first" 'BEGIN{x=(a-f)*1000; if(x<0)x=0; printf "%d", x}')
  F="$F[1:a]atrim=$s:$e,asetpts=PTS-STARTPTS,afade=t=in:d=0.04,areverse,afade=t=in:d=0.08,areverse,adelay=$d|$d[c$i];"
  L="$L[c$i]"; i=$((i+1))
done
ffmpeg -y -v error -i educut-connect-who-we-are.mp4 -i voiceover.mp3 -i music.wav -filter_complex \
  "${F}${L}amix=inputs=$i:normalize=0,apad,atrim=0:66,aformat=channel_layouts=stereo,asplit[vo][key];[2:a]volume=-10dB[mu];[mu][key]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=450:makeup=1[bed];[vo][bed]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -ac 2 -movflags +faststart educut-connect-who-we-are-vo.mp4
echo wrote educut-connect-who-we-are-vo.mp4
