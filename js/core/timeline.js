/** Frame-timed trace player with pause, seek, reverse-step and replay. */
export class Timeline {
  constructor(getSpeed) {
    this.getSpeed = getSpeed;
    this.events = [];
    this.index = 0;
    this.state = 'idle';
    this.raf = 0;
    this.last = 0;
    this.credit = 0;
    this.onStep = () => {};
    this.onFrame = () => {};
    this.onDone = () => {};
    this.onRebuild = () => {};
    this.tick = this.tick.bind(this);
  }
  get progress() { return this.events.length ? this.index / this.events.length : 0; }
  get active() { return this.state === 'playing' || this.state === 'paused'; }
  start(events, { onStep, onFrame, onDone, onRebuild = () => {} }) {
    this.cancel();
    this.events = events;
    this.index = 0;
    this.onStep = onStep;
    this.onFrame = onFrame;
    this.onDone = onDone;
    this.onRebuild = onRebuild;
    this.state = 'playing';
    if (!events.length) { this.finish(); return; }
    this.raf = requestAnimationFrame(this.tick);
    this.onFrame(0);
  }
  tick(timestamp) {
    if (this.state !== 'playing') return;
    const delta = this.last === 0 ? 16 : Math.min(80, timestamp - this.last);
    this.last = timestamp;
    const rate = 5 * (2 ** (Number(this.getSpeed()) / 16));
    this.credit = Math.min(this.credit + delta * rate / 1000, Math.max(rate / 8, 1));
    const limit = Math.min(110, Math.floor(this.credit));
    for (let n = 0; n < limit && this.index < this.events.length; n++) {
      this.onStep(this.events[this.index++]); this.credit--;
    }
    this.onFrame(this.progress);
    if (this.index >= this.events.length) { this.finish(); return; }
    this.raf = requestAnimationFrame(this.tick);
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    cancelAnimationFrame(this.raf);
    this.raf = 0; this.last = 0;
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.last = 0; this.credit = 0;
    this.raf = requestAnimationFrame(this.tick);
  }
  step() {
    if (this.state === 'playing' || this.state === 'idle') return;
    if (this.state === 'finished') return;
    if (this.index < this.events.length) this.onStep(this.events[this.index++]);
    this.onFrame(this.progress);
    if (this.index >= this.events.length) this.finish();
  }
  seek(index) {
    if (!this.events.length) return;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0; this.credit = 0;
    this.index = Math.max(0, Math.min(this.events.length, Math.round(index)));
    this.state = 'paused';
    this.onRebuild(this.events, this.index);
    this.onFrame(this.progress);
    if (this.index >= this.events.length) this.finish();
  }
  back() { if (this.state !== 'idle') this.seek(this.index - 1); }
  replay() { if (this.events.length) { this.seek(0); this.resume(); } }
  skip() {
    if (!this.active) return;
    cancelAnimationFrame(this.raf);
    while (this.index < this.events.length) this.onStep(this.events[this.index++]);
    this.onFrame(1);
    this.finish();
  }
  finish() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.state = 'finished';
    this.onDone();
  }
  cancel() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.state = 'idle';
    this.events = [];
    this.index = 0; this.credit = 0;
  }
}
