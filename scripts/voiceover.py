"""Generate a voice-over from a cue sheet and mix it onto a silent film.

    python3 scripts/voiceover.py assets/brand/videos/ai-eligibility.vo.txt \
        assets/video/educut-ai-eligibility-30s.mp4 out.mp4 [--engine festival|kokoro]

Cue sheet lines: "start-seconds | max-seconds | text". Each line is spoken,
sped up just enough (pitch kept) to fit its max-seconds slot, and placed at
its start time.

Engines:
  festival  offline, apt packages: festival festvox-us2 (MBROLA us2, male).
            Default; works without any model download.
  kokoro    Kokoro-82M (ONNX), far more natural. pip install kokoro-onnx soundfile;
            --models must hold kokoro-v1.0.onnx (or onnx/model.onnx) and
            voices-v1.0.bin or a voices/ folder of per-voice .bin files
            (onnx-community/Kokoro-82M-v1.0-ONNX on Hugging Face).
Needs ffmpeg on PATH.
"""
import argparse
import glob
import os
import subprocess
import tempfile

import numpy as np

SR = 24000
MAX_TEMPO = 1.45  # faster than this starts to sound rushed

ap = argparse.ArgumentParser()
ap.add_argument("cues")
ap.add_argument("video")
ap.add_argument("out")
ap.add_argument("--engine", choices=["festival", "kokoro"], default="festival")
ap.add_argument("--voice", help="festival: us2_mbrola (default) · kokoro: am_michael (default)")
ap.add_argument("--models", help="kokoro model folder")
ap.add_argument("--audio-out", help="also write the narration alone to this file (.mp3/.wav)")
args = ap.parse_args()
tmp = tempfile.mkdtemp()


def ffmpeg(*a):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *a], check=True)


def read_wav(path):
    """Decode any audio file to mono float32 at SR."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()


if args.engine == "kokoro":
    import soundfile as sf
    from kokoro_onnx import Kokoro

    voice = args.voice or "am_michael"
    model = os.path.join(args.models, "kokoro-v1.0.onnx")
    if not os.path.exists(model):
        model = os.path.join(args.models, "onnx", "model.onnx")
    voices = os.path.join(args.models, "voices-v1.0.bin")
    if not os.path.exists(voices):
        # pack per-voice raw float32 files (510 x 1 x 256) into the npz kokoro-onnx expects
        packed = {os.path.basename(f)[:-4]: np.fromfile(f, np.float32).reshape(-1, 1, 256)
                  for f in glob.glob(os.path.join(args.models, "voices", "*.bin"))}
        voices = os.path.join(tmp, "voices.npz")
        np.savez(voices, **packed)
    tts = Kokoro(model, voices)

    def speak(text):
        audio, sr = tts.create(text, voice=voice)
        path = os.path.join(tmp, "k.wav")
        sf.write(path, audio, sr)
        return read_wav(path)
else:
    voice = args.voice or "us2_mbrola"

    def speak(text):
        path = os.path.join(tmp, "f.wav")
        subprocess.run(["text2wave", "-eval", f"(voice_{voice})", "-o", path],
                       input=text.encode(), check=True)
        return read_wav(path)


def fit(audio, room):
    """Speed a line up (pitch kept) until it fits its slot, capped at MAX_TEMPO."""
    tempo = min(MAX_TEMPO, max(1.0, len(audio) / SR / room))
    if tempo <= 1.0:
        return audio, 1.0
    src, dst = os.path.join(tmp, "in.raw"), os.path.join(tmp, "fit.wav")
    np.asarray(audio, np.float32).tofile(src)
    ffmpeg("-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", src, "-af", f"atempo={tempo:.3f}", dst)
    return read_wav(dst), tempo


cues = []
for line in open(args.cues, encoding="utf-8"):
    if line.strip() and not line.startswith("#"):
        start, room, text = (p.strip() for p in line.split("|", 2))
        cues.append((float(start), float(room), text))

dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                     "-of", "csv=p=0", args.video]))
track = np.zeros(int(dur * SR) + 5 * SR, np.float32)
for start, room, text in cues:
    audio, tempo = fit(speak(text), room)
    i = int(start * SR)
    track[i:i + len(audio)] += audio
    print(f"{start:5.1f}s  {len(audio) / SR:4.1f}s/{room}s  x{tempo:.2f}  {text}")

track = track[: int(dur * SR)]
track *= 0.89 / max(1e-6, np.abs(track).max())
raw = os.path.join(tmp, "vo.raw")
track.tofile(raw)
voice_chain = "highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-1.5"
vo = os.path.join(tmp, "vo.wav")
ffmpeg("-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", raw, "-af", voice_chain, "-ar", "48000", vo)
if args.audio_out:
    ffmpeg("-i", vo, *(["-b:a", "192k"] if args.audio_out.endswith(".mp3") else []), args.audio_out)
ffmpeg("-i", args.video, "-i", vo, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
       "-shortest", "-movflags", "+faststart", args.out)
print("wrote", args.out)
