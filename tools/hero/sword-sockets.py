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
         parented to mixamorig:Hips at bind like every stowed class weapon (bindStowedSockets). Tight left-hip carry: the
         crossguard sits on the scabbard's locket just in front of the left hip plate at hip height, the blade (inside
         the scabbard) runs STOW_THETA deg back from vertical and STOW_PHI deg out, flat to the thigh (roll 90), so the
         chape trails behind the left leg. FP_Sword_stowed keeps only the hilt (sword-space y < SCABBARD_HILT).
  worn   the scabbard (FALLEN_SCABBARD in class-equipment.js: leather + steel stations, two hangers) is seated with the
         stowed socket and is ALWAYS visible (slot 'worn'; empty while the sword is drawn), so it is tested in every
         clip. Its two leather hangers are derived here (design_hangers): from the sword belt at the waist (belt
         azimuth HANGER_BELT_AZ, height HANGER_BELT_Z; the end tucked HANGER_TUCK under the belt) over the left hip
         plate to the upper edge of the locket / suspension band, lifted HANGER_LIFT off the bind-pose surface.
Every clip is replayed on the skinned body (linear blend skinning, same maths as three.js) and the sword is tested
against body regions from the build's labels.json, only on the frames where that sword is visible in game:
  held   paladin clips with the sword drawn (moveTo/moveAlong always sheathe, so Walk/Run never show it):
         Combat_Idle, Idle, Block, Cast, Attack_Smite (the paladin's attack), Weapon_Draw from its swap, Weapon_Sheathe
         until its swap (SWAP below = FALLEN_LONGSWORD_SOCKETS.swap, which overrides animation-policy.mjs for this sword).
         Blade + crossguard vs legs/torso/tassets/cape/left arm, grip vs forearm, grip/pommel beyond the fist vs the body.
         Reported only (not gated): Hit (the clip presses the fist into the thigh, so every blade direction from that hand
         crosses the leg for a few frames), Death (the body folds over), Attack_Slash / Attack_Heavy / Dodge (never played
         by a paladin: combat-presentation.js gives paladins attack_smite and the block reaction), Talk.
  stowed hilt: Idle, locomotion and Interact, Weapon_Draw before its swap, Weapon_Sheathe after it.
  worn   scabbard + hangers: every clip a hero plays (the stowed clips above plus Combat_Idle, Block, Cast,
         Attack_Smite and the whole of Weapon_Draw / Weapon_Sheathe).
         Talk, Work, Drink are reported only: NPC ambient gestures (animation-policy.mjs AMBIENT_BY_ROLE); NPCs never get
         the hero and the player only plays Interact. Hit, Death, Dodge, Attack_Slash, Attack_Heavy: reported only.
Acceptance: held blade/crossguard never inside and >= 1 cm from legs/torso/tassets/cape/left arm in the held clips;
no grip/forearm intersection > 5 mm at Attack_Smite 30-60 %; grip/pommel beyond the fist never more than 1.5 cm inside
the body (except Attack_Smite 55-91 %, printed as KNOWN: the clip presses the fist against the hip); stowed hilt and
worn scabbard never inside and >= WORN_CLEAR cm from legs, tabard+torso and tassets in every gated clip (a scabbard
that hugs the hip cannot keep the old 2 cm free-floating margin), never crossing the cape and >= CAPE_CLEAR cm from it
(the cape is one swaying sheet, so its side is decided by triangle crossings, not by the nearest normal); hangers (centre
line and both edges, below the belt's lower edge, where the end is tucked under the belt) never cross the legs, torso,
tassets or cape;
scabbard tip >= 0.15 m above the ground in the exploration clips and >= 0.03 m in the combat clips.
RELAXED (documented): the left arm is NOT gated against the stowed hilt, the scabbard or the hangers. A hilt worn on
the left hip sits where the left forearm hangs and swings, so the arm brushes over / through the hilt and the top of
the scabbard in Idle sway, Walk and Run, as in most games; it is reported per clip (min distance, penetration: the
vambrace overlaps the locket by up to ~4 cm in Idle, hidden behind the forearm from the side and by the hilt from the
front). The draw / sheathe swap is reported too (SWAP lines): the shared clips draw out to the right side and never
bring the right hand to the left hip, so SWAP sits at the clip start / end where the hand is nearest (~0.9 m).

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
STOW_GUARD = (-0.33, 0.20, 1.12)           # crossguard centre, Blender rig frame at bind (m; X<0 = left, Y front, Z up)
STOW_THETA, STOW_PHI, STOW_ROLL = 50.0, 9.0, 90.0   # blade: deg from straight down; azimuth 0 = straight back, + = outward; roll (90 = flat to the thigh)
STOW_BONE = 'mixamorig:Hips'
# Worn scabbard (class-equipment.js FALLEN_SCABBARD; compared below). Sword space, cm: [y, half-width, half-thickness].
SCABBARD_AXIS = (1.05, 0.1)                 # blade axis in sword space (x, z)
SCABBARD_HILT = 4.6                         # FP_Sword_stowed keeps sword-space y < this (grip, crossguard, pommel)
SCABBARD_LEATHER = [[12.4, 5.75, 2.3], [30, 5.5, 2.15], [60, 4.9, 2.0], [84.8, 3.85, 1.75]]
SCABBARD_STEEL = [[[3.6, 6.4, 3.05], [4.3, 6.6, 3.15], [5.0, 6.45, 3.0], [11.8, 6.25, 2.85, 2.6], [12.8, 5.95, 2.45, 2.6]],
                  [[23.6, 5.9, 2.45], [24.2, 6.05, 2.58], [27.0, 6.0, 2.52], [27.6, 5.85, 2.4]],
                  [[84.2, 4.1, 1.95, -2.8], [85.0, 4.2, 2.02, -2.8], [91.5, 3.15, 1.65], [96.0, 2.0, 1.25], [98.8, 1.15, 0.95], [99.6, 1.3, 1.1], [100.6, 1.05, 0.95], [101.3, 0.35, 0.35]]]
SCABBARD_SECTION = 1.1                      # superellipse exponent of the lenticular cross-section (4th station value = face cusp, cm)
HANGER_BELT_AZ = (62.0, 92.0)               # deg around the hips axis from the front toward the left: front / rear hanger
HANGER_BELT_Z = 1.235                       # m at bind: lower edge of the waist belt
HANGER_RING_Y = (8.0, 25.6)                 # sword-space y of the locket / suspension band the hangers wrap
HANGER_WIDTH = (0.032, 0.028)               # m
HANGER_BUCKLE = (0.3, 0.35)                 # buckle position along each hanger (0 = belt, 1 = ring)
HANGER_LIFT = 0.008                         # m: strap centre above the bind-pose surface
HANGER_TUCK = ((0.01, 0.015), (-0.002, 0.015))  # m per hanger: the belt end starts this far inside the belt surface and
                                            # above its lower edge (front: tucked under it; rear: lying on it, where the hip plate
                                            # flares right below the belt), so it stays on the belt while the waist moves
WORN_CLEAR = 0.8                            # cm: hilt / scabbard vs legs, torso, tassets
CAPE_CLEAR = 0.3                            # cm: scabbard vs the cape (a swaying single sheet: it may brush, never cross)
SWAP = {'Weapon_Draw': 0.08, 'Weapon_Sheathe': 0.92}  # hero sword equipment swap (FALLEN_LONGSWORD_SOCKETS.swap, used by setCombatStance)

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
        P, J, Wt, N, I = [], [], [], [], []
        for p in g.json['meshes'][n['mesh']]['primitives']:
            base = sum(len(q) for q in P)
            if 'indices' in p: I.append(g.acc(p['indices']).astype(np.int64).reshape(-1, 3) + base)
            P.append(g.acc(p['attributes']['POSITION'])); J.append(g.acc(p['attributes']['JOINTS_0']).astype(np.int64))
            w = g.acc(p['attributes']['WEIGHTS_0']); Wt.append(w / w.sum(1, keepdims=True)); N.append(g.acc(p['attributes']['NORMAL']))
        self.P = np.concatenate(P); self.J = np.concatenate(J); self.W = np.concatenate(Wt); self.Nrm = np.concatenate(N)
        self.tris = np.concatenate(I) if I else np.zeros((0, 3), np.int64)
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


def scabbard_envelope(y):
    """Outer half-width / half-thickness (cm) of the scabbard at sword-space y: max over the leather and steel parts."""
    a = b = 0.0
    for part in [SCABBARD_LEATHER] + SCABBARD_STEEL:
        ys = [p[0] for p in part]
        if ys[0] - 1e-9 <= y <= ys[-1] + 1e-9: a = max(a, float(np.interp(y, ys, [p[1] for p in part]))); b = max(b, float(np.interp(y, ys, [p[2] for p in part])))
    return a, b


def scabbard_points(step=2.0, ring=16, y0=None, y1=None):
    """Sample points (sword space, cm) on the scabbard's outer surface (same lenticular section as class-equipment.js; the
    face cusps of the locket / chape edges are left out: they lie on the leather, inside this envelope)."""
    lo = SCABBARD_STEEL[0][0][0] if y0 is None else y0; hi = SCABBARD_STEEL[-1][-1][0] if y1 is None else y1; out = []
    for y in np.arange(lo, hi + 1e-6, step):
        a, b = scabbard_envelope(y); t = np.linspace(0, 2 * np.pi, ring, endpoint=False)
        cx = np.sign(np.cos(t)) * np.abs(np.cos(t)) ** SCABBARD_SECTION; cz = np.sign(np.sin(t)) * np.abs(np.sin(t)) ** SCABBARD_SECTION
        out.append(np.c_[SCABBARD_AXIS[0] + a * cx, np.full(ring, y), SCABBARD_AXIS[1] + b * cz])
    return np.concatenate(out)


def stow_matrix(guard=STOW_GUARD, theta=STOW_THETA, phi=STOW_PHI, roll=STOW_ROLL):
    """Sword space (cm) -> Blender rig frame at bind (m)."""
    Rb = stow_socket(guard, theta, phi, roll)[0]; M = np.eye(4); M[:3, :3] = Rb * 0.01; M[:3, 3] = guard; return M


def design_hangers(bind_blender, body_mask, hips_xy):
    """Hanger paths (actor space at model scale 1): belt lower edge -> over the hip plate -> locket / band surface.
    bind_blender: skinned bind-pose vertices in the Blender rig frame; body_mask: torso/legs/tasset vertices."""
    B = bind_blender[body_mask]; d = B[:, :2] - hips_xy; az = np.degrees(np.arctan2(-d[:, 0], d[:, 1])); r = np.linalg.norm(d, axis=1)
    def surface_r(z, a, dz=0.012, da=5.0):
        m = (np.abs(B[:, 2] - z) < dz) & (np.abs(az - a) < da); return float(r[m].max()) if m.any() else 0.0
    def at(z, a, rad): return np.array([hips_xy[0] - np.sin(np.radians(a)) * rad, hips_xy[1] + np.cos(np.radians(a)) * rad, z])
    M = stow_matrix(); out = []
    for a0, ring_y, width, buckle, tuck in zip(HANGER_BELT_AZ, HANGER_RING_Y, HANGER_WIDTH, HANGER_BUCKLE, HANGER_TUCK):
        top = at(HANGER_BELT_Z + tuck[1], a0, surface_r(HANGER_BELT_Z + tuck[1], a0) - tuck[0])
        ring = scabbard_points(1.0, 32, ring_y, ring_y); ringB = (M[:3, :3] @ ring.T).T + M[:3, 3]
        centre = (M[:3, :3] @ np.array([SCABBARD_AXIS[0], ring_y, SCABBARD_AXIS[1]])) + M[:3, 3]
        end = ringB[np.argmax(ringB[:, 2])]; end = end + (centre - end) * 0.04   # the ring's upper edge, tucked in
        path = []
        for t in np.linspace(0, 1, 7):
            p = top + (end - top) * t
            if 0 < t < 1:
                dp = p[:2] - hips_xy; a = float(np.degrees(np.arctan2(-dp[0], dp[1]))); rad = max(float(np.linalg.norm(dp)), surface_r(p[2], a) + HANGER_LIFT); p = at(p[2], a, rad)
            path.append([round(float(-p[0]), 3), round(float(p[2]), 3), round(float(p[1]), 3)])   # Blender rig frame -> actor space
        out.append({'path': path, 'width': width, 'buckle': buckle})
    return out


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


def crossings(Pw, tris, lines):
    """Number of line segments (k, 2, 3) that pass through the triangles (indices into Pw): a sheet (the cape) is
    penetrated only where the scabbard crosses it; the nearest-normal test of contact() cannot tell which side of a
    single-layer sheet a point is on."""
    lo = lines.reshape(-1, 3).min(0) - 0.02; hi = lines.reshape(-1, 3).max(0) + 0.02
    T = Pw[tris]; keep = np.all((T.max(1) > lo) & (T.min(1) < hi), axis=1); T = T[keep]
    if not len(T): return 0
    o = lines[:, 0][:, None]; dvec = (lines[:, 1] - lines[:, 0])[:, None]; v0 = T[None, :, 0]; e1 = T[None, :, 1] - v0; e2 = T[None, :, 2] - v0
    h = np.cross(dvec, e2); a = (e1 * h).sum(-1); ok = np.abs(a) > 1e-12; f = np.where(ok, 1 / np.where(ok, a, 1), 0); sv = o - v0
    u = f * (sv * h).sum(-1); q = np.cross(sv, e1); v = f * (dvec * q).sum(-1); t = f * (e2 * q).sum(-1)
    hit = ok & (u >= 0) & (v >= 0) & (u + v <= 1) & (t >= 0) & (t <= 1)
    return int(hit.any(1).sum())


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--glb', required=True); ap.add_argument('--labels', required=True)
    ap.add_argument('--fit-channel', action='store_true'); ap.add_argument('--json')
    ap.add_argument('--stowed-override', help='evaluate another stowed socket instead: px,py,pz,rx,ry,rz,scale,bone')
    ap.add_argument('--equipment', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../site/world3d/class-equipment.js'))
    ap.add_argument('--held-clips', default='Combat_Idle,Idle,Block,Cast,Attack_Smite,Weapon_Draw,Weapon_Sheathe')
    ap.add_argument('--held-soft-clips', default='Hit,Death,Attack_Slash,Attack_Heavy,Dodge,Talk')
    ap.add_argument('--stow-clips', default='Idle,Walk,Run,Walk_Start,Walk_Stop,Turn_Left,Turn_Right,Interact,Weapon_Draw,Weapon_Sheathe')
    ap.add_argument('--worn-clips', default='Idle,Walk,Run,Walk_Start,Walk_Stop,Turn_Left,Turn_Right,Interact,Weapon_Draw,Weapon_Sheathe,Combat_Idle,Block,Cast,Attack_Smite')
    ap.add_argument('--worn-soft-clips', default='Talk,Work,Drink,Hit,Death,Dodge,Attack_Slash,Attack_Heavy')
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
    # FALLEN_SCABBARD: stations must equal the constants above; hangers must equal design_hangers() (checked below).
    mj = re.search(r"export const FALLEN_SCABBARD=Object\.freeze\(\{\s*axis:(\[[^\]]*\]),\s*hilt:([0-9.]+),\s*leather:(\[.*?\]\]),\s*steel:(\[.*?\]\]\]),\s*hangers:(\[.*?\])\s*\}\);", src, re.S)
    if not mj: raise SystemExit('FALLEN_SCABBARD not found in ' + a.equipment)
    jsonish = lambda t: json.loads(re.sub(r'([{,])\s*([A-Za-z_]+):', r'\1"\2":', t))
    game_scab = {'axis': jsonish(mj.group(1)), 'hilt': float(mj.group(2)), 'leather': jsonish(mj.group(3)), 'steel': jsonish(mj.group(4))}
    game_hangers = jsonish(mj.group(5))
    mw = re.search(r"swap:Object\.freeze\(\{weapon_draw:([0-9.]+),weapon_sheathe:([0-9.]+)\}\)", src)
    if not mw or abs(float(mw.group(1)) - SWAP['Weapon_Draw']) > 1e-9 or abs(float(mw.group(2)) - SWAP['Weapon_Sheathe']) > 1e-9:
        fails.append('class-equipment.js FALLEN_LONGSWORD_SOCKETS.swap differs from SWAP')
    flat = lambda x: [float(v) for v in np.hstack([flat(i) for i in x])] if isinstance(x, (list, tuple)) else [float(x)]
    for key, mine in (('axis', list(SCABBARD_AXIS)), ('hilt', SCABBARD_HILT), ('leather', SCABBARD_LEATHER), ('steel', SCABBARD_STEEL)):
        fg, fm = flat(game_scab[key]), flat(mine)
        if len(fg) != len(fm) or not np.allclose(fg, fm): fails.append(f'class-equipment.js FALLEN_SCABBARD.{key} differs from sword-sockets.py')
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
    bindB = np.c_[rest[:, 0], -rest[:, 2], rest[:, 1]]; hipsW = worlds(g)[g.by_name['mixamorig:Hips']][:3, 3]
    hangers = design_hangers(bindB, (seg == 0) & ~hand, np.array([hipsW[0], -hipsW[2]]))
    out['hangers_derived'] = hangers; print('derived FALLEN_SCABBARD.hangers =', json.dumps(hangers).replace(' ', ''))
    if not a.stowed_override:
        same = len(hangers) == len(game_hangers) and all(np.shape(h['path']) == np.shape(gh['path']) and np.allclose(h['path'], gh['path'], atol=1.5e-3) and abs(h['width'] - gh['width']) < 1e-9 and abs(h['buckle'] - gh['buckle']) < 1e-9 for h, gh in zip(hangers, game_hangers))
        if not same: fails.append('class-equipment.js FALLEN_SCABBARD.hangers differ from design_hangers()')
    rh = g.by_name['mixamorig:RightHand']; sb = g.by_name[stow_bone]; W0 = worlds(g)
    Ry = np.diag([-1.0, 1, -1, 1]); T_act = np.eye(4); T_act[:3, :3] = euler_xyz(es) * stow_scale; T_act[:3, 3] = pa
    stow_rel = np.linalg.inv(W0[sb]) @ np.linalg.inv(Ry) @ T_act
    # Frames on which each sword is visible in game (SWAP = the hero sword's equipment swap fractions).
    HELD_WINDOW = {'Weapon_Draw': (SWAP['Weapon_Draw'], 1.0), 'Weapon_Sheathe': (0.0, SWAP['Weapon_Sheathe'])}
    STOW_WINDOW = {'Weapon_Draw': (0.0, SWAP['Weapon_Draw']), 'Weapon_Sheathe': (SWAP['Weapon_Sheathe'], 1.0)}
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
    scab_held = scabbard_points(4.0, 10)   # reported: the drawn blade vs the (empty) worn scabbard
    for cn in a.held_clips.split(',') + [c for c in a.held_soft_clips.split(',') if c]:
        an = g.anim(cn); sel, ts = frames(an, HELD_WINDOW.get(cn, (0, 1))); worst = {}; gated = cn in hard_held
        for t in sel:
            P, Nn, Wd = sk.skin(pose(g, an, t), normals=True); M = Wd[rh] @ S; A = (M @ np.c_[SP, np.ones(len(SP))].T).T[:, :3]
            frac = (t - ts[0]) / max(ts[-1] - ts[0], 1e-9)
            Sc = (Wd[sb] @ stow_rel @ np.c_[scab_held, np.ones(len(scab_held))].T).T[:, :3]; Bl = A[blade | guard][::2]
            dsc = float(np.sqrt(((Bl[:, None, :] - Sc[None]) ** 2).sum(-1)).min()) * 100
            w = worst.setdefault('scabbard', {'min_cm': 99.0, 'pen_cm': 0.0, 'at': None})
            if dsc < w['min_cm']: w['min_cm'] = round(dsc, 1); w['at'] = round(t, 3)
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
    # Stowed hilt (visible in the stow windows) and the worn scabbard + hangers (visible in every clip), both rigid on
    # the stow bone. Hangers come in actor space (model scale 1); the scabbard in sword space through stow_rel.
    hiltP = SP[SP[:, 1] < SCABBARD_HILT]; scabP = scabbard_points()
    hangP = []
    for h in game_hangers:
        q = np.array(h['path'], float); dense = np.concatenate([q[i] + (q[i + 1] - q[i]) * np.linspace(0, 1, 8, endpoint=False)[:, None] for i in range(len(q) - 1)] + [q[-1:]])
        t = (dense[:, 1] < HANGER_BELT_Z - 0.01).astype(float)   # 0 = the end tucked under the belt (excluded below)
        tan = np.gradient(dense, axis=0); tan /= np.linalg.norm(tan, axis=1, keepdims=True)
        outv = dense - np.array([0.0, 0.0, 0.0]); outv[:, 1] = 0; outv -= (outv * tan).sum(1, keepdims=True) * tan; outv /= np.linalg.norm(outv, axis=1, keepdims=True)
        side = np.cross(tan, outv) * h['width']; hangP.append((dense, t, side))
    tris_of = {k: sk.tris[np.all(m[sk.tris], axis=1)] for k, m in groups.items()}
    hang_rel = np.linalg.inv(W0[sb]) @ np.linalg.inv(Ry)
    tip = scabP[:, 1] > scabP[:, 1].max() - 4
    cape_tris = sk.tris[np.all(groups['cape'][sk.tris], axis=1)]
    ringsP = scabbard_points(2.0, 16).reshape(-1, 16, 3); scab_lines = np.stack([ringsP[:-1], ringsP[1:]], 2).reshape(-1, 2, 3)   # segments along the surface
    hard_worn = set(a.worn_clips.split(','))
    soft_worn = [c for c in a.worn_soft_clips.split(',') if c]
    swap_dist = {}
    for cn in a.worn_clips.split(',') + soft_worn:
        an = g.anim(cn); gated = cn in hard_worn; worst = {}; whang = {}; low = 9.0; ts = g.key_times(an); T = max(ts[-1] - ts[0], 1e-9)
        win = STOW_WINDOW.get(cn, (0, 1)) if cn in set(a.stow_clips.split(',')) | set(soft_worn) else (-1, -1)
        for t in ts:
            frac = (t - ts[0]) / T; P, Nn, Wd = sk.skin(pose(g, an, t), normals=True); M = Wd[sb] @ stow_rel
            Sc = (M @ np.c_[scabP, np.ones(len(scabP))].T).T[:, :3]; low = min(low, float(Sc[tip, 1].min()))
            parts = [('scabbard', Sc[::2])]
            if win[0] - 1e-6 <= frac <= win[1] + 1e-6: parts.append(('hilt', (M @ np.c_[hiltP, np.ones(len(hiltP))].T).T[:, :3][::2]))
            for gname, mask in groups.items():
                if gname == 'armR_noHand': continue
                for part, pts in parts:
                    d, pen = contact(P, Nn, mask, pts); w = worst.setdefault(gname, {'min_cm': 99.0, 'pen_cm': 0.0, 'at': None, 'crossings': 0})
                    if gname == 'armL' and pen > 0: w.setdefault('pen_by_part', {})[part] = max(w.get('pen_by_part', {}).get(part, 0.0), pen)
                    if gname == 'cape':   # single-layer sheet: count real crossings instead of the nearest-normal side
                        pen = 0.0; n = crossings(P, cape_tris, (M @ np.c_[scab_lines.reshape(-1, 3), np.ones(scab_lines.size // 3)].T).T[:, :3].reshape(scab_lines.shape)) if part == 'scabbard' else 0
                        if n > w['crossings']: w['crossings'] = n; w['at'] = f'{part} {frac:.0%}'
                    w['min_cm'] = min(w['min_cm'], d)
                    if pen > w['pen_cm']: w['pen_cm'] = pen; w['at'] = f'{part} {frac:.0%}'
                if gname == 'armL': continue
                for k, (dense, tt, side) in enumerate(hangP):
                    G = (Wd[sb] @ hang_rel @ np.c_[dense, np.ones(len(dense))].T).T[:, :3]; w = whang.setdefault(gname, {'min_cm': 99.0, 'crossings': 0, 'at': None})
                    d, _ = contact(P, Nn, mask, G[tt > 0.5]); w['min_cm'] = min(w['min_cm'], d)
                    # crossings of the strap's centre line and both edges (the belt end tucks under the belt by design)
                    Sd = (Wd[sb] @ hang_rel)[:3, :3] @ side.T; lines = []
                    for off in (-0.5, 0.0, 0.5):
                        E = G + off * Sd.T; sel = np.nonzero(tt > 0.5)[0]; lines.append(np.stack([E[sel[:-1]], E[sel[1:]]], 1))
                    n = crossings(P, tris_of[gname], np.concatenate(lines))
                    if n > w['crossings']: w['crossings'] = n; w['at'] = f'hanger{k} {frac:.0%}'
        stowed[cn] = {**worst, 'hangers': whang, 'lowest_m': round(low, 3), 'gated': gated}
        if gated:
            for gname in ('legs', 'torso_tabard', 'tasset', 'cape'):
                w = worst[gname]
                if w['min_cm'] < (CAPE_CLEAR if gname == 'cape' else WORN_CLEAR) or w['pen_cm'] > 0 or w['crossings']: fails.append(f'worn: hilt/scabbard {w["min_cm"]} cm / pen {w["pen_cm"]} cm / {w["crossings"]} sheet crossings ({w["at"]}) vs {gname} in {cn}')
                h = whang[gname]
                if h['crossings']: fails.append(f'worn: hanger crosses {gname} ({h["crossings"]} segments, {h["at"]}) in {cn}')
            floor = 0.15 if cn in set(a.stow_clips.split(',')) else 0.03
            if low < floor: fails.append(f'worn: scabbard tip {low:.3f} m above the ground in {cn} (min {floor})')
        print(f'WORN {cn:15s}{"" if gated else " (report)"} lowest {low:.3f} m ', '  '.join(f'{k}: {v["min_cm"]}cm pen {v["pen_cm"]}' + (f' x{v["crossings"]}' if k == 'cape' else '') + (f' ({v["at"]})' if k == 'armL' else '') for k, v in worst.items()),
              '| hangers', '  '.join(f'{k}: {v["min_cm"]}cm x{v["crossings"]}' for k, v in whang.items()))
    # Draw / sheathe plausibility: right-hand grip point vs the stowed grip centre at the swap and its closest approach.
    grip_s = np.array([SCABBARD_AXIS[0], -15.0, SCABBARD_AXIS[1], 1.0])
    for cn in ('Weapon_Draw', 'Weapon_Sheathe'):
        an = g.anim(cn); ts = g.key_times(an); T = ts[-1] - ts[0]; rows = []
        for f in np.linspace(0, 1, 51):
            Wd = worlds(g, pose(g, an, ts[0] + f * T)); hand_p = Wd[rh][:3, 3] + 0.6 * (Wd[g.by_name['mixamorig:RightHandMiddle1']][:3, 3] - Wd[rh][:3, 3])
            rows.append((round(float(f), 2), round(float(np.linalg.norm(hand_p - (Wd[sb] @ stow_rel @ grip_s)[:3])), 3)))
        at_swap = min(rows, key=lambda r: abs(r[0] - SWAP[cn])); best = min(rows, key=lambda r: r[1])
        swap_dist[cn] = {'swap': SWAP[cn], 'hand_to_hilt_m_at_swap': at_swap[1], 'closest': {'fraction': best[0], 'm': best[1]}}
        print(f'SWAP {cn}: right-hand grip {at_swap[1]:.2f} m from the stowed grip at the {SWAP[cn]:.0%} swap; closest {best[1]:.2f} m at {best[0]:.0%}')
    out['swap_hand_to_hilt'] = swap_dist
    out['held_blade_aim'] = aim
    out['known_clip_contacts'] = known
    for k in known: print('KNOWN', k)
    out.update({'held': held, 'stowed': stowed, 'failures': fails, 'ok': not fails})
    if a.json: json.dump(out, open(a.json, 'w'), indent=1)
    print('OK' if not fails else 'FAIL:\n  ' + '\n  '.join(fails))
    sys.exit(0 if not fails else 1)


if __name__ == '__main__':
    main()
