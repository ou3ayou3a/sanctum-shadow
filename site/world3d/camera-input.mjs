export const CAMERA_KEY_DIRECTIONS = Object.freeze({
  KeyW: Object.freeze({ forward: 1, right: 0 }),
  KeyS: Object.freeze({ forward: -1, right: 0 }),
  // The project deliberately uses the requested mirrored horizontal mapping.
  KeyA: Object.freeze({ forward: 0, right: 1 }),
  KeyD: Object.freeze({ forward: 0, right: -1 }),
});

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
