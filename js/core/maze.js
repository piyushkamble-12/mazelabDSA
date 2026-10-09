/** The maze is an unweighted graph: open cells are vertices and orthogonal links are edges. */
export class Maze {
  constructor(size = 21, cells = null) {
    if (!Number.isInteger(size) || size < 5 || size % 2 === 0) {
      throw new Error('Maze size must be an odd integer greater than or equal to 5.');
    }
    this.size = size;
    this.cells = cells ? Uint8Array.from(cells) : new Uint8Array(size * size).fill(1);
    if (this.cells.length !== size * size) throw new Error('Wrong cell count.');
    this.start = this.index(1, 1);
    this.end = this.index(size - 2, size - 2);
  }

  index(row, column) { return row * this.size + column; }
  coord(index) { return [Math.floor(index / this.size), index % this.size]; }
  inBounds(row, column) { return row >= 0 && column >= 0 && row < this.size && column < this.size; }
  isOpen(index) { return index >= 0 && index < this.cells.length && this.cells[index] === 0; }
  openCount() { let n = 0; for (const cell of this.cells) if (cell === 0) n++; return n; }
  neighbors(index) {
    const [r, c] = this.coord(index);
    // Explicit order makes DFS/BFS deterministic and easy to explain in a viva.
    return [[r, c + 1], [r + 1, c], [r, c - 1], [r - 1, c]]
      .filter(([nr, nc]) => this.inBounds(nr, nc))
      .map(([nr, nc]) => this.index(nr, nc))
      .filter(next => this.isOpen(next));
  }
  setWall(index, wall) {
    if (index < 0 || index >= this.cells.length || index === this.start || index === this.end) return false;
    if (this.cells[index] === Number(wall)) return false;
    this.cells[index] = Number(wall);
    return true;
  }
  setEndpoint(kind, index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.cells.length) return false;
    if (kind === 'start' && index === this.end) return false;
    if (kind === 'end' && index === this.start) return false;
    if (kind !== 'start' && kind !== 'end') return false;
    this.cells[index] = 0;
    this[kind] = index;
    return true;
  }
}

/** Randomized iterative DFS (recursive backtracker) constructs a perfect maze.
 * `events` are visual-only; the returned maze is the completed authoritative maze. */
export function generateMaze(size, random = Math.random) {
  const maze = new Maze(size);
  const first = maze.start;
  maze.cells[first] = 0;
  const stack = [first];
  const events = [{ type: 'carve', cells: [first], cell: first }];
  while (stack.length) {
    const cell = stack[stack.length - 1];
    const [r, c] = maze.coord(cell);
    const choices = [[r - 2, c], [r, c + 2], [r + 2, c], [r, c - 2]]
      .filter(([nr, nc]) => nr > 0 && nc > 0 && nr < size - 1 && nc < size - 1)
      .map(([nr, nc]) => maze.index(nr, nc))
      .filter(i => maze.cells[i] === 1);
    if (choices.length === 0) {
      stack.pop();
      events.push({ type: 'retrace', cell });
      continue;
    }
    const next = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
    const [nr, nc] = maze.coord(next);
    const between = maze.index((r + nr) / 2, (c + nc) / 2);
    maze.cells[between] = 0;
    maze.cells[next] = 0;
    stack.push(next);
    events.push({ type: 'carve', cells: [between, next], cell: next });
  }
  return { maze, events };
}

/** Adds optional loops to a perfect maze by removing a selection of corridor walls.
 * A perfect maze has one unique path; braiding creates alternate routes for BFS vs DFS. */
export function braidMaze(maze, density = 0.2, random = Math.random) {
  if (!Number.isFinite(density) || density < 0 || density > 1) throw new Error('Invalid loop density');
  const candidates = [];
  for (let r = 1; r < maze.size - 1; r++) {
    for (let c = 1; c < maze.size - 1; c++) {
      if ((r + c) % 2 !== 1) continue;
      const i = maze.index(r, c);
      if (maze.isOpen(i)) continue;
      const horizontal = maze.isOpen(maze.index(r, c-1)) && maze.isOpen(maze.index(r, c+1));
      const vertical = maze.isOpen(maze.index(r-1, c)) && maze.isOpen(maze.index(r+1, c));
      if (horizontal || vertical) candidates.push(i);
    }
  }
  // Fisher–Yates provides an unbiased randomized subset of candidate walls.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const changed = [];
  for (const index of candidates.slice(0, Math.round(candidates.length * density))) {
    maze.cells[index] = 0;
    changed.push(index);
  }
  return changed;
}
