export class NavigationGrid {
  constructor({ minX, maxX, minZ, maxZ, cellSize = 1, obstacles = [], padding = .55 }) {
    this.minX = minX; this.maxX = maxX; this.minZ = minZ; this.maxZ = maxZ;
    this.cellSize = cellSize; this.padding = padding; this.obstacles = obstacles;
    this.columns = Math.floor((maxX - minX) / cellSize) + 1;
    this.rows = Math.floor((maxZ - minZ) / cellSize) + 1;
  }

  cellAt(point) {
    return {
      x: Math.max(0, Math.min(this.columns - 1, Math.round((point.x - this.minX) / this.cellSize))),
      z: Math.max(0, Math.min(this.rows - 1, Math.round((point.z - this.minZ) / this.cellSize))),
    };
  }

  pointAt(cell) {
    return { x: this.minX + cell.x * this.cellSize, y: 0, z: this.minZ + cell.z * this.cellSize };
  }

  isBlocked(cell) {
    const p = this.pointAt(cell);
    return this.obstacles.some(o => Math.abs(p.x - o.x) <= o.hw + this.padding && Math.abs(p.z - o.z) <= o.hd + this.padding);
  }

  nearestOpen(cell) {
    if (!this.isBlocked(cell)) return cell;
    for (let radius = 1; radius < 8; radius++) {
      for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const candidate = { x: cell.x + dx, z: cell.z + dz };
        if (this.inBounds(candidate) && !this.isBlocked(candidate)) return candidate;
      }
    }
    return cell;
  }

  inBounds(cell) {
    return cell.x >= 0 && cell.z >= 0 && cell.x < this.columns && cell.z < this.rows;
  }

  findPath(startPoint, endPoint) {
    const start = this.nearestOpen(this.cellAt(startPoint));
    const requestedGoal = this.cellAt(endPoint);
    const goal = this.nearestOpen(requestedGoal);
    const adjustedGoal = goal.x !== requestedGoal.x || goal.z !== requestedGoal.z;
    const key = c => `${c.x},${c.z}`;
    const heuristic = c => Math.hypot(goal.x - c.x, goal.z - c.z);
    const open = [{ ...start, g: 0, f: heuristic(start) }];
    const cameFrom = new Map();
    const best = new Map([[key(start), 0]]);
    const closed = new Set();
    const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      const currentKey = key(current);
      if (closed.has(currentKey)) continue;
      if (current.x === goal.x && current.z === goal.z) {
        const cells = [goal]; let cursor = currentKey;
        while (cameFrom.has(cursor)) { const previous = cameFrom.get(cursor); cells.push(previous); cursor = key(previous); }
        cells.reverse();
        const points = cells.map(c => this.pointAt(c));
        if (!adjustedGoal) points[points.length - 1] = { x:endPoint.x, y:0, z:endPoint.z };
        return this.simplify(points);
      }
      closed.add(currentKey);
      for (const [dx, dz] of directions) {
        const next = { x:current.x + dx, z:current.z + dz };
        if (!this.inBounds(next) || this.isBlocked(next)) continue;
        if (dx && dz && (this.isBlocked({x:current.x+dx,z:current.z}) || this.isBlocked({x:current.x,z:current.z+dz}))) continue;
        const nextKey = key(next); const score = current.g + (dx && dz ? Math.SQRT2 : 1);
        if (score >= (best.get(nextKey) ?? Infinity)) continue;
        best.set(nextKey, score); cameFrom.set(nextKey, {x:current.x,z:current.z});
        open.push({ ...next, g:score, f:score + heuristic(next) });
      }
    }
    return [];
  }

  simplify(points) {
    if (points.length < 3) return points;
    const result = [points[0]];
    let previousDirection = null;
    for (let i = 1; i < points.length; i++) {
      const direction = `${Math.sign(points[i].x-points[i-1].x)},${Math.sign(points[i].z-points[i-1].z)}`;
      if (previousDirection && direction !== previousDirection) result.push(points[i-1]);
      previousDirection = direction;
    }
    result.push(points[points.length-1]);
    return result;
  }
}
