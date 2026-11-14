"""Measures the rendered mannequins and writes the fitting targets used by the app.

Run after render.py:  python3 scripts/mannequin/rig.py
Output: src/config/mannequinRig.json (pixel positions in the 680x1603 mannequin pictures).
If you replace the mannequin pictures with your own, keep the same pose and size or re-measure.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent.parent.parent
FRAME = [-0.42, 0.42, -0.05, 1.93]
W, H = 820, 1933


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
    fem = gender == 'female'
    img = Image.open(ROOT / 'public' / 'mannequins' / f'{gender}-front.png')
    alpha = img.getchannel('A')
    A = alpha.load()
    rows = [[A[x, y] for x in range(W)] for y in range(H)]
    cx = W / 2

    # analytic joints: the same numbers as the renderer (scripts/mannequin/render.html)
    shY = 1.42 if fem else 1.495
    shX = 0.168 if fem else 0.222
    sJ = (shX + 0.005, shY - (0.035 if fem else 0.04))
    eJ = (sJ[0] + (0.062 if fem else 0.07), 1.15 if fem else 1.2)
    wJ = (eJ[0] + (0.043 if fem else 0.05), 0.905 if fem else 0.945)
    hJ = (0.09 if fem else 0.093, 0.885 if fem else 0.94)
    kJ = (0.078 if fem else 0.09, 0.495 if fem else 0.51)
    aJ = (0.07 if fem else 0.086, 0.085)
    head_c = (0.0, 1.66 if fem else 1.745)
    head_r = (0.071, 0.102) if fem else (0.078, 0.108)
    neck_y = 1.44 if fem else 1.5
    neck_r = 0.044 if fem else 0.062
    waist_y = 1.075 if fem else 1.135
    hips_y = 0.925 if fem else 0.985
    arm_radius = (0.046, 0.033, 0.023) if fem else (0.058, 0.043, 0.029)

    def center_run(y):
        for a, b in runs(rows[int(y)]):
            if a <= cx <= b:
                return a, b
        return None

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
    sx_l = px(-(shX - 0.012), 0)[0]
    sx_r = px(shX - 0.012, 0)[0]
    shoulder_l = [sx_l, top_at(sx_l)]
    shoulder_r = [sx_r, top_at(sx_r)]
    # neck base sides
    nb_l = px(-neck_r * 1.05, neck_y + 0.03)
    nb_r = px(neck_r * 1.05, neck_y + 0.03)

    # crotch: scanning up the middle from the feet
    crotch_y = None
    for y in range(int(px(0, 0.2)[1]), 0, -1):
        if rows[y][int(cx)] > 128:
            crotch_y = y
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
    arm_r = [m2px(r) for r in arm_radius]

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
        'headTop': px(0, head_c[1] + head_r[1]),
        'headCenter': px(0, head_c[1]),
        'headHalfW': m2px(head_r[0]),
        'footY': px(0, 0.03)[1],
        'centerX': cx,
        'armRadius': arm_r,
        'torsoHalfW': torso,
        'legL': legs,
    }


out = {'width': W, 'height': H, 'female': measure('female'), 'male': measure('male')}
target = ROOT / 'src' / 'config' / 'mannequinRig.json'
target.write_text(json.dumps(out, separators=(',', ':')))
for g in ('female', 'male'):
    m = out[g]
    print(g, {k: m[k] for k in ['shoulderL', 'armpitL', 'crotch', 'hipL', 'ankleL', 'neckL', 'wristL']})
print('wrote', target, target.stat().st_size, 'bytes')
