import test from 'node:test';
import assert from 'node:assert/strict';
import { Timeline } from '../js/core/timeline.js';

test('Timeline supports pause, one-step, resume and completion', () => {
  let next = 0;
  const callbacks = new Map();
  globalThis.requestAnimationFrame = callback => { const id = ++next; callbacks.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => {callbacks.delete(id);};
  const flush = time => {
    const [id, fn] = callbacks.entries().next().value ?? [];
    if (fn) { callbacks.delete(id); fn(time); }
  };
  let steps = [];
  let done = 0;
  const timeline = new Timeline(() => 25);
  timeline.start([1,2,3,4,5], {
    onStep: event => steps.push(event), onFrame: () => {}, onDone: () => {done++;},
  });
  flush(16);
  timeline.pause();
  const before = steps.length;
  timeline.step();
  assert.equal(steps.length,before+1);
  assert.equal(timeline.state,'paused');
  timeline.resume();
  flush(32); flush(48); flush(64); flush(80); flush(96);
  if (timeline.active) timeline.skip();
  assert.deepEqual(steps,[1,2,3,4,5]);
  assert.equal(done,1);
  assert.equal(timeline.state,'finished');
});
test('Timeline cancel prevents stale completion callbacks', () => {
  globalThis.requestAnimationFrame = () => 7;
  globalThis.cancelAnimationFrame = () => {};
  const timeline = new Timeline(() => 50);
  let completed = 0;
  timeline.start([1,2,3], {onStep:()=>{},onFrame:()=>{},onDone:()=>completed++});
  timeline.cancel();
  assert.equal(timeline.active,false);
  assert.equal(completed,0);
});
