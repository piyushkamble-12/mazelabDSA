const byId = id => document.getElementById(id);
export class AppView {
  constructor() {
    this.elements = Object.fromEntries([
      'generate', 'solve', 'pause', 'step', 'reset', 'skip', 'compare', 'size',
      'speed', 'speedValue', 'algorithm', 'animated', 'visitedStat', 'pathStat',
      'backtrackStat', 'computeStat', 'boardStatus', 'boardDetail', 'statusDot',
      'progressBar', 'progressWrap', 'modeHint', 'brushTools', 'brush', 'playTools',
      'playerSteps', 'restart', 'comparison', 'dfsExplored', 'bfsExplored',
      'dfsPath', 'bfsPath', 'dfsTime', 'bfsTime', 'comparisonInsight', 'toast',
      'board', 'boardCard', 'gridLabel', 'workspaceLabel', 'algorithmDescription',
      'helpToggle', 'helpContent', 'clearComparison', 'mazeStyle', 'saveMaze', 'loadMaze', 'mazeFile',
      'undoEdit', 'redoEdit', 'quickGenerate', 'quickSolve', 'quickPause', 'quickRace',
      'timelineSeek', 'stepCounter', 'backStep', 'replay', 'frontierType',
      'frontierLabel', 'frontierCount', 'frontierItems', 'decisionTitle', 'decisionDetail',
      'decisionCode', 'racePanel', 'raceDfsBoard', 'raceBfsBoard', 'raceDfsVisited',
      'raceBfsVisited', 'raceDfsResult', 'raceBfsResult', 'raceNote', 'raceClose',
    ].map(id => [id, byId(id)]));
    this.toastTimer = null;
  }
  get(id) { return this.elements[id]; }
  on(id, event, handler) { this.get(id).addEventListener(event, handler); }
  status(text, detail = '', tone = 'ready') {
    this.get('boardStatus').textContent = text;
    this.get('boardDetail').textContent = detail;
    this.get('statusDot').dataset.tone = tone;
  }
  toast(message) {
    const node = this.get('toast');
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => node.classList.remove('visible'), 2700);
  }
  stats({visited = 0, path = 0, backtracks = 0, time = 0}) {
    this.get('visitedStat').textContent = visited.toLocaleString();
    this.get('pathStat').textContent = path.toLocaleString();
    this.get('backtrackStat').textContent = backtracks.toLocaleString();
    this.get('computeStat').textContent = `${time.toFixed(2)} ms`;
  }
  progress(value) {
    this.get('progressBar').style.width = `${Math.max(0, Math.min(100, value * 100))}%`;
    this.get('progressWrap').setAttribute('aria-valuenow', Math.round(value * 100));
  }
  setMode(mode) {
    document.querySelectorAll('[data-mode]').forEach(b => {
      const selected = b.dataset.mode === mode;
      b.classList.toggle('selected', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    this.get('brushTools').hidden = mode !== 'edit';
    this.get('playTools').hidden = mode !== 'play';
    this.get('board').style.cursor = mode === 'edit' ? 'crosshair' : 'default';
    this.get('modeHint').textContent = {
      view: 'Inspect the maze, then watch an algorithm explore it.',
      edit: 'Paint walls, erase corridors, or move start and end. Drag to draw.',
      play: 'Find the finish using WASD, arrow keys, or the touch controls.',
    }[mode];
  }
  setBusy(kind, paused = false) {
    const busy = kind !== null;
    this.get('generate').disabled = false; // Generate always interrupts the previous operation.
    this.get('solve').disabled = busy;
    this.get('compare').disabled = busy;
    this.get('size').disabled = busy;
    this.get('algorithm').disabled = busy;
    this.get('pause').disabled = !busy;
    this.get('step').disabled = !busy || !paused;
    this.get('skip').hidden = kind !== 'generate';
    this.get('pause').textContent = paused ? '▶ Resume' : 'Ⅱ Pause';
    this.get('pause').setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation');
    this.get('quickPause').disabled = !busy;
    this.get('quickPause').innerHTML = paused ? '▶ <span>Resume</span>' : 'Ⅱ <span>Pause</span>';
    this.get('quickSolve').disabled = busy;
    this.get('quickRace').disabled = busy;
    this.get('saveMaze').disabled = busy;
    this.get('loadMaze').disabled = busy;
    this.get('mazeStyle').disabled = busy;
    document.querySelectorAll('[data-mode]').forEach(b => b.disabled = busy);
    this.get('reset').textContent = busy ? '■ Stop' : '↺ Clear trail';
    this.get('progressWrap').classList.toggle('in-progress', busy);
  }
  history(canUndo, canRedo) {
    this.get('undoEdit').disabled = !canUndo;
    this.get('redoEdit').disabled = !canRedo;
  }
  trace(index, length) {
    this.get('stepCounter').textContent = length ? `${index.toLocaleString()} / ${length.toLocaleString()} steps` : 'No trace yet';
    const seek = this.get('timelineSeek');
    seek.disabled = !length;
    seek.max = String(Math.max(1, length));
    seek.value = String(index);
    this.get('backStep').disabled = !length || index === 0;
    this.get('replay').disabled = !length;
  }
  inspector(event, algorithm, maze) {
    const dfs = algorithm === 'dfs';
    this.get('frontierType').textContent = dfs ? 'STACK / DFS' : 'QUEUE / BFS';
    this.get('frontierLabel').textContent = dfs ? 'Stack — last in, first out' : 'Queue — first in, first out';
    const cells = event?.frontier || [];
    this.get('frontierCount').textContent = `${cells.length} item${cells.length === 1 ? '' : 's'}`;
    const container = this.get('frontierItems');
    container.replaceChildren();
    if (cells.length === 0) {
      const empty = document.createElement('span'); empty.className = 'frontier-empty';
      empty.textContent = event ? 'The frontier is empty.' : 'Run a solver to inspect its data structure.';
      container.append(empty);
    } else {
      const visible = dfs ? cells.slice(-22).reverse() : cells.slice(0,22);
      for (let i = 0; i < visible.length; i++) {
        const item = document.createElement('span'); item.className = `frontier-item${i === 0 ? ' active' : ''}`;
        const [r,c] = maze.coord(visible[i]); item.textContent = `${r},${c}`;
        container.append(item);
      }
      if (cells.length > 22) {
        const more = document.createElement('span'); more.className = 'frontier-more';
        more.textContent = `+ ${cells.length - 22} more`; container.append(more);
      }
    }
    if (!event) {
      this.get('decisionTitle').textContent = 'Ready to explore';
      this.get('decisionDetail').textContent = 'Start DFS or BFS to see the current cell, what changed, and why.';
      this.get('decisionCode').textContent = 'waiting for algorithm…';
      return;
    }
    const [r,c] = maze.coord(event.cell);
    const loc = `(${r}, ${c})`;
    this.get('decisionTitle').textContent = event.type === 'path' ? `Reveal route ${loc}` : event.type === 'backtrack' ? `Backtrack from ${loc}` : `Explore cell ${loc}`;
    this.get('decisionDetail').textContent = event.action || 'Trace the solution path.';
    this.get('decisionCode').textContent = event.type === 'path' ? 'path.add(current)' : event.type === 'backtrack' ? 'stack.pop()  // dead end' : dfs ? 'stack.push(neighbor)' : 'queue.shift(); queue.push(...neighbors)';
  }
  compare(dfs, bfs) {
    this.get('comparison').hidden = false;
    this.get('dfsExplored').textContent = dfs.expanded;
    this.get('bfsExplored').textContent = bfs.expanded;
    this.get('dfsPath').textContent = dfs.found ? dfs.path.length - 1 : 'No route';
    this.get('bfsPath').textContent = bfs.found ? bfs.path.length - 1 : 'No route';
    this.get('dfsTime').textContent = `${dfs.computeMs.toFixed(2)} ms`;
    this.get('bfsTime').textContent = `${bfs.computeMs.toFixed(2)} ms`;
    let insight = 'Neither search found a path. Try removing a wall in Edit mode.';
    if (dfs.found && bfs.found) {
      const difference = dfs.path.length - bfs.path.length;
      insight = difference === 0
        ? 'Both found an equally short route. Freshly generated perfect mazes have only one possible solution.'
        : `BFS found a route ${difference} step${difference === 1 ? '' : 's'} shorter. DFS prioritizes depth, not shortest distance.`;
    } else if (dfs.found || bfs.found) {
      insight = 'One algorithm could reach the destination, but the other could not. Check for an implementation problem.';
    }
    this.get('comparisonInsight').textContent = insight;
  }
}
