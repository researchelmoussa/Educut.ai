"""Original background score + sound effects for the EduCut Connect film.

Synthesised from scratch (no samples, no licences): 120 BPM, C major,
I-V-vi-IV. The arrangement follows the film's beats (curious -> crowded ->
doubt -> reveal -> full groove -> finale) and the sound effects sit on the
animation cues in index.html. Writes music.wav (44.1 kHz stereo).

    python3 music.py
"""
import wave
import numpy as np

SR = 44100
DUR = 64.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N)
R = np.zeros(N)

BEAT = 0.5          # 120 BPM
BAR = 4 * BEAT


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def put(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 - pan))
    R[i:i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 + pan))


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def tt(d):
    return np.arange(int(d * SR)) / SR


# ---------- instruments ----------
def pad(notes, d, bright=6):
    t = tt(d)
    s = np.zeros_like(t)
    for n in notes:
        for det in (-0.08, 0.0, 0.08):
            f = hz(n + det)
            for k in range(1, bright + 1):
                s += np.sin(2 * np.pi * f * k * t + k) / k
    env = np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.5)
    return s * env / (len(notes) * 9)


def pluck(n, d=0.6, decay=7.0):
    t = tt(d)
    f = hz(n)
    s = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * decay * k) / k for k in range(1, 5))
    return s * np.minimum(1, t / 0.004)


def bell(n, d=1.6):
    t = tt(d)
    f = hz(n)
    s = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)
    return s * np.exp(-t * 3.2) * np.minimum(1, t / 0.003)


def bass(n, d):
    t = tt(d)
    f = hz(n)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    return np.tanh(1.4 * s) * np.minimum(1, t / 0.01) * np.exp(-t * 2.2)


def kick():
    t = tt(0.32)
    f = 45 + 85 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def clap():
    s = fft_filter(rng.standard_normal(int(0.2 * SR)), lo=900, hi=5000)
    t = tt(0.2)
    return s * np.exp(-t * 22) * 0.6


def hat():
    s = fft_filter(rng.standard_normal(int(0.06 * SR)), lo=7000)
    return s * np.exp(-tt(0.06) * 70) * 0.5


def whoosh(d=0.9):
    x = rng.standard_normal(int(d * SR))
    t = tt(d)
    env = np.sin(np.pi * t / d) ** 2
    return fft_filter(x, lo=500, hi=4000) * env


def riser(d=1.2):
    t = tt(d)
    noise = fft_filter(rng.standard_normal(len(t)), lo=1500, hi=7000) * (t / d) ** 2
    f = 220 * 2 ** (2 * t / d)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / d) ** 2 * 0.3
    return noise + tone


def impact():
    t = tt(1.6)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-t * 8)) / SR) * np.exp(-t * 2.5)
    air = fft_filter(rng.standard_normal(len(t)), lo=2000) * np.exp(-t * 4) * 0.25
    return boom + air


def tok(n=79):
    t = tt(0.09)
    return np.sin(2 * np.pi * hz(n) * t * (1 + 0.6 * np.exp(-t * 60))) * np.exp(-t * 55)


# ---------- harmony ----------
C, G, Am, F = [48, 52, 55], [43, 50, 55], [45, 48, 52], [41, 45, 48]
PROG = [C, G, Am, F]
TENSE = [Am, F, C, G]


def chord_at(bar, prog):
    return prog[bar % 4]


def section(t):
    if t < 6.5: return 'intro'
    if t < 15: return 'crowd'
    if t < 23.5: return 'doubt'
    if t < 52: return 'groove'
    if t < 61: return 'finale'
    return 'outro'


# pads + arps + bass + drums, bar by bar
for b in range(int(DUR / BAR)):
    t0 = b * BAR
    sec = section(t0 + 0.01)
    prog = TENSE if sec in ('crowd', 'doubt') else PROG
    ch = chord_at(b, prog)
    root = ch[0] - 12
    if sec == 'outro':
        put(pad([n + 12 for n in C], 3.0, 8), t0, 0.5)
        put(bell(72), t0, 0.25, -0.2); put(bell(76), t0 + 0.08, 0.2, 0.2); put(bell(79), t0 + 0.16, 0.2)
        break
    put(pad([n + 12 for n in ch], BAR + 0.4, 4 if sec == 'doubt' else 7), t0, 0.33 if sec != 'doubt' else 0.26)
    arp = [ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[1] + 24]
    step = BEAT if sec in ('intro', 'doubt') else BEAT / 2
    k = 0
    tt0 = t0
    while tt0 < t0 + BAR - 1e-6:
        n = arp[k % 4] + (12 if sec == 'finale' and k % 8 == 7 else 0)
        put(pluck(n, decay=5 if sec == 'doubt' else 7), tt0, 0.16 if sec != 'doubt' else 0.12, -0.3 if k % 2 else 0.3)
        tt0 += step; k += 1
    if sec in ('crowd', 'groove', 'finale'):
        for q in range(4):
            put(bass(root, BEAT * 0.95), t0 + q * BEAT, 0.22 if sec == 'crowd' else 0.3)
    if sec in ('crowd', 'groove', 'finale'):
        for e in range(8):
            put(hat(), t0 + e * BEAT / 2 + (0.0 if e % 2 == 0 else 0.01), 0.10 if e % 2 else 0.06, 0.4)
    # the upskill beat (42.5-46.7) thins out to hats + pad, then the cape lands
    full = sec == 'finale' or (sec == 'groove' and not (42.5 <= t0 < 46.5))
    if full and t0 >= 24.0:
        for q in range(4):
            put(kick(), t0 + q * BEAT, 0.55)
        put(clap(), t0 + BEAT, 0.28, -0.1); put(clap(), t0 + 3 * BEAT, 0.28, 0.1)

# finale lead: the I-V-vi-IV melody an octave up
mel = [76, 74, 72, 74, 76, 79, 77, 76]
for i, n in enumerate(mel * 2):
    tm = 52.0 + i * BEAT * 2
    if tm < 61:
        put(bell(n, 1.2), tm, 0.12, 0.15)

# ---------- sound effects on the animation cues ----------
for cut in (6.5, 15.0, 31.0, 42.5):
    put(whoosh(0.8), cut - 0.5, 0.10, 0.0)
# pills landing on the Lead (S2): drop starts at 7.3 + i*0.28, lands at 75% of 0.75 s
for i in range(14):
    put(tok(76 + (i * 5) % 12), 7.3 + i * 0.28 + 0.56, 0.10, ((i % 5) - 2) / 3)
# tabs counter ticking (S2)
for j in range(10):
    put(tok(91), 7.6 + j * 0.45, 0.035, 0.5)
# requirement rows, checks and question marks (S3)
for j, n in enumerate((84, 84, 77, 77)):
    put(tok(n), 16.6 + 0.5 + j * 0.3, 0.06)
# reveal: riser, impact as the pills fall and the logo pops
put(riser(1.3), 22.7, 0.11)
put(impact(), 24.0, 0.42)
put(bell(84), 24.9, 0.16, -0.2); put(bell(88), 25.0, 0.13, 0.2); put(bell(91), 25.1, 0.11)
# three-up cells pop in (S5) and the checklist strip
for j in range(3):
    put(tok(79 + j * 4), 32.0 + j * 0.8, 0.07)
for j in range(3):
    put(bell(84 + j * 2, 0.8), 37.2 + j * 0.4, 0.06)
# upskill: course chip slides in, gaps tick to green, the cape and sparkles
put(whoosh(0.6), 44.8, 0.08, 0.3)
put(bell(86, 1.0), 46.1, 0.12); put(bell(91, 1.0), 46.35, 0.12)
put(riser(0.5), 46.2, 0.07)
for j, n in enumerate((96, 100, 103, 108)):
    put(bell(n, 0.8), 46.9 + j * 0.2, 0.05, (-1) ** j * 0.4)
# finale wipe and the three words
put(whoosh(0.9), 51.6, 0.14)
put(impact(), 52.0, 0.25)
for j in range(3):
    put(kick(), 52.6 + j * 0.25, 0.3)
# CTA swap
put(whoosh(0.7), 57.1, 0.08)

# ---------- master ----------
mix = np.stack([L, R], 1)
fade = np.ones(N)
fo = int(2.5 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
fade[: int(0.3 * SR)] = np.linspace(0, 1, int(0.3 * SR))
mix *= fade[:, None]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix /= max(1e-9, np.abs(mix).max()) / 0.89
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote music.wav')
