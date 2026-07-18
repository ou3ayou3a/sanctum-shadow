export const CAMERA_KEY_DIRECTIONS = Object.freeze({
  KeyW: Object.freeze({ forward: 1, right: 0 }),
  KeyS: Object.freeze({ forward: -1, right: 0 }),
  KeyA: Object.freeze({ forward: 0, right: -1 }),
  KeyD: Object.freeze({ forward: 0, right: 1 }),
});

const CAMERA_KEY_ALIASES = Object.freeze({
  w: 'KeyW',
  s: 'KeyS',
  a: 'KeyA',
  d: 'KeyD',
});

export function cameraKeyCode(input) {
  const code = String(input?.code || input || '');
  if (CAMERA_KEY_DIRECTIONS[code]) return code;
  return CAMERA_KEY_ALIASES[String(input?.key || input || '').toLowerCase()] || null;
}

export function cameraPanAxes(pressedCodes) {
  let forward = 0;
  let right = 0;
  for (const code of pressedCodes || []) {
    const direction = CAMERA_KEY_DIRECTIONS[code];
    if (!direction) continue;
    forward += direction.forward;
    right += direction.right;
  }
  const length = Math.hypot(forward, right);
  if (length > 1) {
    forward /= length;
    right /= length;
  }
  return { forward, right };
}

export function cameraWorldPan(step, forwardVector) {
  const x = Number(forwardVector?.x) || 0;
  const z = Number(forwardVector?.z) || 0;
  const length = Math.hypot(x, z);
  const forwardX = length > 0.001 ? x / length : 0;
  const forwardZ = length > 0.001 ? z / length : -1;
  const rightX = -forwardZ;
  const rightZ = forwardX;
  const worldX = forwardX * (Number(step?.forward) || 0) + rightX * (Number(step?.right) || 0);
  const worldZ = forwardZ * (Number(step?.forward) || 0) + rightZ * (Number(step?.right) || 0);
  return { x: Math.abs(worldX) < 1e-12 ? 0 : worldX, z: Math.abs(worldZ) < 1e-12 ? 0 : worldZ };
}

export function cameraPanStep(pressedCodes, deltaSeconds, speed = 8) {
  const axes = cameraPanAxes(pressedCodes);
  const distance = Math.max(0, Number(deltaSeconds) || 0) * Math.max(0, Number(speed) || 0);
  return { forward: axes.forward * distance, right: axes.right * distance };
}

export function clampCameraPan(x, z, maxDistance = 14) {
  const limit = Math.max(0, Number(maxDistance) || 0);
  const length = Math.hypot(x, z);
  if (!limit || length <= limit) return { x, z };
  const scale = limit / length;
  return { x: x * scale, z: z * scale };
}
