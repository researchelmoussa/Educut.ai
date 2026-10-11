"""Generate a voice-over from a cue sheet and mix it onto a silent film.

    python3 scripts/voiceover.py assets/brand/videos/ai-eligibility.vo.txt \
        assets/video/educut-ai-eligibility-30s.mp4 out.mp4 --models models/kokoro

Cue sheet lines: "start-seconds | max-seconds | text". Each line is spoken
with Kokoro-82M (ONNX), sped up just enough to fit its max-seconds slot, and
placed at its start time. --models must hold kokoro-v1.0.onnx and either
voices-v1.0.bin or a voices/ folder of per-voice .bin files (the layout of
onnx-community/Kokoro-82M-v1.0-ONNX on Hugging Face).

Needs: pip install kokoro-onnx soundfile; ffmpeg on PATH.
"""
import argparse
import glob
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ap = argparse.ArgumentParser()
ap.add_argument("cues")
ap.add_argument("video")
ap.add_argument("out")
ap.add_argument("--models", required=True)
ap.add_argument("--voice", default="am_michael")  # warm male narrator, closest to the intro's
ap.add_argument("--speed", type=float, default=1.0)
args = ap.parse_args()

model = os.path.join(args.models, "kokoro-v1.0.onnx")
if not os.path.exists(model):
    model = os.path.join(args.models, "onnx", "model.onnx")
voices = os.path.join(args.models, "voices-v1.0.bin")
if not os.path.exists(voices):
    # pack per-voice raw float32 files (510 x 1 x 256) into the npz kokoro-onnx expects
    packed = {os.path.basename(f)[:-4]: np.fromfile(f, np.float32).reshape(-1, 1, 256)
              for f in glob.glob(os.path.join(args.models, "voices", "*.bin"))}
    voices = os.path.join(tempfile.mkdtemp(), "voices.npz")
    np.savez(voices, **packed)
tts = Kokoro(model, voices)

cues = []
for line in open(args.cues, encoding="utf-8"):
    if line.strip() and not line.startswith("#"):
        start, room, text = (p.strip() for p in line.split("|", 2))
        cues.append((float(start), float(room), text))

dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                     "-of", "csv=p=0", args.video]))
SR = 24000
track = np.zeros(int(dur * SR) + SR, np.float32)
for start, room, text in cues:
    speed = args.speed
    audio, sr = tts.create(text, voice=args.voice, speed=speed)
    while len(audio) / sr > room and speed < 1.35:  # fit the slot without sounding rushed
        speed = min(1.35, speed * len(audio) / sr / room + 0.02)
        audio, sr = tts.create(text, voice=args.voice, speed=speed)
    assert sr == SR
    i = int(start * SR)
    track[i:i + len(audio)] += audio
    print(f"{start:5.1f}s  {len(audio) / sr:4.1f}s/{room}s  x{speed:.2f}  {text}")

track = track[: int(dur * SR)]
track *= 0.89 / max(1e-6, np.abs(track).max())  # peak at about -1 dBFS
wav = os.path.join(tempfile.mkdtemp(), "vo.wav")
sf.write(wav, track, SR)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", args.video, "-i", wav, "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-af", "loudnorm=I=-16:TP=-1.5",
                "-shortest", "-movflags", "+faststart", args.out], check=True)
print("wrote", args.out)
