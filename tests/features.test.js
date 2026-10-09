import test from 'node:test';
import assert from 'node:assert/strict';
import { Maze, generateMaze, braidMaze } from '../js/core/maze.js';
import { solveBFS, solveDFS, visualEvents } from '../js/core/search.js';
import { serializeMaze, deserializeMaze } from '../js/core/io.js';
import { EditHistory } from '../js/core/history.js';
import { Timeline } from '../js/core/timeline.js';

test('braided maze creates more edges while staying connected', () => {
  for(const size of [9,15,21,31]) {
    const {maze}=generateMaze(size,()=>.6);
    const original=maze.openCount();
    const carved=braidMaze(maze,.25,()=>.5);
    assert.equal(maze.openCount(),original+carved.length);
    assert.ok(carved.length>0);
    assert.equal(solveDFS(maze).found,true);
    assert.equal(solveBFS(maze).found,true);
    assert.ok(solveBFS(maze).path.length<=solveDFS(maze).path.length);
  }
});
test('search events capture actual frontier data', () => {
  const {maze}=generateMaze(15,()=>.6);
  const dfs=solveDFS(maze),bfs=solveBFS(maze);
  assert.deepEqual(dfs.events[0].frontier,[maze.start]);
  assert.ok(dfs.events.every(e=>Array.isArray(e.frontier)));
  assert.ok(bfs.events.every(e=>Array.isArray(e.frontier)));
  assert.equal(bfs.events[0].cell,maze.start);
  assert.equal(visualEvents(dfs).length,dfs.events.length+dfs.path.length);
});
test('JSON maze roundtrip, corrupt files rejected', () => {
  const {maze}=generateMaze(15);
  const original=serializeMaze(maze);
  const restored=deserializeMaze(original);
  assert.deepEqual(Array.from(restored.cells),Array.from(maze.cells));
  assert.equal(restored.start,maze.start);
  assert.equal(restored.end,maze.end);
  assert.throws(()=>deserializeMaze('{oops'));
  const corrupt=JSON.parse(original);corrupt.cells[0]=4;
  assert.throws(()=>deserializeMaze(JSON.stringify(corrupt)));
  const overlapping=JSON.parse(original);overlapping.start=overlapping.end;
  assert.throws(()=>deserializeMaze(JSON.stringify(overlapping)));
});
test('editor undo/redo preserves endpoint and cells', () => {
  const maze=new Maze(9);
  maze.cells[maze.start]=0;maze.cells[maze.end]=0;
  const h=new EditHistory();const snap=h.snapshot(maze);
  maze.setWall(maze.index(4,4),false);
  maze.setEndpoint('start',maze.index(2,2));
  assert.equal(h.commit(snap,maze),true);
  assert.equal(h.undo(maze),true);
  assert.equal(maze.start,snap.start);
  assert.equal(maze.isOpen(maze.index(4,4)),false);
  assert.equal(h.redo(maze),true);
  assert.equal(maze.start,maze.index(2,2));
  assert.equal(maze.isOpen(maze.index(4,4)),true);
});
test('Timeline supports seeking backward, restoring states, and replay', () => {
  let next=0;const callbacks=new Map();
  globalThis.requestAnimationFrame=fn=>{callbacks.set(++next,fn);return next;};
  globalThis.cancelAnimationFrame=id=>{callbacks.delete(id);};
  const rendered=[];let done=0;
  const timeline=new Timeline(()=>90);
  timeline.start([1,2,3,4],{
    onStep:e=>rendered.push(e),onFrame:()=>{},onDone:()=>done++,
    onRebuild:(all,index)=>{rendered.length=0;rendered.push(...all.slice(0,index));},
  });
  timeline.seek(3);assert.deepEqual(rendered,[1,2,3]);assert.equal(timeline.state,'paused');
  timeline.back();assert.deepEqual(rendered,[1,2]);
  timeline.step();assert.deepEqual(rendered,[1,2,3]);
  timeline.seek(4);assert.equal(timeline.state,'finished');assert.equal(done,1);
  timeline.replay();assert.equal(timeline.state,'playing');assert.deepEqual(rendered,[]);
  timeline.skip();assert.deepEqual(rendered,[1,2,3,4]);assert.equal(done,2);
});
