import test from 'node:test';
import assert from 'node:assert/strict';
import { Maze, generateMaze } from '../js/core/maze.js';
import { solveDFS, solveBFS } from '../js/core/search.js';

function assertValidPath(maze, path) {
  assert.equal(path[0], maze.start);
  assert.equal(path.at(-1), maze.end);
  for (const cell of path) assert.equal(maze.isOpen(cell), true);
  for (let i = 1; i < path.length; i++) {
    const [r0,c0] = maze.coord(path[i-1]), [r1,c1] = maze.coord(path[i]);
    assert.equal(Math.abs(r1-r0) + Math.abs(c1-c0), 1);
  }
}
function reachable(maze) {
  const visited = new Set([maze.start]);
  const queue = [maze.start];
  for (let i = 0; i < queue.length; i++) {
    for (const next of maze.neighbors(queue[i])) if (!visited.has(next)) {visited.add(next);queue.push(next);}
  }
  return visited;
}
for (const size of [5, 9, 15, 21, 31, 41]) {
  test(`generated ${size}×${size} maze is perfect and both search algorithms solve it`, () => {
    for (let trial = 0; trial < 8; trial++) {
      const {maze, events} = generateMaze(size);
      assert.equal(maze.isOpen(maze.start),true);
      assert.equal(maze.isOpen(maze.end),true);
      assert.equal(reachable(maze).size, maze.openCount());
      let edges = 0;
      for (let cell = 0; cell < maze.cells.length; cell++) {
        if (!maze.isOpen(cell)) continue;
        edges += maze.neighbors(cell).length;
      }
      assert.equal(edges/2, maze.openCount()-1, 'perfect maze has a unique simple path');
      const d = solveDFS(maze), b = solveBFS(maze);
      assert.equal(d.found, true); assert.equal(b.found, true);
      assertValidPath(maze, d.path); assertValidPath(maze, b.path);
      assert.equal(d.path.length, b.path.length, 'perfect maze yields same route length');
      assert.equal(d.events.filter(e=>e.type==='visit').length, d.expanded);
      assert.equal(d.events.filter(e=>e.type==='backtrack').length, d.backtracks);
      assert.equal(events.filter(e=>e.type==='carve').length, (size-1)*(size-1)/4);
    }
  });
}
test('editing a maze can disconnect the destination without crashing', () => {
  const {maze} = generateMaze(9, () => .4);
  for (let i = 0; i < maze.cells.length; i++) if (i !== maze.start && i !== maze.end) maze.cells[i] = 1;
  assert.equal(solveDFS(maze).found,false);
  assert.equal(solveBFS(maze).found,false);
});
test('BFS always returns shortest route when cycles are introduced', () => {
  const maze = new Maze(9);
  for (let r=1; r<8; r++) for (let c=1;c<8;c++) maze.cells[maze.index(r,c)] = 0;
  const d=solveDFS(maze), b=solveBFS(maze);
  assertValidPath(maze, d.path); assertValidPath(maze, b.path);
  assert.equal(b.path.length-1,12);
  assert.ok(d.path.length>=b.path.length);
});
test('maze model protects endpoints and validates positions', () => {
  const maze=new Maze(9);
  maze.cells[maze.start]=0;maze.cells[maze.end]=0;
  assert.equal(maze.setWall(maze.start,true),false);
  assert.equal(maze.setWall(maze.end,true),false);
  assert.equal(maze.setEndpoint('end',maze.start),false);
  assert.equal(maze.setEndpoint('start',999),false);
  assert.equal(maze.setEndpoint('start',maze.index(2,2)),true);
  assert.equal(maze.isOpen(maze.start),true);
});
