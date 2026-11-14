"""Builds the mannequin bodies from the MakeHuman base model (CC0 assets).

Needs a checkout of https://github.com/makehumancommunity/makehuman (only makehuman/data/3dobjs,
targets/macrodetails and rigs are used). Usage:

    python3 scripts/mannequin/mesh.py /path/to/makehuman/makehuman/data /path/to/output

Writes male.json and female.json: vertex positions in metres (feet on the ground, facing +z),
triangles, and the joint positions used for fitting clothes.
"""
import json, math, sys
from pathlib import Path
import numpy as np

DATA = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)


def load_obj(path):
    verts, faces, group = [], {}, None
    for line in open(path):
        if line.startswith('v '):
            verts.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('g '):
            group = line.split()[1]
        elif line.startswith('f '):
            idx = [int(p.split('/')[0]) - 1 for p in line.split()[1:]]
            faces.setdefault(group, []).append(idx)
    return np.array(verts), faces


def load_target(name):
    idx, d = [], []
    for line in open(DATA / 'targets' / 'macrodetails' / name):
        if line.startswith('#') or not line.strip():
            continue
        p = line.split()
        idx.append(int(p[0]))
        d.append([float(p[1]), float(p[2]), float(p[3])])
    return np.array(idx, dtype=int), np.array(d, dtype=float).reshape(-1, 3)


BASE, FACES = load_obj(DATA / '3dobjs' / 'base.obj')
SKEL = json.load(open(DATA / 'rigs' / 'default.mhskel'))
WEIGHTS = json.load(open(DATA / 'rigs' / 'default_weights.mhw'))['weights']


def bone_weight(names):
    w = np.zeros(len(BASE))
    for n in names:
        for i, v in WEIGHTS.get(n, []):
            w[i] += v
    return w


def joint(verts, name):
    return verts[SKEL['joints'][name]].mean(axis=0)


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def abstract_face(v, tris, head_w, sigma_deg):
    """Replaces the detailed face with a softly sculpted mannequin face: the outer shape of the face
    is measured from the centre of the head, blurred, and rebuilt as one clean surface."""
    from scipy import ndimage
    hv = v[head_w > 0.5]
    C = np.array([0.0, (hv[:, 1].max() + hv[:, 1].min()) / 2, (hv[:, 2].max() + hv[:, 2].min()) / 2 - 0.15])
    STEP = 1.5  # degrees per bin
    TH, PH = 115, 85

    def sph(p):
        d = p - C
        r = np.linalg.norm(d, axis=1)
        th = np.degrees(np.arctan2(d[:, 0], d[:, 2]))
        ph = np.degrees(np.arcsin(np.clip(d[:, 1] / np.maximum(r, 1e-9), -1, 1)))
        return r, th, ph

    def amount(th, ph):
        # angle away from "straight ahead"; the face is a cone around that direction
        d = np.stack([np.sin(np.radians(th)) * np.cos(np.radians(ph)), np.sin(np.radians(ph)), np.cos(np.radians(th)) * np.cos(np.radians(ph))], -1)
        F = np.array([0, 0.02, 1.0]); F /= np.linalg.norm(F)
        a = np.degrees(np.arccos(np.clip(d @ F, -1, 1)))
        t = np.clip((72 - a) / 18, 0, 1) * np.clip((ph + 60) / 14, 0, 1)  # stop above the neck
        return t * t * (3 - 2 * t)

    # outer shape: sample every head triangle densely, keep the largest radius per direction
    ht = tris[(head_w[tris] > 0.3).all(axis=1)]
    rng = np.random.default_rng(1)
    b = rng.random((len(ht), 40, 2))
    flip = b.sum(axis=2) > 1
    b[flip] = 1 - b[flip]
    pts = (v[ht[:, 0]][:, None] * (1 - b[..., 0:1] - b[..., 1:2]) + v[ht[:, 1]][:, None] * b[..., 0:1] + v[ht[:, 2]][:, None] * b[..., 1:2]).reshape(-1, 3)
    r, th, ph = sph(pts)
    nx, ny = int(2 * TH / STEP) + 1, int(2 * PH / STEP) + 1
    ix = np.round((th + TH) / STEP).astype(int)
    iy = np.round((ph + PH) / STEP).astype(int)
    ok = (ix >= 0) & (ix < nx) & (iy >= 0) & (iy < ny)
    hull = np.zeros((ny, nx))
    np.maximum.at(hull, (iy[ok], ix[ok]), r[ok])
    for _ in range(6):  # fill empty bins from their neighbours
        grown = ndimage.maximum_filter(hull, size=3)
        hull = np.where(hull > 0, hull, grown)
    soft = ndimage.gaussian_filter(hull, sigma_deg / STEP, mode='nearest')
    hull = ndimage.gaussian_filter(hull, 0.8, mode='nearest')

    def look(grid, th, ph):
        return ndimage.map_coordinates(grid, [(ph + PH) / STEP, (th + TH) / STEP], order=1, mode='nearest')

    # move the surrounding skin onto the new shape so the join is seamless
    r, th, ph = sph(v)
    a = amount(th, ph) * (head_w > 0.3)
    h = look(hull, th, ph)
    surface = r > 0.9 * h
    target = r + a * (look(soft, th, ph) - r)
    move = (a > 0) & surface
    v = v.copy()
    v[move] = C + (v[move] - C) * (target[move] / r[move])[:, None]

    # drop the old face (including the mouth and eye cavities) and add the clean one
    inside = (a[tris] > 0.55).all(axis=1) | ((a[tris] > 0.05).all(axis=1) & (~surface[tris]).any(axis=1))
    tris = tris[~inside]
    gth, gph = np.meshgrid(np.arange(-TH, TH + 0.01, STEP), np.arange(-PH, PH + 0.01, STEP))
    ga = amount(gth, gph)
    gh = look(hull, gth.ravel(), gph.ravel()).reshape(gth.shape)
    gr = gh + ga * (look(soft, gth.ravel(), gph.ravel()).reshape(gth.shape) - gh)
    d = np.stack([np.sin(np.radians(gth)) * np.cos(np.radians(gph)), np.sin(np.radians(gph)), np.cos(np.radians(gth)) * np.cos(np.radians(gph))], -1)
    P = C + d * gr[..., None]
    keep = ga > 0.3
    index = -np.ones(gth.shape, dtype=int)
    index[keep] = np.arange(keep.sum())
    quads = []
    for y in range(gth.shape[0] - 1):
        for x in range(gth.shape[1] - 1):
            i0, i1, i2, i3 = index[y, x], index[y, x + 1], index[y + 1, x + 1], index[y + 1, x]
            if min(i0, i1, i2, i3) >= 0:
                quads += [[i0, i1, i2], [i0, i2, i3]]
    return v, tris, P[keep], np.array(quads, dtype=int)


def chest_patches():
    """Which vertices form the finely modelled chest tips, found once on the base model."""
    v = BASE
    tris = np.array([[f[0], f[k], f[k + 1]] for f in FACES['body'] for k in range(1, len(f) - 1)])
    sh = joint(v, 'upperarm01.L____head')
    chest = (np.abs(v[:, 0]) < sh[0] * 0.95) & (v[:, 1] < sh[1] - 0.4) & (v[:, 1] > sh[1] - 3.6) & (v[:, 2] > 0.2)
    elen = np.full(len(v), np.inf)
    for i, j in ((0, 1), (1, 2), (2, 0)):
        l = np.linalg.norm(v[tris[:, i]] - v[tris[:, j]], axis=1)
        np.minimum.at(elen, tris[:, i], l)
        np.minimum.at(elen, tris[:, j], l)
    out = []
    for sign in (1, -1):
        cand = np.where(chest & (v[:, 0] * sign > 0))[0]
        t = cand[np.argmin(elen[cand])]
        d = np.linalg.norm(v - v[t], axis=1)
        # centre the patch on the middle of the dense detail
        dense = np.where((d < 0.3) & (elen < np.median(elen[cand]) * 0.5))[0]
        centre = v[dense].mean(axis=0)
        d = np.linalg.norm(v - centre, axis=1)
        out.append((int(t), d < 0.42, (d > 0.42) & (d < 0.9) & chest))
    return out


PATCHES = chest_patches()


def plain_chest(v, tris):
    """Cut each chest-tip patch out and close it with a plain cap that follows the skin around it,
    as on a shop mannequin."""
    v = v.copy()
    for t, core, ring in PATCHES:
        _, _, vt = np.linalg.svd(v[ring] - v[ring].mean(axis=0))
        U, V, N = vt[0], vt[1], vt[2]
        if N[2] < 0:
            N = -N
        cut = core[tris].any(axis=1)
        kept = tris[~cut]
        kept_edges = set()
        for a, b, c in kept:
            kept_edges.update(((a, b), (b, c), (c, a)))
        cap = []
        for a, b, c in tris[cut]:
            for e in ((a, b), (b, c), (c, a)):
                if (e[1], e[0]) in kept_edges:  # this edge borders the skin we keep
                    cap.append([e[0], e[1], t])
        rim = np.unique(np.array(cap)[:, :2])
        # centre of the cap: continue the gentle dome of the skin just outside the detail
        m0 = v[rim].mean(axis=0)
        rad = lambda p: np.linalg.norm((p - m0) - np.outer((p - m0) @ N, N), axis=1)
        a_rim = rad(v[rim]).mean()
        outer = np.where(core)[0]
        r_o = rad(v[outer])
        ok = (r_o < a_rim * 0.92) & (r_o > a_rim * 0.6)
        H = np.median(((v[outer] - m0) @ N)[ok] / (1 - (r_o[ok] / a_rim) ** 2)) if ok.sum() > 3 else 0.0
        v[t] = m0 + 0.35 * max(0.0, H) * N
        tris = np.vstack([kept, np.array(cap)])
    return v, tris


def build(gender, recipe, height, arm_down_deg, face_smooth, leg_out_deg=1.0):
    v = BASE.copy()
    for name, w in recipe.items():
        idx, d = load_target(name + '.target')
        v[idx] += w * d

    # --- pose: bring the arms down from the modelling pose ---
    for side, sign in (('L', 1), ('R', -1)):
        chain = [f'upperarm01.{side}', f'upperarm02.{side}', f'lowerarm01.{side}', f'lowerarm02.{side}', f'wrist.{side}']
        chain += [n for n in WEIGHTS if n.endswith('.' + side) and (n.startswith('finger') or n.startswith('metacarpal'))]
        w = bone_weight(chain) + 0.35 * bone_weight([f'shoulder01.{side}'])
        w = np.clip(w, 0, 1)[:, None]
        J = joint(v, f'upperarm01.{side}____head')
        elbow = joint(v, f'lowerarm01.{side}____head')
        cur = math.degrees(math.atan2(abs(elbow[0] - J[0]), J[1] - elbow[1]))  # angle from straight down
        a = math.radians(cur - arm_down_deg) * (-sign)
        R = rot_z(a)
        v = v + w * ((v - J) @ R.T + J - v)

    # --- pose: stand with the legs closer together ---
    for side, sign in (('L', 1), ('R', -1)):
        chain = [f'upperleg01.{side}', f'upperleg02.{side}', f'lowerleg01.{side}', f'lowerleg02.{side}', f'foot.{side}']
        chain += [n for n in WEIGHTS if n.endswith('.' + side) and n.startswith('toe')]
        w = np.clip(bone_weight(chain), 0, 1)[:, None]
        J = joint(v, f'upperleg01.{side}____head')
        ankle = joint(v, f'foot.{side}____head')
        cur = math.degrees(math.atan2(abs(ankle[0] - J[0]), J[1] - ankle[1]))
        a = math.radians(cur - leg_out_deg) * (-sign)
        v = v + w * ((v - J) @ rot_z(a).T + J - v)

    # --- faces of the body only ---
    tris = []
    for f in FACES['body']:
        for k in range(1, len(f) - 1):
            tris.append([f[0], f[k], f[k + 1]])
    tris = np.array(tris)
    used = np.unique(tris)

    v, tris = plain_chest(v, tris)
    used = np.unique(tris)
    nbr = [[] for _ in range(len(v))]
    for a_, b_, c_ in tris:
        nbr[a_] += [b_, c_]; nbr[b_] += [a_, c_]; nbr[c_] += [a_, b_]

    def melt(amount, rounds):
        nonlocal v
        sel = [i for i in used if amount[i] > 0.02]
        for _ in range(rounds):
            nv = v.copy()
            for i in sel:
                nv[i] = v[i] + 0.5 * amount[i] * (v[nbr[i]].mean(axis=0) - v[i])
            v = nv

    # --- mannequin finish: an abstract face, and smooth chest and hips (no anatomical detail) ---
    hc = joint(v, 'head____head')
    face_bones = [n for n in WEIGHTS if n in ('head', 'jaw') or n[:4] in ('leva', 'ocul', 'orbi', 'oris', 'riso', 'spec', 'tong', 'eye.')]
    extra_pos, extra_tri = np.zeros((0, 3)), np.zeros((0, 3), dtype=int)
    if face_smooth:
        v, tris, extra_pos, extra_tri = abstract_face(v, tris, np.clip(bone_weight(face_bones), 0, 1), face_smooth)
        used = np.unique(tris)
    # chest: melt small detail into a smooth mannequin chest (the overall shape stays)
    sh = joint(v, 'upperarm01.L____head')
    chest = (np.abs(v[:, 0]) < sh[0] * 0.95) & (v[:, 1] < sh[1] - 0.4) & (v[:, 1] > sh[1] - 3.6) & (v[:, 2] > 0.2)
    melt(chest.astype(float), 10)
    for t_, _, _ in PATCHES:  # blend each cap into the chest
        melt(np.clip(1.7 * np.exp(-((np.linalg.norm(v - v[t_], axis=1) / 0.62) ** 2)), 0, 1), 60)
    melt(np.clip(bone_weight(['breast.L', 'breast.R']) * 2.0, 0, 1), 6)
    hip = joint(v, 'upperleg01.L____head')
    groin = np.exp(-((v[:, 0] / 0.75) ** 2)) * np.exp(-(((v[:, 1] - (hip[1] - 0.75)) / 0.85) ** 2))
    melt(np.clip(groin * 1.3, 0, 1), 18)
    navel = np.exp(-((v[:, 0] / 0.35) ** 2)) * np.exp(-(((v[:, 1] - (hip[1] + 1.0)) / 0.5) ** 2)) * (v[:, 2] > 0)
    melt(np.clip(navel, 0, 1), 8)
    melt(np.full(len(v), 0.35) * (1 - np.clip(bone_weight(face_bones), 0, 1)), 2)

    # --- metres, feet on the ground, centred ---
    body = v[used]
    ground = body[:, 1].min()
    scale = height / (body[:, 1].max() - ground)
    cx = (body[:, 0].max() + body[:, 0].min()) / 2

    def norm(p):
        return [(p[0] - cx) * scale, (p[1] - ground) * scale, p[2] * scale]

    remap = {int(i): k for k, i in enumerate(used)}
    pos = np.array([norm(p) for p in body] + [norm(p) for p in extra_pos])
    tri = [[remap[int(a)], remap[int(b)], remap[int(c)]] for a, b, c in tris] + (extra_tri + len(body)).tolist()
    J = {}
    for key, bone in dict(shoulder='upperarm01.L____head', elbow='lowerarm01.L____head', wrist='wrist.L____head', hip='upperleg01.L____head',
                          knee='lowerleg01.L____head', ankle='foot.L____head', neck='neck01____head', head='head____head').items():
        p = norm(joint(v, bone))
        J[key] = [round(abs(p[0]), 4), round(p[1], 4), round(p[2], 4)]
    out = {'positions': np.round(pos, 5).ravel().tolist(), 'indices': np.array(tri).ravel().tolist(), 'joints': J, 'height': height}
    (OUT / f'{gender}.json').write_text(json.dumps(out))
    from collections import Counter
    ec = Counter()
    for a_, b_, c_ in tris:
        for e in ((a_, b_), (b_, c_), (c_, a_)):
            ec[tuple(sorted(e))] += 1
    print('open edges', sum(1 for n in ec.values() if n == 1))
    print(gender, 'verts', len(pos), 'tris', len(tri), 'joints', J, 'width', round(float(pos[:, 0].max() - pos[:, 0].min()), 3))


third = 1 / 3
ARM = float(sys.argv[3]) if len(sys.argv) > 3 else 14
FACE = float(sys.argv[4]) if len(sys.argv) > 4 else 3.2
build('male', {
    'universal-male-young-averagemuscle-averageweight': 0.45,
    'universal-male-young-maxmuscle-averageweight': 0.55,
    'caucasian-male-young': third, 'asian-male-young': third, 'african-male-young': third,
    'proportions/male-young-averagemuscle-averageweight-idealproportions': 0.5,
}, 1.86, ARM, FACE)
build('female', {
    'universal-female-young-averagemuscle-averageweight': 0.8,
    'universal-female-young-maxmuscle-averageweight': 0.2,
    'caucasian-female-young': third, 'asian-female-young': third, 'african-female-young': third,
    'proportions/female-young-averagemuscle-averageweight-idealproportions': 0.6,
}, 1.76, ARM, FACE)
