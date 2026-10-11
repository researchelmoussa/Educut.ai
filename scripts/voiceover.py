"""Generate a voice-over from a cue sheet and mix it onto a silent film.

    python3 scripts/voiceover.py assets/brand/videos/ai-eligibility.vo.txt \
        assets/video/educut-ai-eligibility-30s.mp4 out.mp4 [--engine festival|kokoro]

Cue sheet lines: "start-seconds | max-seconds | text". Each line is spoken,
sped up just enough (pitch kept) to fit its max-seconds slot, and placed at
its start time.

Or pass --take with one exported take of all lines (e.g. from ElevenLabs);
it is cut at its pauses and each line is placed on its cue.

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
TAKE_TEMPO = 1.25  # natural voices tolerate less speed-up
INNER_PAUSE = 20   # frames (200 ms): longest pause kept inside a line of a take

ap = argparse.ArgumentParser()
ap.add_argument("cues")
ap.add_argument("video")
ap.add_argument("out")
ap.add_argument("--engine", choices=["festival", "kokoro"], default="festival")
ap.add_argument("--voice", help="festival: us2_mbrola (default) · kokoro: am_michael (default)")
ap.add_argument("--models", help="kokoro model folder")
ap.add_argument("--audio-out", help="also write the narration alone to this file (.mp3/.wav)")
ap.add_argument("--take", help="one recorded/exported take of all lines in cue order (e.g. ElevenLabs MP3); "
                               "it is cut at its longest pauses instead of synthesising")
args = ap.parse_args()
tmp = tempfile.mkdtemp()


def ffmpeg(*a):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *a], check=True)


def read_wav(path):
    """Decode any audio file to mono float32 at SR."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def split_take(path, texts):
    """Cut one take into its lines.

    Narration engines do not always honour pause lengths, so a pause between
    lines can be shorter than one inside a line. Cut points are chosen among
    all pauses so each segment's length best matches its share of the text,
    with a bonus for longer pauses. Pauses inside a line are shortened to
    INNER_PAUSE and silence around each line is trimmed.
    """
    audio = read_wav(path)
    hop = SR // 100  # 10 ms frames
    rms = np.sqrt(np.convolve(audio ** 2, np.ones(hop) / hop, "same")[::hop])
    quiet = rms < rms.max() * 10 ** (-38 / 20)
    runs, i = [], 0
    while i < len(quiet):  # (start, end) of every quiet run, in frames
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if i > 0 and j < len(quiet) and j - i >= 12:  # >= 120 ms counts as a pause
                runs.append((i, j))
            i = j
        else:
            i += 1
    n = len(texts)
    if len(runs) < n - 1:
        raise SystemExit(f"take has only {len(runs) + 1} pause-separated parts, cue sheet has {n} lines")
    voiced = np.flatnonzero(~quiet)
    first, last = voiced[0], voiced[-1] + 1
    chars = np.array([len(t) for t in texts], float)
    expect = (last - first) * chars / chars.sum()  # frames each line should take

    # dynamic programme over (line k ends at pause p)
    mids = [(a + b) / 2 for a, b in runs]
    longest = max(b - a for a, b in runs)
    INF = float("inf")
    best = [[INF] * len(runs) for _ in range(n - 1)]
    back = [[-1] * len(runs) for _ in range(n - 1)]
    def cost(k, seg, p):
        return np.log(max(seg, 1) / expect[k]) ** 2 - 0.5 * (runs[p][1] - runs[p][0]) / longest
    for p in range(len(runs)):
        best[0][p] = cost(0, mids[p] - first, p)
    for k in range(1, n - 1):
        for p in range(k, len(runs)):
            for q in range(k - 1, p):
                c = best[k - 1][q] + cost(k, mids[p] - mids[q], p)
                if c < best[k][p]:
                    best[k][p], back[k][p] = c, q
    end = min(range(n - 2, len(runs)),
              key=lambda p: best[n - 2][p] + np.log(max(last - mids[p], 1) / expect[n - 1]) ** 2)
    picks = [end]
    for k in range(n - 2, 0, -1):
        picks.append(back[k][picks[-1]])
    picks = picks[::-1]

    bounds = [0] + [int(mids[p]) for p in picks] + [len(quiet)]
    lines = []
    for a, b in zip(bounds, bounds[1:]):
        loud = np.flatnonzero(~quiet[a:b])
        lo, hi = a + loud[0], a + loud[-1] + 1
        keep = np.ones(len(quiet), bool)
        for ra, rb in runs:  # shorten pauses inside the line
            if lo < ra and rb < hi and rb - ra > INNER_PAUSE:
                keep[ra + INNER_PAUSE // 2: rb - INNER_PAUSE // 2] = False
        frames = [f for f in range(max(0, lo - 3), min(len(quiet), hi + 3)) if keep[f]]
        lines.append(np.concatenate([audio[f * hop:(f + 1) * hop] for f in frames]))
    return lines


if args.take:
    pass
elif args.engine == "kokoro":
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
    """Speed a line up (pitch kept) until it fits its slot, capped at MAX_TEMPO / TAKE_TEMPO."""
    tempo = min(TAKE_TEMPO if args.take else MAX_TEMPO, max(1.0, len(audio) / SR / room))
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
track = np.zeros(int(dur * SR) + 10 * SR, np.float32)
taken = split_take(args.take, [c[2] for c in cues]) if args.take else None
free = 0.0  # a line that overruns its slot pushes the next one back
for k, (start, room, text) in enumerate(cues):
    audio, tempo = fit(taken[k] if taken else speak(text), room)
    start = max(start, free)
    i = int(start * SR)
    track[i:i + len(audio)] += audio
    free = start + len(audio) / SR + 0.15
    print(f"{start:5.2f}s  {len(audio) / SR:4.1f}s/{room}s  x{tempo:.2f}  {text}")

hold = max(0.0, free + 0.35 - dur)  # hold the last frame if the narration runs past the film
if hold:
    print(f"narration runs past the film: holding the last frame {hold:.2f}s longer")
track = track[: int((dur + hold) * SR)]
track *= 0.89 / max(1e-6, np.abs(track).max())
raw = os.path.join(tmp, "vo.raw")
track.tofile(raw)
voice_chain = "highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-1.5"
vo = os.path.join(tmp, "vo.wav")
ffmpeg("-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", raw, "-af", voice_chain, "-ar", "48000", vo)
if args.audio_out:
    ffmpeg("-i", vo, *(["-b:a", "192k"] if args.audio_out.endswith(".mp3") else []), args.audio_out)
video = ["-c:v", "copy"] if not hold else [
    "-vf", f"tpad=stop_mode=clone:stop_duration={hold:.2f}", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p"]
ffmpeg("-i", args.video, "-i", vo, "-map", "0:v", "-map", "1:a", *video, "-c:a", "aac", "-b:a", "192k",
       "-shortest", "-movflags", "+faststart", args.out)
print("wrote", args.out)
