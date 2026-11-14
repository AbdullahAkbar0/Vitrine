"""Measures the rendered mannequins and writes the fitting targets used by the app.

Run after mesh.py and render3d.py:  python3 scripts/mannequin/rig.py WORK/build
Output: src/config/mannequinRig.json (pixel positions in the 972x2160 mannequin pictures).
If you replace the mannequin pictures with your own, keep the same pose and size or re-measure.
"""
import json, math, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent.parent.parent
BUILD = Path(sys.argv[1]) if len(sys.argv) > 1 else None
JOINTS_FILE = Path(__file__).parent / 'joints.json'
FRAME = [-0.45, 0.45, -0.05, 1.95]
W, H = 972, 2160


def px(x, y):
    return [round((x - FRAME[0]) / (FRAME[1] - FRAME[0]) * W, 1), round((FRAME[3] - y) / (FRAME[3] - FRAME[2]) * H, 1)]


def m2px(d):
    return d / (FRAME[1] - FRAME[0]) * W


def runs(row, thr=128):
    out, start = [], None
    for x, a in enumerate(row):
        if a > thr and start is None:
            start = x
        elif a <= thr and start is not None:
            out.append((start, x - 1))
            start = None
    if start is not None:
        out.append((start, len(row) - 1))
    return out


def measure(gender):
    img = Image.open(ROOT / 'public' / 'mannequins' / f'{gender}-front.png')
    alpha = img.getchannel('A')
    A = alpha.load()
    rows = [[A[x, y] for x in range(W)] for y in range(H)]
    cx = W / 2
    J = JOINTS[gender]
    sJ, eJ, wJ, hJ, kJ, aJ = (tuple(J[k][:2]) for k in ('shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'))
    shY = sJ[1] + 0.03

    def center_run(y):
        for a, b in runs(rows[int(y)]):
            if a <= cx <= b:
                return a, b
        return None

    def half_at(y):
        r = center_run(y)
        return max(cx - r[0], r[1] - cx) if r else 0

    # head and neck from the silhouette
    head_top = next(y for y in range(H) if rows[y][int(cx)] > 128)
    y_sh = int(px(0, sJ[1])[1])
    neck_row = min(range(int(px(0, J['head'][1])[1]), y_sh), key=half_at)
    neck_half = half_at(neck_row)
    neck_base = next((y for y in range(neck_row, y_sh) if half_at(y) > neck_half * 1.35), y_sh)
    head_half = max(half_at(y) for y in range(head_top, neck_row)) * 0.93
    waist_lo = int(px(0, hJ[1] + 0.10)[1])
    waist_hi = int(px(0, hJ[1] + 0.30)[1])
    waist_row = min(range(waist_hi, waist_lo), key=half_at)
    waist_y = FRAME[3] - waist_row / H * (FRAME[3] - FRAME[2])
    hips_y = hJ[1] + 0.03

    def arm_half(t0, t1, f):
        """Half-thickness of the left arm at a point between two joints."""
        x, y = px(-(t0[0] + (t1[0] - t0[0]) * f), t0[1] + (t1[1] - t0[1]) * f)
        ang = math.atan2(abs(t1[0] - t0[0]), abs(t1[1] - t0[1]))
        for a, b in runs(rows[int(y)]):
            if a - 3 <= x <= b + 3 and b < cx:
                return (b - a) / 2 * math.cos(ang)
        return m2px(0.04)

    arm_px = [arm_half(sJ, eJ, 0.45), arm_half(sJ, eJ, 1.0), arm_half(eJ, wJ, 0.95)]

    # armpit: first row below the shoulders where the arm separates from the torso
    y0 = int(px(0, shY)[1])
    armpit_y = None
    for y in range(y0, int(px(0, waist_y)[1])):
        rs = runs(rows[y])
        cr = center_run(y)
        if cr and any(b < cr[0] for a, b in rs):
            armpit_y = y
            break
    cr = center_run(armpit_y)
    armpit_l = [cr[0], armpit_y]
    armpit_r = [cr[1], armpit_y]

    # shoulder top: highest body pixel above the shoulder line, a little inside the joint
    def top_at(xp):
        for y in range(int(px(0, 1.9)[1]), H):
            if rows[y][int(xp)] > 128:
                return y
        return None
    sx_l = px(-(sJ[0] + 0.012), 0)[0]
    sx_r = px(sJ[0] + 0.012, 0)[0]
    shoulder_l = [sx_l, top_at(sx_l)]
    shoulder_r = [sx_r, top_at(sx_r)]
    # neck base sides
    nb_l = [round(cx - neck_half * 1.12, 1), neck_base - 6]
    nb_r = [round(cx + neck_half * 1.12, 1), neck_base - 6]

    # crotch: scanning up the middle from the feet
    crotch_y = None
    for y in range(int(px(0, 0.2)[1]), 0, -1):
        if rows[y][int(cx)] > 128:
            crotch_y = y
            break

    # top of the shoulder (left side), from just outside the neck to past the shoulder joint
    y_start = neck_row
    shoulder_top = {}
    outer = min(a for a, b in runs(rows[int(px(0, sJ[1] - 0.03)[1])]))
    for x in range(outer + 2, int(cx - neck_half) + 1, 4):
        for y in range(y_start, int(px(0, waist_y)[1])):
            if rows[y][x] > 128:
                shoulder_top[x] = y
                break

    # body half-width (torso) for every row from the neck to the crotch
    torso = {}
    for y in range(int(nb_l[1]), crotch_y + 1, 2):
        r = center_run(y)
        if r:
            torso[y] = round(max(cx - r[0], r[1] - cx), 1)
    # leg edges (left leg = image left) for every row from the crotch down to the ankles
    legs = {}
    for y in range(crotch_y, int(px(0, 0.05)[1]), 2):
        rs = [r for r in runs(rows[y]) if r[1] < cx]
        if rs:
            a, b = max(rs, key=lambda r: r[1] - r[0])
            legs[y] = [a, b]
    # arm radius along the arm (metres → px)
    arm_r = [round(r, 1) for r in arm_px]

    L = lambda p: px(-p[0], p[1])
    R = lambda p: px(p[0], p[1])
    return {
        'neckL': nb_l, 'neckR': nb_r,
        'shoulderL': shoulder_l, 'shoulderR': shoulder_r,
        'shoulderJointL': L(sJ), 'shoulderJointR': R(sJ),
        'elbowL': L(eJ), 'elbowR': R(eJ),
        'wristL': L(wJ), 'wristR': R(wJ),
        'armpitL': armpit_l, 'armpitR': armpit_r,
        'waistY': px(0, waist_y)[1],
        'hipsY': px(0, hips_y)[1],
        'hipL': L(hJ), 'hipR': R(hJ),
        'kneeL': L(kJ), 'kneeR': R(kJ),
        'ankleL': L(aJ), 'ankleR': R(aJ),
        'crotch': [cx, crotch_y],
        'headTop': [cx, head_top],
        'headCenter': [cx, round(head_top + (neck_row - head_top) * 0.46, 1)],
        'headHalfW': round(head_half, 1),
        'footY': px(0, 0.03)[1],
        'centerX': cx,
        'armRadius': arm_r,
        'shoulderTop': shoulder_top,
        'torsoHalfW': torso,
        'legL': legs,
    }


if BUILD:
    JOINTS_FILE.write_text(json.dumps({g: json.load(open(BUILD / f'{g}.json'))['joints'] for g in ('female', 'male')}, indent=1))
JOINTS = json.load(open(JOINTS_FILE))
out = {'width': W, 'height': H, 'female': measure('female'), 'male': measure('male')}
target = ROOT / 'src' / 'config' / 'mannequinRig.json'
target.write_text(json.dumps(out, separators=(',', ':')))
for g in ('female', 'male'):
    m = out[g]
    print(g, {k: m[k] for k in ['shoulderL', 'armpitL', 'crotch', 'hipL', 'ankleL', 'neckL', 'wristL']})
print('wrote', target, target.stat().st_size, 'bytes')
