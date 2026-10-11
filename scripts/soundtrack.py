"""Compose a music bed and sound effects for an EduCut film and mix them under the voice.

    python3 scripts/soundtrack.py VOICED.mp4 assets/brand/videos/ai-eligibility.sfx.txt OUT.mp4

VOICED.mp4 is the film with its narration (from voiceover.py). The music is
synthesised here (no samples): a calm A-minor pad with plucks for the case
and the questions, a low drone for the dark scene, then a C-major groove for
the end card. Effects come from the cue file. The music ducks under the
voice; the result is loudness-normalised to -16 LUFS.

Needs numpy and ffmpeg.
"""
import os
import subprocess
import sys
import tempfile

import numpy as np

SR = 48000
rng = np.random.default_rng(7)
video, cue_file, out = sys.argv[1:4]
dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                     "-of", "csv=p=0", video]))
N = int(dur * SR)
tmp = tempfile.mkdtemp()


def t(seconds):
    return np.arange(int(seconds * SR)) / SR


def note(name):
    """'A3' -> Hz"""
    steps = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}[name[0]]
    return 440 * 2 ** ((steps + 12 * (int(name[-1]) - 4)) / 12)


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be an array (sweeps)."""
    a = np.exp(-2 * np.pi * np.broadcast_to(cutoff, x.shape) / SR)
    y, acc = np.empty_like(x), 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def add(track, at, sig, gain=1.0):
    i = int(at * SR)
    if i >= len(track):
        return
    sig = sig[: len(track) - i]
    track[i:i + len(sig)] += gain * sig


# ---------------------------------------------------------------- instruments
def pad(freqs, length, attack=0.8, release=1.2):
    x = t(length)
    sig = sum(np.sin(2 * np.pi * f * d * x) * w
              for f in freqs for d, w in ((1, .5), (1.003, .35), (0.997, .35), (2, .12), (3, .04)))
    env = np.minimum(1, x / attack) * np.minimum(1, (length - x) / release).clip(0)
    return sig * env * (1 + .08 * np.sin(2 * np.pi * .25 * x)) / len(freqs)


def pluck(f, length=0.9):
    x = t(length)
    return (np.sin(2 * np.pi * f * x) + .35 * np.sin(4 * np.pi * f * x) + .12 * np.sin(6 * np.pi * f * x)) \
        * np.exp(-x * 5) * np.minimum(1, x / .004)


def kick():
    x = t(.35)
    return np.sin(2 * np.pi * np.cumsum(45 + 90 * np.exp(-x * 30)) / SR) * np.exp(-x * 9)


def hat():
    x = t(.06)
    return np.diff(rng.standard_normal(len(x) + 1)) * np.exp(-x * 70) * .25


def clap():
    x = t(.18)
    n = rng.standard_normal(len(x))
    return (n - lowpass(n, 900)) * np.exp(-x * 22) * .5


# ---------------------------------------------------------------- music
music = np.zeros(N + SR * 4)
beat = 60 / 96
minor = [["A2", "C3", "E3"], ["F2", "A2", "C3"], ["C3", "E3", "G3"], ["G2", "B2", "D3"]]
major = [["C3", "E3", "G3"], ["G2", "B2", "D3"], ["A2", "C3", "E3"], ["F2", "A2", "C3"]]
bar = 4 * beat

# calm section: case, accountability (0 - 15 s) and the three questions (18 - 34.5 s)
for start, end, busy in ((0, 15, False), (18, 34.5, True)):
    k, at = 0, start
    while at < end:
        ch = minor[k % 4]
        add(music, at, pad([note(n) for n in ch], bar + 1.2), .5)
        for s in range(8):  # gentle arpeggio, quieter in the opening
            add(music, at + s * beat / 2, pluck(2 * note(ch[s % 3])), .10 if busy else .06)
        if busy:
            for b in range(4):
                add(music, at + b * beat, kick(), .35)
                add(music, at + b * beat + beat / 2, hat(), .5)
        k, at = k + 1, at + bar

# dark scene (15 - 18 s): low drone
add(music, 14.9, pad([note("A1"), note("E2")], 3.4, attack=.3, release=.8), .9)

# human review (34.5 - 38.5 s): lift to major, no drums
for k in range(2):
    ch = major[k]
    add(music, 34.5 + k * 2, pad([note(n) for n in ch], 2.6, attack=.3), .55)
    for s in range(8):
        add(music, 34.5 + k * 2 + s * .25, pluck(2 * note(ch[s % 3])), .09)

# end card (38.5 s -> end): upbeat major groove
at, k = 38.5, 0
while at < dur:
    ch = major[k % 4]
    add(music, at, pad([note(n) for n in ch], bar + .6, attack=.05, release=.6), .55)
    for b in range(4):
        add(music, at + b * beat, kick(), .55)
        add(music, at + b * beat + beat / 2, hat(), .7)
        if b % 2:
            add(music, at + b * beat, clap(), .6)
    for s in range(8):
        add(music, at + s * beat / 2, pluck(4 * note(ch[(s * 2) % 3])), .12)
    at, k = at + bar, k + 1

music = music[:N]
fade = int(.8 * SR)
music[-fade:] *= np.linspace(1, 0, fade)
music[:int(.4 * SR)] *= np.linspace(0, 1, int(.4 * SR))


# ---------------------------------------------------------------- effects
def sfx(name, p=1.0):
    if name == "pop":
        x = t(.09)
        return np.sin(2 * np.pi * np.cumsum(520 * p + 500 * p * x / .09) / SR) * np.exp(-x * 45) * .6
    if name == "tick":
        x = t(.03)
        return np.sin(2 * np.pi * 2200 * p * x) * np.exp(-x * 160) * .35
    if name == "whoosh":
        x = t(.55)
        n = rng.standard_normal(len(x))
        sweep = 300 + 5000 * np.sin(np.pi * x / .55) ** 2
        return lowpass(n, sweep) * np.sin(np.pi * x / .55) ** 2 * .9
    if name == "stamp":
        x = t(.35)
        thump = np.sin(2 * np.pi * np.cumsum(50 + 70 * np.exp(-x * 25)) / SR) * np.exp(-x * 12)
        slap = lowpass(rng.standard_normal(len(x)), 2500) * np.exp(-x * 40)
        return thump + .8 * slap
    if name == "sad":
        x = t(.45)
        return np.concatenate([np.sin(2 * np.pi * 392 * x) * np.exp(-x * 5),
                               np.sin(2 * np.pi * 311 * t(.7)) * np.exp(-t(.7) * 4)]) * .3
    if name in ("chime", "ding"):
        x = t(1.4)
        f = (784 if name == "chime" else 1568) * p
        return sum(np.sin(2 * np.pi * f * m * x) * w for m, w in ((1, 1), (2.76, .35), (5.4, .12))) \
            * np.exp(-x * (3 if name == "chime" else 5)) * .35
    if name == "boom":
        x = t(1.6)
        return (np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-x * 6)) / SR)
                + .3 * lowpass(rng.standard_normal(len(x)), 400)) * np.exp(-x * 2.2)
    if name == "riser":
        x = t(.8)
        return lowpass(rng.standard_normal(len(x)), 200 + 6000 * (x / .8) ** 2) * (x / .8) ** 2 * .7
    raise SystemExit(f"unknown sound {name}")


effects = np.zeros(N + SR * 2)
for line in open(cue_file, encoding="utf-8"):
    if line.strip() and not line.startswith("#"):
        parts = [p.strip() for p in line.split("|")]
        add(effects, float(parts[0]), sfx(parts[1], float(parts[2]) if len(parts) > 2 else 1.0))
effects = effects[:N]

# ---------------------------------------------------------------- mix
def write(path, x):
    x = (x / max(1e-9, np.abs(x).max()) * .9).astype(np.float32)
    x.tofile(path + ".raw")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1",
                    "-i", path + ".raw", path], check=True)


m, e = os.path.join(tmp, "music.wav"), os.path.join(tmp, "sfx.wav")
write(m, music)
write(e, effects)
graph = (
    "[0:a]aresample=48000,asplit=2[v][key];"
    "[1:a]volume=-4dB[mu];"
    "[mu][key]sidechaincompress=threshold=0.02:ratio=4:attack=30:release=350[duck];"
    "[2:a]volume=-3dB[fx];"
    "[v][duck][fx]amix=inputs=3:normalize=0,loudnorm=I=-16:TP=-1.5[a]"
)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", video, "-i", m, "-i", e, "-filter_complex", graph,
                "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart", out], check=True)
print("wrote", out)
