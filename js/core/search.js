/** Pure traversal algorithms. Every trace event captures the real frontier. */
function reconstruct(parent, start, end) {
  const path = [end];
  for (let cell = end; cell !== start;) {
    cell = parent[cell];
    if (cell === -1) return [];
    path.push(cell);
  }
  return path.reverse();
}
function emptyResult(t0) {
  return { found: false, path: [], events: [], expanded: 0, backtracks: 0, computeMs: performance.now() - t0 };
}
export function solveDFS(maze) {
  const t0 = performance.now();
  if (!maze.isOpen(maze.start) || !maze.isOpen(maze.end)) return emptyResult(t0);
  const discovered = new Uint8Array(maze.cells.length);
  const parent = new Int32Array(maze.cells.length).fill(-1);
  const stack = [{ cell: maze.start, neighbors: maze.neighbors(maze.start), offset: 0 }];
  const events = [{ type: 'visit', cell: maze.start, frontier: [maze.start], action: 'Push start onto the stack' }];
  discovered[maze.start] = 1;
  let expanded = 1, backtracks = 0, found = false;
  while (stack.length) {
    const frame = stack[stack.length - 1];
    if (frame.cell === maze.end) { found = true; break; }
    if (frame.offset === frame.neighbors.length) {
      stack.pop(); backtracks++;
      events.push({type: 'backtrack', cell: frame.cell, to: stack.at(-1)?.cell ?? -1,
        frontier: stack.map(f => f.cell), action: 'Dead end → pop the stack and return'});
      continue;
    }
    const next = frame.neighbors[frame.offset++];
    if (discovered[next]) continue;
    discovered[next] = 1;
    parent[next] = frame.cell;
    stack.push({ cell: next, neighbors: maze.neighbors(next), offset: 0 });
    expanded++;
    events.push({type: 'visit', cell: next, frontier: stack.map(f => f.cell), action: 'Visit neighbor → push onto stack'});
  }
  return {found, path: found ? reconstruct(parent, maze.start, maze.end) : [], events,
    expanded, backtracks, computeMs: performance.now() - t0};
}
export function solveBFS(maze) {
  const t0 = performance.now();
  if (!maze.isOpen(maze.start) || !maze.isOpen(maze.end)) return emptyResult(t0);
  const discovered = new Uint8Array(maze.cells.length);
  const parent = new Int32Array(maze.cells.length).fill(-1);
  const queue = [maze.start];
  discovered[maze.start] = 1;
  const events = [];
  let head = 0, found = false;
  while (head < queue.length) {
    const cell = queue[head++];
    if (cell === maze.end) found = true;
    if (!found) {
      for (const next of maze.neighbors(cell)) {
        if (discovered[next]) continue;
        discovered[next] = 1;
        parent[next] = cell;
        queue.push(next);
      }
    }
    events.push({type: 'visit', cell, frontier: queue.slice(head),
      action: found ? 'Goal reached → reconstruct path' : 'Dequeue a cell → enqueue new neighbors'});
    if (found) break;
  }
  return {found, path: found ? reconstruct(parent, maze.start, maze.end) : [], events,
    expanded: events.length, backtracks: 0, computeMs: performance.now() - t0};
}
export function solve(maze, algorithm) {
  if (algorithm === 'dfs') return solveDFS(maze);
  if (algorithm === 'bfs') return solveBFS(maze);
  throw new Error(`Unknown search algorithm: ${algorithm}`);
}
/** Add route-reveal events only after the search finishes. */
export function visualEvents(result) {
  return [...result.events, ...result.path.map(cell => ({ type: 'path', cell, action: 'Trace the solved route' }))];
}
