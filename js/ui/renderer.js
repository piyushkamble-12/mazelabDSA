/** Canvas presentation only. No algorithm or DOM control logic lives here. */
export class MazeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layout = { left: 0, top: 0, cell: 1, dimension: 1 };
    this.width = 0;
    this.height = 0;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * pixelRatio);
    this.canvas.height = Math.round(rect.height * pixelRatio);
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
  }
  hitTest(event, maze) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { left, top, cell } = this.layout;
    const col = Math.floor((x - left) / cell);
    const row = Math.floor((y - top) / cell);
    return maze.inBounds(row, col) ? maze.index(row, col) : -1;
  }
  draw(maze, overlay = {}) {
    if (!this.width || !this.height) this.resize();
    const ctx = this.ctx;
    const { width: w, height: h } = this;
    ctx.clearRect(0, 0, w, h);
    const pad = Math.max(13, Math.min(34, w * 0.042));
    const cell = Math.min((w - pad * 2) / maze.size, (h - pad * 2) / maze.size);
    const dimension = cell * maze.size;
    const left = (w - dimension) / 2;
    const top = (h - dimension) / 2;
    this.layout = { left, top, cell, dimension };
    ctx.fillStyle = '#dae2f0';
    ctx.beginPath();
    ctx.roundRect(left - 5, top - 5, dimension + 10, dimension + 10, 13);
    ctx.fill();
    ctx.fillStyle = '#f7f9fd';
    ctx.fillRect(left, top, dimension, dimension);

    // The race uses a distinct tint for each algorithm; the main board keeps its neutral palette.
    const visitedColor = overlay.theme === 'bfs' ? '#b5e8df' : '#bfcbf7';
    const pathColor = overlay.theme === 'dfs' ? '#796dd8' : '#38b6a4';
    const visited = overlay.visited || new Set();
    const backtracked = overlay.backtracked || new Set();
    const path = overlay.path || new Set();
    const now = performance.now();
    const fadeIn = (timestamp, duration) => timestamp == null ? 1 : Math.min(1, Math.max(0, (now - timestamp) / duration));
    const blend = (from, to, t) => {
      const a = from.match(/\w\w/g).map(h => parseInt(h, 16));
      const b = to.match(/\w\w/g).map(h => parseInt(h, 16));
      return `rgb(${a.map((channel, i) => Math.round(channel + (b[i] - channel) * t)).join(',')})`;
    };
    const tint = (from, to, timestamp, duration) => {
      const t = fadeIn(timestamp, duration);
      return t >= 1 ? to : blend(from, to, t);
    };
    const cellGap = cell > 13 ? 0.7 : 0.3;
    for (let i = 0; i < maze.cells.length; i++) {
      const r = Math.floor(i / maze.size), c = i % maze.size;
      const x = left + c * cell, y = top + r * cell;
      let fill = maze.cells[i] === 1 ? '#28334d' : '#ffffff';
      if (maze.cells[i] === 0 && overlay.carvedAt?.has(i)) fill = tint('#ddd9fa', '#ffffff', overlay.carvedAt.get(i), 350);
      if (maze.cells[i] === 0 && visited.has(i)) fill = tint('#fff8da', visitedColor, overlay.visitAt?.get(i), 250);
      if (maze.cells[i] === 0 && backtracked.has(i)) fill = '#e1e6f6';
      if (maze.cells[i] === 0 && path.has(i)) fill = tint('#d9f6ed', pathColor, overlay.pathAt?.get(i), 260);
      if (i === overlay.current && !path.has(i)) fill = '#f7b65e';
      ctx.fillStyle = fill;
      ctx.fillRect(x + cellGap / 2, y + cellGap / 2, cell - cellGap, cell - cellGap);
    }

    if (overlay.current != null && overlay.current >= 0 && maze.isOpen(overlay.current)) {
      const i = overlay.current, r = Math.floor(i / maze.size), c = i % maze.size;
      const x = left + (c + 0.5) * cell, y = top + (r + 0.5) * cell;
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 166, 69, 0.48)';
      ctx.lineWidth = Math.max(2, cell * .15);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, cell * .35), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (maze.isOpen(maze.start)) this.drawEndpoint(maze.start, maze, 'S', '#177f72');
    if (maze.isOpen(maze.end)) this.drawEndpoint(maze.end, maze, 'E', '#e07565');
    if (overlay.mode === 'play' && overlay.player != null) {
      const r = Math.floor(overlay.player / maze.size), c = overlay.player % maze.size;
      const x = left + (c + .5) * cell, y = top + (r + .5) * cell;
      ctx.fillStyle = '#7154ca';
      ctx.beginPath();ctx.arc(x, y, cell * .38, 0, Math.PI * 2);ctx.fill();
      ctx.strokeStyle = '#fff';ctx.lineWidth = Math.max(1.3, cell * .09);ctx.stroke();
    }
    if (overlay.mode === 'edit' && overlay.hovered != null && overlay.hovered >= 0) {
      const r = Math.floor(overlay.hovered / maze.size), c = overlay.hovered % maze.size;
      ctx.lineWidth = Math.max(2, cell * .12);
      ctx.strokeStyle = '#6676d9';
      ctx.strokeRect(left + c * cell + 1, top + r * cell + 1, cell - 2, cell - 2);
    }
  }
  drawEndpoint(i, maze, letter, color) {
    const { left, top, cell } = this.layout;
    const r = Math.floor(i / maze.size), c = i % maze.size;
    const x = left + (c + 0.5) * cell, y = top + (r + 0.5) * cell;
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();ctx.roundRect(x - cell * .43, y - cell * .43, cell * .86, cell * .86, Math.min(7, cell * .23));ctx.fill();
    if (cell >= 11) {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.max(8, cell * .51)}px system-ui, sans-serif`;
      ctx.fillText(letter, x, y + .5);
    }
  }
}
