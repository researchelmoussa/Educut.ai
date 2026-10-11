"""Cut personas out of EduCut video frames into transparent PNGs.

Background removal = flood fill from the crop border over pixels close to the
frame's background colour, with colour un-mixing on antialiased edges, then
dropping stray fragments of neighbouring characters that touch the crop edge.

Usage (frames from the 36 s 16:9 intro film, 1920x1080):
    for t in 2 5.5 9.5 14 35.5; do
      ffmpeg -ss $t -i EduCut_36s_16x9_silent.mp4 -frames:v 1 frames/t$t.png
    done
    python3 scripts/extract-personas.py frames assets/brand/personas

Needs numpy, scipy and Pillow. The board that uses the cutouts is
assets/brand/persona-moodboard.html (rendered to persona-moodboard.png).
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

HI = sys.argv[1]
OUT = sys.argv[2]

LIME = np.array([0xA6, 0xED, 0x2F], float)
PAPER = np.array([0xF4, 0xF4, 0xEF], float)

# name: (frame, box, background colour)
JOBS = {
    # finale line-up (lime background, same scale + waving pose)
    "p01-lead": ("t35.5.png", (815, 640, 1085, 1050), LIME),
    "p02-manager": ("t35.5.png", (380, 680, 624, 1050), LIME),
    "p03-graduate": ("t35.5.png", (612, 640, 858, 1050), LIME),
    "p04-professional": ("t35.5.png", (1040, 680, 1262, 1062), LIME),
    "p05-learner": ("t35.5.png", (1262, 670, 1500, 1050), LIME),
    # states and scenes (paper background)
    "p01-lead-overwhelmed": ("t2.png", (670, 360, 1290, 1010), PAPER),
    "p01-lead-path": ("t5.5.png", (90, 500, 1830, 910), PAPER),
    "p02-manager-scene": ("t14.png", (50, 290, 630, 780), PAPER),
    "p03-graduate-scene": ("t14.png", (660, 380, 1260, 780), PAPER),
    "p04-professional-neutral": ("t9.5.png", (1460, 400, 1900, 780), PAPER),
    "p04-professional-empowered": ("t14.png", (1410, 370, 1900, 790), PAPER),
    # props
    "prop-ai-hall": ("t9.5.png", (975, 455, 1250, 770), PAPER),
}

TOL = 150.0  # distance at which a pixel is considered fully foreground


def cut(frame, box, bg, lineup, keep=None):
    rgb = np.asarray(Image.open(f"{HI}/{frame}").convert("RGB").crop(box), float)
    dist = np.linalg.norm(rgb - bg, axis=2)
    near = dist < TOL
    lab, _ = ndimage.label(near)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border > 0]
    region = np.isin(lab, border)
    # enclosed background pockets (e.g. between an arm and the body)
    idx = range(1, lab.max() + 1)
    share = ndimage.mean((dist < 15).astype(float), lab, idx)
    pockets = [i + 1 for i, f in enumerate(share) if f > 0.4]
    region |= np.isin(lab, pockets)
    if keep:  # lime detail that must not be keyed out (graduate's tassel)
        x0, y0, x1, y1 = keep
        region[y0 - box[1]:y1 - box[1], x0 - box[0]:x1 - box[0]] = False
    a = np.ones(dist.shape)
    a[region] = np.clip(dist[region] / TOL, 0, 1)
    # un-mix background out of semi-transparent edge pixels
    safe = np.maximum(a, 1e-3)[..., None]
    col = np.clip((rgb - bg * (1 - a[..., None])) / safe, 0, 255)
    # drop fragments that touch the left/right crop edge (neighbours' hands)
    solid, n = ndimage.label(a > 0.5)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(a), solid, range(1, n + 1))
        main = 1 + int(np.argmax(sizes))
        edge = set(np.unique(np.concatenate([solid[:, 0], solid[:, -1]]))) - {0}
        for k in edge:
            if k != main:
                comp = ndimage.binary_dilation(solid == k, iterations=3)
                a[comp] = 0
    if lineup:  # keep only the figure itself, no faint specks
        solid, n = ndimage.label(a > 0.02)
        idx = range(1, n + 1)
        sizes = ndimage.sum(np.ones_like(a), solid, idx)
        peak = ndimage.maximum(a, solid, idx)
        for k, (sz, pk) in enumerate(zip(sizes, peak), 1):
            if sz < 0.01 * sizes.max() or pk < 0.9:
                a[ndimage.binary_dilation(solid == k, iterations=3)] = 0
    out = np.dstack([col, a * 255]).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    bb = img.getbbox()
    return img.crop(bb), (box[0] + bb[0], box[1] + bb[1])


KEEP = {"p03-graduate": (804, 745, 824, 775)}

for name, (frame, box, bg) in JOBS.items():
    im, at = cut(frame, box, bg, bg is LIME, KEEP.get(name))
    im.save(f"{OUT}/{name}.png", optimize=True)
    print(name, "size", im.size, "at", at)  # position in the source frame
