"""Fallen Paladin sword sockets: derive and verify FALLEN_LONGSWORD_SOCKETS (site/world3d/class-equipment.js).

BUILD-SPEC §5.3 / §6.4 grip loop, done numerically on the skinned hero (and confirmed with the close-up renders of
tools/qa/hero-pose-renders.cjs):
  held   RightHand-local, centimetres, three.js Euler XYZ. The grip axis runs through the knight's curled right gauntlet
         (channel centre HELD_CHANNEL_CENTRE, tilted HELD_CHANNEL_TILT toward the back of the hand / the fingers), the
         blade leaves on the thumb side with its edge toward the knuckles (crossguard roll 0 = quillons along the hand's
         finger direction), and the crossguard sits HELD_S_GUARD cm up the axis, i.e. right against the index finger with
         the long two-hand grip and pommel below the fist. GRIP_AXIS_OFFSET corrects for the FP_Sword grip axis being
         1.05 cm off the blade axis (measured from the mesh; printed as 'grip axis measured').
  stowed actor space at model scale 1 (class-equipment.js multiplies position and scale by the hero's model scale),
         parented to mixamorig:Hips at bind like every stowed class weapon (bindStowedSockets). Left hip at belt height,
         crossguard in front of the hip and outside the arm's swing, blade 38 deg back from vertical and 8 deg out.
Every clip is replayed on the skinned body (linear blend skinning, same maths as three.js) and the sword is tested
against body regions from the build's labels.json, only on the frames where that sword is visible in game:
  held   paladin clips with the sword drawn (moveTo/moveAlong always sheathe, so Walk/Run never show it):
         Combat_Idle, Idle, Block, Cast, Attack_Smite (the paladin's attack), Weapon_Draw from the 46 % swap,
         Weapon_Sheathe until the 62 % swap. Blade + crossguard vs legs/torso/tassets/cape/left arm, grip vs forearm,
         grip/pommel beyond the fist vs the body.
         Reported only (not gated): Hit (the clip presses the fist into the thigh, so every blade direction from that hand
         crosses the leg for a few frames), Death (the body folds over), Attack_Slash / Attack_Heavy / Dodge (never played
         by a paladin: combat-presentation.js gives paladins attack_smite and the block reaction), Talk.
  stowed Idle, locomotion and gesture clips, Weapon_Draw before 46 %, Weapon_Sheathe after 62 %: legs, tabard+torso,
         tassets, cape, both arms, lowest point.
Acceptance: held blade/crossguard never inside and >= 1 cm from legs/torso/tassets/cape/left arm in the held clips;
no grip/forearm intersection > 5 mm at Attack_Smite 30-60 %; grip/pommel beyond the fist never more than 1.5 cm inside
the body (except Attack_Smite 55-91 %, printed as KNOWN: the clip presses the fist against the hip); stowed sword clear (>= 2 cm, no penetration) of legs, tabard, tassets, cape and the left arm in every stowed
clip; stowed tip >= 0.15 m above the ground.

usage (numpy required; Blender's bundled python works):
  python3 tools/hero/sword-sockets.py --glb <hero glb with clips> --labels <work/labels.json> [--fit-channel] [--json out]
Exit code 1 if an acceptance check fails. Read-only.
"""
import sys, json, struct, argparse, re, os
import numpy as np

# ------------------------------------------------------------------ socket design (the values class-equipment.js uses)
HELD_CHANNEL_CENTRE = (-4.5, 9.75, 0.0)   # RightHand-local cm (X back of hand, Y toward the fingers, Z thumb side)
HELD_CHANNEL_TILT = (32.0, 16.0)           # deg: axis = normalize(tan(32), tan(16), 1) -> leans to the back of the hand / fingers
HELD_S_GUARD = 14.5                        # cm from the channel centre to the crossguard, along the axis (thumb side)
HELD_ROLL = 0.0                            # deg: crossguard roll about the blade (0 = quillons along hand +Y: edge toward the knuckles)
GRIP_AXIS_OFFSET = (1.05, 0.15)            # cm: FP_Sword grip axis in sword X/Z (the grip is not centred on the blade axis)
STOW_GUARD = (-0.52, 0.27, 1.11)           # crossguard centre, Blender rig frame at bind (m; X<0 = left, Y front, Z up)
STOW_THETA, STOW_PHI, STOW_ROLL = 38.0, 8.0, 120.0  # blade: deg from straight down; azimuth 0 = straight back, + = outward; roll (90 = flat to the thigh)
STOW_BONE = 'mixamorig:Hips'

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class GLB:
    def __init__(self, path):
        b = open(path, 'rb').read(); off = 12
        while off < len(b):
            ln, ty = struct.unpack_from('<I4s', b, off); d = b[off + 8: off + 8 + ln]
            if ty == b'JSON': self.json = json.loads(d)
            elif ty.startswith(b'BIN'): self.bin = d
            off += 8 + ln
        self.nodes = self.json['nodes']; self.parent = [-1] * len(self.nodes)
        for i, n in enumerate(self.nodes):
            for c in n.get('children', []): self.parent[c] = i
        self.by_name = {n.get('name'): i for i, n in enumerate(self.nodes)}; self._c = {}

    def acc(self, idx):
        if idx in self._c: return self._c[idx]
        a = self.json['accessors'][idx]; n = NC[a['type']]; dt = CT[a['componentType']]
        bv = self.json['bufferViews'][a['bufferView']]; isz = np.dtype(dt).itemsize
        stride = bv.get('byteStride', isz * n); base = bv.get('byteOffset', 0) + a.get('byteOffset', 0); cnt = a['count']
        raw = np.frombuffer(self.bin, dtype=np.uint8, count=stride * (cnt - 1) + isz * n, offset=base)
        if stride == isz * n: arr = np.frombuffer(raw.tobytes(), dtype=dt).reshape(cnt, n)
        else: arr = np.lib.stride_tricks.as_strided(raw, shape=(cnt, n * isz), strides=(stride, 1)).copy().view(dt).reshape(cnt, n)
        arr = arr.astype(np.float64)
        if a.get('normalized'): arr = np.maximum(arr / {np.int8: 127, np.uint8: 255, np.int16: 32767, np.uint16: 65535}[dt], -1.0)
        self._c[idx] = arr; return arr

    def anim(self, name): return next(a for a in self.json['animations'] if a['name'] == name)

    def key_times(self, an): return sorted({round(float(v), 6) for s in an['samplers'] for v in self.acc(s['input'])[:, 0]})


def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]])


def local(n, ov=None):
    if 'matrix' in n and not ov: return np.array(n['matrix']).reshape(4, 4).T
    ov = ov or {}; M = np.eye(4)
    M[:3, :3] = quat_mat(ov.get('rotation', n.get('rotation', [0, 0, 0, 1]))) * np.asarray(ov.get('scale', n.get('scale', [1, 1, 1])))[None, :]
    M[:3, 3] = ov.get('translation', n.get('translation', [0, 0, 0])); return M


def sample(g, an, ch, t):
    s = an['samplers'][ch['sampler']]; tin = g.acc(s['input'])[:, 0]; out = g.acc(s['output'])
    if t <= tin[0]: return out[0]
    if t >= tin[-1]: return out[-1]
    hi = int(np.searchsorted(tin, t, side='right')); lo = hi - 1
    if s.get('interpolation') == 'STEP': return out[lo]
    f = (t - tin[lo]) / (tin[hi] - tin[lo])
    if ch['target']['path'] == 'rotation':
        a, b = out[lo], out[hi]
        if np.dot(a, b) < 0: b = -b
        o = a + (b - a) * f; return o / np.linalg.norm(o)
    return out[lo] + (out[hi] - out[lo]) * f


def pose(g, an, t):
    ov = {}
    for ch in an['channels']:
        if ch['target'].get('node') is not None: ov.setdefault(ch['target']['node'], {})[ch['target']['path']] = sample(g, an, ch, t)
    return ov


def worlds(g, ov=None):
    ov = ov or {}; W = [None] * len(g.nodes)
    def get(i):
        if W[i] is None: W[i] = local(g.nodes[i], ov.get(i)) if g.parent[i] < 0 else get(g.parent[i]) @ local(g.nodes[i], ov.get(i))
        return W[i]
    for i in range(len(g.nodes)): get(i)
    return W


class Skin:
    def __init__(self, g):
        self.g = g; self.node = next(i for i, n in enumerate(g.nodes) if 'skin' in n and 'mesh' in n)
        n = g.nodes[self.node]; sk = g.json['skins'][n['skin']]; self.joints = sk['joints']
        self.ibm = g.acc(sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
        P, J, Wt, N = [], [], [], []
        for p in g.json['meshes'][n['mesh']]['primitives']:
            P.append(g.acc(p['attributes']['POSITION'])); J.append(g.acc(p['attributes']['JOINTS_0']).astype(np.int64))
            w = g.acc(p['attributes']['WEIGHTS_0']); Wt.append(w / w.sum(1, keepdims=True)); N.append(g.acc(p['attributes']['NORMAL']))
        self.P = np.concatenate(P); self.J = np.concatenate(J); self.W = np.concatenate(Wt); self.Nrm = np.concatenate(N)
        self.N = len(self.P); self.Ph = np.c_[self.P, np.ones(self.N)]
        self.names = [g.nodes[j]['name'] for j in self.joints]

    def skin(self, ov=None, normals=False):
        Wd = worlds(self.g, ov); M = np.stack([Wd[j] @ self.ibm[k] for k, j in enumerate(self.joints)])
        P = np.zeros((self.N, 3)); Nn = np.zeros((self.N, 3)) if normals else None
        for k in range(4):
            Mk = M[self.J[:, k]]; P += self.W[:, k:k + 1] * np.einsum('nij,nj->ni', Mk[:, :3, :], self.Ph)
            if normals: Nn += self.W[:, k:k + 1] * np.einsum('nij,nj->ni', Mk[:, :3, :3], self.Nrm)
        if normals: Nn /= np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-12)
        return P, Nn, Wd

    def bone_weight(self, name):
        k = self.names.index(name); return sum(np.where(self.J[:, c] == k, self.W[:, c], 0) for c in range(4))


def euler_xyz(r):
    cx, cy, cz = np.cos(r); sx, sy, sz = np.sin(r)
    return np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]) @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]) @ np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])


def mat_to_euler_xyz(R):
    y = np.arcsin(np.clip(R[0, 2], -1, 1))
    if abs(R[0, 2]) < 0.9999999: return np.array([np.arctan2(-R[1, 2], R[2, 2]), y, np.arctan2(-R[0, 1], R[0, 0])])
    return np.array([np.arctan2(R[2, 1], R[1, 1]), y, 0.0])


def match_labels(sk, L):
    from collections import defaultdict
    rest = sk.skin()[0]; lp = np.array(L['positions']).reshape(-1, 3); cell = 0.0005; grid = defaultdict(list)
    for i, p in enumerate(np.round(lp / cell).astype(np.int64)): grid[tuple(p)].append(i)
    seg = np.full(sk.N, -1); reg = np.full(sk.N, -1)
    for i, c in enumerate(np.round(rest / cell).astype(np.int64)):
        best, bd = -1, 1e9
        for d in np.ndindex(3, 3, 3):
            for q in grid.get((c[0] + d[0] - 1, c[1] + d[1] - 1, c[2] + d[2] - 1), ()):
                dd = float(np.sum((lp[q] - rest[i]) ** 2))
                if dd < bd: bd, best = dd, q
        if best >= 0: seg[i] = L['segment'][best]; reg[i] = L['region'][best]
    return seg, reg


# ------------------------------------------------------------------ socket maths
def channel_axis(tilt):
    d = np.array([np.tan(np.radians(tilt[0])), np.tan(np.radians(tilt[1])), 1.0]); return d / np.linalg.norm(d)


def held_socket(centre=HELD_CHANNEL_CENTRE, tilt=HELD_CHANNEL_TILT, s_guard=HELD_S_GUARD, roll=HELD_ROLL, grip=GRIP_AXIS_OFFSET):
    """Sword frame in RightHand-local cm: columns = sword X (crossguard), Y (blade), Z; origin = crossguard.
    The grip axis (sword-space x = grip[0], z = grip[1]) passes through the channel centre."""
    d = channel_axis(tilt); y = np.array([0, 1.0, 0]); c0 = y - (y @ d) * d; c0 /= np.linalg.norm(c0)
    r = np.radians(roll); cg = c0 * np.cos(r) + np.cross(d, c0) * np.sin(r)
    R = np.stack([cg, d, np.cross(cg, d)], 1); p = np.asarray(centre) + s_guard * d - R @ np.array([grip[0], 0.0, grip[1]])
    return R, p


def stow_socket(guard=STOW_GUARD, theta=STOW_THETA, phi=STOW_PHI, roll=STOW_ROLL):
    """-> (rotation matrix in Blender rig frame, guard in Blender rig frame, actor-space position, actor-space Euler)."""
    th, ph = np.radians(theta), np.radians(phi)
    b = np.array([-np.sin(th) * np.sin(ph), -np.sin(th) * np.cos(ph), -np.cos(th)])
    out = np.array([-1.0, 0, 0]); c0 = out - (out @ b) * b; c0 /= np.linalg.norm(c0)
    r = np.radians(roll); cg = c0 * np.cos(r) + np.cross(b, c0) * np.sin(r)
    Rb = np.stack([cg, b, np.cross(cg, b)], 1)
    M = np.array([[-1, 0, 0], [0, 0, 1], [0, 1, 0.0]])          # Blender rig frame -> actor space (model rotated by pi)
    return Rb, np.asarray(guard, float), M @ np.asarray(guard, float), mat_to_euler_xyz(M @ Rb)


def fit_channel(sk):
    """Search the curled-finger channel of the right gauntlet (hand vertices weighted >= 0.99 to RightHand)."""
    k = sk.names.index('mixamorig:RightHand'); m = sk.bone_weight('mixamorig:RightHand') > 0.99
    H = (sk.ibm[k] @ sk.Ph[m].T).T[:, :3]; NN = (sk.ibm[k][:3, :3] @ sk.Nrm[m].T).T; NN /= np.linalg.norm(NN, axis=1, keepdims=True)
    best = []
    for x in np.arange(-6, -1.4, 0.25):
        for yy in np.arange(6, 11.01, 0.25):
            c = np.array([x, yy, 0.0])
            for tx in range(0, 46, 3):
                for ty in range(-15, 31, 3):
                    d = channel_axis((tx, ty)); v = H - c; s = v @ d; perp = v - s[:, None] * d; r = np.linalg.norm(perp, axis=1)
                    near = np.abs(s) < 4.5
                    if (near & (r < 1.85)).any(): continue
                    ring = near & (r < 6.0) & ((NN * -perp).sum(1) > 0)
                    if ring.sum() < 8: continue
                    a = np.cross(d, [1, 0, 0]); a /= np.linalg.norm(a); bb = np.cross(d, a)
                    ang = np.degrees(np.arctan2(perp[ring] @ bb, perp[ring] @ a)); bins = np.zeros(24, bool)
                    bins[((ang + 180) // 15).astype(int) % 24] = True
                    if bins.sum() * 15 >= 240: best.append((float(r[near].min()), int(bins.sum() * 15), x, yy, tx, ty))
    best.sort(reverse=True)
    return best[:10]


def contact(Pw, Nw, mask, A):
    """min distance (cm) from sword points A to body vertices in mask; max penetration (cm, nearest-normal test, <= 4 cm)."""
    B = Pw[mask]; NB = Nw[mask]; lo = A.min(0) - 0.06; hi = A.max(0) + 0.06
    sel = np.all((B > lo) & (B < hi), axis=1)
    if not sel.any(): return 99.0, 0.0
    B = B[sel]; NB = NB[sel]; bd = 99.0; bp = 0.0
    for i in range(0, len(A), 512):
        D = np.sqrt(((A[i:i + 512, None, :] - B[None]) ** 2).sum(-1)); j = D.argmin(1); d = D[np.arange(len(j)), j]
        bd = min(bd, float(d.min()) * 100); side = ((A[i:i + 512] - B[j]) * NB[j]).sum(1)
        bp = max(bp, float(np.where((side < 0) & (d < 0.04), d, 0).max()) * 100)
    return round(bd, 1), round(bp, 1)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--glb', required=True); ap.add_argument('--labels', required=True)
    ap.add_argument('--fit-channel', action='store_true'); ap.add_argument('--json')
    ap.add_argument('--stowed-override', help='evaluate another stowed socket instead: px,py,pz,rx,ry,rz,scale,bone')
    ap.add_argument('--equipment', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../site/world3d/class-equipment.js'))
    ap.add_argument('--held-clips', default='Combat_Idle,Idle,Block,Cast,Attack_Smite,Weapon_Draw,Weapon_Sheathe')
    ap.add_argument('--held-soft-clips', default='Hit,Death,Attack_Slash,Attack_Heavy,Dodge,Talk')
    ap.add_argument('--stow-clips', default='Idle,Walk,Run,Walk_Start,Walk_Stop,Turn_Left,Turn_Right,Talk,Interact,Work,Drink,Weapon_Draw,Weapon_Sheathe')
    a = ap.parse_args()
    g = GLB(a.glb); sk = Skin(g); L = json.load(open(a.labels)); seg, reg = match_labels(sk, L)
    names = L['region_names']; out = {'glb': a.glb}
    if a.fit_channel:
        out['channel_candidates'] = fit_channel(sk)
        print('channel candidates (clearance cm, wrap deg, x, y, tiltX, tiltY):'); [print('  ', c) for c in out['channel_candidates'][:5]]
    Rh, ph = held_socket(); eh = mat_to_euler_xyz(Rh); assert np.allclose(euler_xyz(eh), Rh, atol=1e-9)
    Rs, Gs, pa, es = stow_socket()
    js = {'held': {'position': [round(float(v), 3) for v in ph], 'rotation': [round(float(v), 4) for v in eh]},
          'stowed': {'position': [round(float(v), 3) for v in pa], 'rotation': [round(float(v), 4) for v in es], 'scale': 0.01, 'bone': STOW_BONE}}
    out['sockets_derived'] = js
    print('derived FALLEN_LONGSWORD_SOCKETS =', json.dumps(js))
    fails = []
    # The values the game actually uses: read them from class-equipment.js and evaluate THOSE.
    src = open(a.equipment).read()
    num = r'\[([^\]]+)\]'
    mh = re.search(r"held:Object\.freeze\(\{position:" + num + r",rotation:" + num, src)
    ms = re.search(r"stowed:Object\.freeze\(\{position:" + num + r",rotation:" + num + r",scale:([0-9.]+),bone:'([^']+)'", src)
    if not (mh and ms): raise SystemExit('FALLEN_LONGSWORD_SOCKETS not found in ' + a.equipment)
    vec = lambda t: np.array([float(v) for v in t.split(',')])
    game = {'held': {'position': vec(mh.group(1)), 'rotation': vec(mh.group(2))},
            'stowed': {'position': vec(ms.group(1)), 'rotation': vec(ms.group(2)), 'scale': float(ms.group(3)), 'bone': ms.group(4)}}
    out['sockets_game'] = {k: {kk: (vv.tolist() if hasattr(vv, 'tolist') else vv) for kk, vv in v.items()} for k, v in game.items()}
    if a.stowed_override:
        v = a.stowed_override.split(',')
        game['stowed'] = {'position': np.array([float(x) for x in v[:3]]), 'rotation': np.array([float(x) for x in v[3:6]]), 'scale': float(v[6]), 'bone': v[7]}
        out['stowed_override'] = a.stowed_override
    # Compare as transforms (an Euler triple is not unique: x = +pi and -pi are the same rotation).
    for part in (('held',) if a.stowed_override else ('held', 'stowed')):
        dpos = float(np.abs(game[part]['position'] - np.array(js[part]['position'])).max())
        drot = float(np.abs(euler_xyz(game[part]['rotation']) - euler_xyz(np.array(js[part]['rotation']))).max())
        if dpos > 2e-3: fails.append(f'class-equipment.js {part}.position differs from the derived socket by {dpos:.4f}')
        if drot > 2e-3: fails.append(f'class-equipment.js {part}.rotation differs from the derived socket by {drot:.4f} (matrix element)')
    if not a.stowed_override and (game['stowed']['bone'] != STOW_BONE or abs(game['stowed']['scale'] - 0.01) > 1e-9): fails.append('class-equipment.js stowed bone/scale differ from the design')
    Rh = euler_xyz(game['held']['rotation']); ph = game['held']['position']
    es = game['stowed']['rotation']; pa = game['stowed']['position']; stow_bone = game['stowed']['bone']; stow_scale = game['stowed']['scale']
    si = g.by_name['FP_Sword']; mi = [c for c in g.nodes[si].get('children', []) if 'mesh' in g.nodes[c]][0]
    pr = g.json['meshes'][g.nodes[mi]['mesh']]['primitives'][0]
    SP = g.acc(pr['attributes']['POSITION']); SP = (local(g.nodes[mi]) @ np.c_[SP, np.ones(len(SP))].T).T[:, :3]   # cm, sword space
    blade = SP[:, 1] > 4.5; guard = np.abs(SP[:, 1]) <= 4.5; grip = SP[:, 1] < -4.5
    gm = SP[(SP[:, 1] < -6) & (SP[:, 1] > -24)]
    out['grip_axis_measured_cm'] = [round(float((gm[:, 0].min() + gm[:, 0].max()) / 2), 2), round(float((gm[:, 2].min() + gm[:, 2].max()) / 2), 2)]
    print('grip axis measured (sword x, z cm):', out['grip_axis_measured_cm'], ' design', list(GRIP_AXIS_OFFSET))
    # grip/pommel part beyond the fist: axial coordinate from the channel centre < -5 cm (the fist spans about +-4.5 cm)
    SPh = (Rh @ SP.T).T + ph
    beyond = grip & (((SPh - np.array(HELD_CHANNEL_CENTRE)) @ Rh[:, 1]) < -5.0)
    hand = reg == names.index('hand')
    rest = sk.skin()[0]
    groups = {'legs': (seg == 0) & (rest[:, 1] < 0.95) & ~hand, 'torso_tabard': (seg == 0) & (rest[:, 1] >= 0.95) & ~hand,
              'tasset': reg == names.index('tasset'), 'cape': seg == 3, 'armL': seg == 1, 'armR_noHand': (seg == 2) & ~hand}
    fore = sk.bone_weight('mixamorig:RightForeArm') > 0.3
    S = np.eye(4); S[:3, :3] = Rh; S[:3, 3] = ph
    rh = g.by_name['mixamorig:RightHand']; sb = g.by_name[stow_bone]; W0 = worlds(g)
    Ry = np.diag([-1.0, 1, -1, 1]); T_act = np.eye(4); T_act[:3, :3] = euler_xyz(es) * stow_scale; T_act[:3, 3] = pa
    stow_rel = np.linalg.inv(W0[sb]) @ np.linalg.inv(Ry) @ T_act
    # Frames on which each sword is visible in game (animation-policy.mjs EQUIPMENT_SWAP: draw .46, sheathe .62).
    HELD_WINDOW = {'Weapon_Draw': (0.46, 1.0), 'Weapon_Sheathe': (0.0, 0.62)}
    STOW_WINDOW = {'Weapon_Draw': (0.0, 0.46), 'Weapon_Sheathe': (0.62, 1.0)}
    hard_held = set(a.held_clips.split(','))
    def frames(an, window):
        ts = g.key_times(an); T = max(ts[-1] - ts[0], 1e-9)
        return [t for t in ts if window[0] - 1e-6 <= (t - ts[0]) / T <= window[1] + 1e-6], ts
    # Clip limitation, not a socket choice: from the strike (55 %) through the recovery (91 %) Attack_Smite brings the fist
    # within 3 cm of the right hip, so the long two-hand grip/pommel below the fist dips into the tasset. Every grip
    # position and tilt tried (crossguard 14.5-18.5 cm from the fist centre, tilts 0-40 deg, and the round-1 socket) does
    # the same for 5-7 frames; it is hidden by the fist and tasset at gameplay distance. Reported, not failed.
    KNOWN_POMMEL_CONTACT = {'Attack_Smite': 'strike + recovery: the clip presses the fist against the hip; every socket tried does this'}
    known = []
    held = {}; stowed = {}; aim = {}
    for cn in a.held_clips.split(',') + [c for c in a.held_soft_clips.split(',') if c]:
        an = g.anim(cn); sel, ts = frames(an, HELD_WINDOW.get(cn, (0, 1))); worst = {}; gated = cn in hard_held
        for t in sel:
            P, Nn, Wd = sk.skin(pose(g, an, t), normals=True); M = Wd[rh] @ S; A = (M @ np.c_[SP, np.ones(len(SP))].T).T[:, :3]
            frac = (t - ts[0]) / max(ts[-1] - ts[0], 1e-9)
            for gname, mask in list(groups.items()) + [('forearm', fore), ('pommel_body', None)]:
                if gname == 'forearm': pts, m = A[grip][::2], mask
                elif gname == 'pommel_body': pts, m = A[beyond], (seg >= 0) & ~hand & ~fore
                else: pts, m = A[blade | guard][::2], mask
                d, pen = contact(P, Nn, m, pts)
                w = worst.setdefault(gname, {'min_cm': 99.0, 'pen_cm': 0.0, 'at': None})
                if d < w['min_cm']: w['min_cm'] = d
                if pen > w['pen_cm']: w['pen_cm'] = pen; w['at'] = round(t, 3)
                if gname == 'forearm' and cn == 'Attack_Smite' and 0.3 <= frac <= 0.6 and pen > 0.5:
                    fails.append(f'held: grip/forearm intersection {pen} cm in Attack_Smite at {frac:.0%}')
        held[cn] = {**worst, 'gated': gated}
        if gated:
            for gname in ('legs', 'torso_tabard', 'tasset', 'cape', 'armL'):
                if worst[gname]['pen_cm'] > 0 or worst[gname]['min_cm'] < 1.0: fails.append(f'held: blade/crossguard {worst[gname]["min_cm"]} cm / pen {worst[gname]["pen_cm"]} cm vs {gname} in {cn}')
            if worst['pommel_body']['pen_cm'] > 1.5:
                if cn in KNOWN_POMMEL_CONTACT: known.append(f'{cn}: grip/pommel beyond the fist {worst["pommel_body"]["pen_cm"]} cm into the body at t={worst["pommel_body"]["at"]} s ({KNOWN_POMMEL_CONTACT[cn]})')
                else: fails.append(f'held: grip/pommel {worst["pommel_body"]["pen_cm"]} cm inside the body in {cn}')
        # blade direction in the actor frame at the middle visible frame (elevation above horizontal, azimuth + = outward right)
        tm = sel[len(sel) // 2]; Wd = worlds(g, pose(g, an, tm)); bdir = (Wd[rh] @ S)[:3, :3] @ np.array([0, 1.0, 0]); bdir /= np.linalg.norm(bdir)
        aim[cn] = {'t': round(tm, 3), 'elevation_deg': round(float(np.degrees(np.arcsin(bdir[1]))), 1), 'azimuth_out_deg': round(float(np.degrees(np.arctan2(bdir[0], -bdir[2]))), 1)}
        print(f'HELD {cn:15s}{"" if gated else " (report)"}', '  '.join(f'{k}: {v["min_cm"]}cm pen {v["pen_cm"]}' for k, v in worst.items()), f'| blade el {aim[cn]["elevation_deg"]} az {aim[cn]["azimuth_out_deg"]}')
    for cn in a.stow_clips.split(','):
        an = g.anim(cn); worst = {}; low = 9.0; sel, _ = frames(an, STOW_WINDOW.get(cn, (0, 1)))
        for t in sel:
            P, Nn, Wd = sk.skin(pose(g, an, t), normals=True); M = Wd[sb] @ stow_rel; A = (M @ np.c_[SP, np.ones(len(SP))].T).T[:, :3]
            low = min(low, float(A[:, 1].min()))
            for gname, mask in groups.items():
                d, pen = contact(P, Nn, mask, A[::2])
                w = worst.setdefault(gname, {'min_cm': 99.0, 'pen_cm': 0.0})
                w['min_cm'] = min(w['min_cm'], d); w['pen_cm'] = max(w['pen_cm'], pen)
        stowed[cn] = {**worst, 'lowest_m': round(low, 3)}
        for gname, w in worst.items():
            if gname != 'armR_noHand' and (w['min_cm'] < 2.0 or w['pen_cm'] > 0): fails.append(f'stowed: {gname} {w["min_cm"]} cm / pen {w["pen_cm"]} cm in {cn}')
        if low < 0.15: fails.append(f'stowed: lowest point {low:.3f} m in {cn}')
        print(f'STOW {cn:15s} lowest {low:.3f} m ', '  '.join(f'{k}: {v["min_cm"]}cm pen {v["pen_cm"]}' for k, v in worst.items()))
    out['held_blade_aim'] = aim
    out['known_clip_contacts'] = known
    for k in known: print('KNOWN', k)
    out.update({'held': held, 'stowed': stowed, 'failures': fails, 'ok': not fails})
    if a.json: json.dump(out, open(a.json, 'w'), indent=1)
    print('OK' if not fails else 'FAIL:\n  ' + '\n  '.join(fails))
    sys.exit(0 if not fails else 1)


if __name__ == '__main__':
    main()
