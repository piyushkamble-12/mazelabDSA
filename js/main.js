import { Maze, generateMaze, braidMaze } from './core/maze.js';
import { solve, solveBFS, solveDFS, visualEvents } from './core/search.js';
import { Timeline } from './core/timeline.js';
import { EditHistory } from './core/history.js';
import { serializeMaze, deserializeMaze } from './core/io.js';
import { MazeRenderer } from './ui/renderer.js';
import { AppView } from './ui/view.js';

/** Orchestrates independent model, algorithm, playback, rendering, and interface modules. */
export class MazeLab {
  constructor() {
    this.ui = new AppView();
    this.renderer = new MazeRenderer(this.ui.get('board'));
    this.dfsRenderer = new MazeRenderer(this.ui.get('raceDfsBoard'));
    this.bfsRenderer = new MazeRenderer(this.ui.get('raceBfsBoard'));
    this.timeline = new Timeline(() => this.ui.get('speed').value);
    this.history = new EditHistory();
    this.maze = new Maze(); this.displayMaze = this.maze;
    this.mode = 'view'; this.kind = null; this.algorithm = 'dfs';
    this.overlay = this.freshOverlay();
    this.metrics = this.blankMetrics(); this.lastEvent = null; this.lastFrontierAlgorithm = 'dfs';
    this.raceData = null;
    this.player = this.maze.start; this.playerSteps = 0;
    this.dragging = false; this.lastPainted = -1; this.dragSnapshot = null;
    this.installEvents();
    new ResizeObserver(() => this.redraw(true)).observe(this.ui.get('board'));
    new ResizeObserver(() => this.redrawRace(true)).observe(this.ui.get('raceDfsBoard'));
    this.ui.setMode('view');
    this.ui.get('algorithmDescription').textContent = this.algorithmHelp();
    this.ui.setBusy(null);
    this.ui.trace(0,0);
    this.ui.inspector(null,'dfs',this.maze);
    this.generate();
  }
  blankMetrics() { return {visited:0, path:0, backtracks:0, time:0}; }
  freshOverlay() { return {visited:new Set(),backtracked:new Set(),path:new Set(),visitAt:new Map(),pathAt:new Map(),carvedAt:new Map(),current:-1,hovered:-1}; }
  redraw(resize=false) {
    if (resize) this.renderer.resize();
    this.renderer.draw(this.displayMaze, {...this.overlay, mode:this.mode, player:this.player});
  }
  redrawRace(resize=false) {
    if (!this.raceData || this.ui.get('racePanel').hidden) return;
    if (resize) {this.dfsRenderer.resize(); this.bfsRenderer.resize();}
    this.dfsRenderer.draw(this.maze,{...this.raceData.dfs.overlay,theme:'dfs'});
    this.bfsRenderer.draw(this.maze,{...this.raceData.bfs.overlay,theme:'bfs'});
  }
  refreshHistory() { this.ui.history(this.history.undoStack.length>0 && !this.timeline.active, this.history.redoStack.length>0 && !this.timeline.active); }
  clearTrail({resetStatus=true}={}) {
    const interruptedGeneration = this.kind === 'generate';
    this.timeline.cancel(); this.kind = null; this.lastEvent = null;
    if (interruptedGeneration) this.displayMaze = this.maze;
    this.overlay = this.freshOverlay(); this.metrics=this.blankMetrics();
    this.ui.progress(0); this.ui.trace(0,0); this.ui.setBusy(null);
    this.ui.inspector(null,this.ui.get('algorithm').value,this.maze);
    this.ui.stats(this.metrics);
    if (resetStatus) this.ui.status('Ready to explore','Choose a solver, create loops, or edit the maze.','ready');
    this.refreshHistory(); this.redraw();
  }
  clearComparison() { this.ui.get('comparison').hidden = true; this.ui.get('racePanel').hidden = true; this.raceData = null; }
  generate() {
    this.clearTrail({resetStatus:false}); this.clearComparison();
    this.mode='view';this.ui.setMode('view');this.history.reset();this.refreshHistory();
    const size=Number(this.ui.get('size').value);
    const {maze,events}=generateMaze(size);
    let loopCount=0;
    if(this.ui.get('mazeStyle').value==='loops') {
      const extra=braidMaze(maze,.22);
      loopCount=extra.length;
      for (const index of extra) events.push({type:'carve',cells:[index],cell:index,action:'Create a loop for alternate routes'});
    }
    this.maze=maze; this.displayMaze=maze; this.player=maze.start; this.playerSteps=0;
    this.ui.get('playerSteps').textContent='0';
    this.ui.get('gridLabel').textContent=`${size} × ${size}`;
    this.ui.get('workspaceLabel').textContent=`${maze.openCount()} walkable cells · ${loopCount ? `${loopCount} extra passages` : 'one unique route'}`;
    if(!this.ui.get('animated').checked || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.ui.status('New maze ready',loopCount?'Multiple routes are available for algorithm comparison.':'A perfect maze with one unique route.','success');
      this.redraw();return;
    }
    this.kind='generate';this.generationSize=size;
    this.resetPresentation();
    this.ui.setBusy('generate');
    this.ui.status('Carving the maze','Randomized DFS opens corridors and creates a connected graph.','running');
    this.startTrace(events);
  }
  solve() {
    this.clearTrail({resetStatus:false}); this.clearComparison();
    if(this.mode==='play') {this.mode='view';this.ui.setMode('view');}
    this.algorithm=this.ui.get('algorithm').value;
    this.searchResult=solve(this.maze,this.algorithm);
    this.kind='solve';this.resetPresentation();
    this.ui.setBusy('solve');
    this.ui.status(`${this.algorithm.toUpperCase()} exploring`,'Follow the live frontier and step through each decision.','running');
    this.startTrace(visualEvents(this.searchResult));
  }
  compare() {
    this.clearTrail({resetStatus:false}); this.clearComparison();
    if(this.mode==='play'){this.mode='view';this.ui.setMode('view');}
    const dfs=solveDFS(this.maze), bfs=solveBFS(this.maze);
    this.ui.compare(dfs,bfs);
    this.raceData={dfs:{result:dfs,overlay:this.freshOverlay(),visited:0,path:0},bfs:{result:bfs,overlay:this.freshOverlay(),visited:0,path:0}};
    this.ui.get('racePanel').hidden=false;
    this.kind='race';this.algorithm='dfs';this.resetPresentation();
    const d=visualEvents(dfs),b=visualEvents(bfs);
    const events=Array.from({length:Math.max(d.length,b.length)},(_,i)=>({type:'race',dfs:d[i]||null,bfs:b[i]||null}));
    this.ui.setBusy('race');
    this.ui.status('The race has started','DFS and BFS receive the same maze and advance in parallel.','running');
    // Canvas requires a rendered size after the containing section becomes visible.
    requestAnimationFrame(()=>{this.redrawRace(true);this.ui.get('racePanel').scrollIntoView({behavior:'smooth',block:'nearest'});});
    this.startTrace(events);
  }
  resetPresentation() {
    this.overlay=this.freshOverlay();this.lastEvent=null;this.metrics=this.blankMetrics();
    if(this.kind==='generate') this.displayMaze=new Maze(this.generationSize);
    else this.displayMaze=this.maze;
    if(this.kind==='solve') this.metrics.time=this.searchResult.computeMs;
    if(this.kind==='race' && this.raceData) {
      for(const side of ['dfs','bfs']) {
        this.raceData[side].overlay=this.freshOverlay();
        this.raceData[side].visited=0;this.raceData[side].path=0;
      }
    }
  }
  applyToOverlay(overlay,event,now) {
    if(!event) return;
    if(event.type==='visit') {overlay.visited.add(event.cell);overlay.visitAt.set(event.cell,now);overlay.current=event.cell;}
    else if(event.type==='backtrack') {overlay.backtracked.add(event.cell);overlay.current=event.to;}
    else if(event.type==='path') {overlay.path.add(event.cell);overlay.pathAt.set(event.cell,now);overlay.current=event.cell;}
  }
  handleEvent(event,rebuilding=false) {
    const now=rebuilding?0:performance.now();
    if(this.kind==='generate') {
      if(event.type==='carve') {
        for (const index of event.cells) {this.displayMaze.cells[index]=0;this.overlay.carvedAt.set(index,now);}
        this.metrics.visited++;
      }
      this.overlay.current=event.cell;
    } else if(this.kind==='solve') {
      this.applyToOverlay(this.overlay,event,now);
      if(event.type==='visit') this.metrics.visited++;
      if(event.type==='backtrack') this.metrics.backtracks++;
      if(event.type==='path') this.metrics.path=Math.max(0,this.overlay.path.size-1);
      this.lastEvent=event;
    } else if(this.kind==='race' && this.raceData) {
      for(const side of ['dfs','bfs']) {
        const evt=event[side];if(!evt)continue;
        const state=this.raceData[side];
        this.applyToOverlay(state.overlay,evt,now);
        if(evt.type==='visit') state.visited++;
        if(evt.type==='path') state.path=Math.max(0,state.overlay.path.size-1);
      }
      this.lastEvent=event.dfs || event.bfs;
      this.lastFrontierAlgorithm=event.dfs?'dfs':'bfs';
    }
  }
  startTrace(events) {
    this.timeline.start(events,{
      onStep:event=>this.handleEvent(event),
      onRebuild:(all,index)=>{
        this.resetPresentation();
        for(let i=0;i<index;i++)this.handleEvent(all[i],true);
      },
      onFrame:progress=>this.onFrame(progress),
      onDone:()=>this.onFinished(),
    });
  }
  onFrame(progress) {
    this.ui.progress(progress);
    this.ui.trace(this.timeline.index,this.timeline.events.length);
    if(this.kind==='solve') this.ui.inspector(this.lastEvent,this.algorithm,this.maze);
    else if(this.kind==='race') {
      this.ui.inspector(this.lastEvent,this.lastFrontierAlgorithm,this.maze);
      for (const side of ['dfs','bfs']) {
        const state=this.raceData[side];
        this.ui.get(side==='dfs'?'raceDfsVisited':'raceBfsVisited').textContent=`${state.visited} cells`;
        this.ui.get(side==='dfs'?'raceDfsResult':'raceBfsResult').textContent=state.path?`${state.path} route steps highlighted`:'Exploring the maze…';
      }
    }
    this.ui.stats(this.metrics);
    this.redraw(); this.redrawRace();
    if(this.timeline.state==='paused') this.ui.setBusy(this.kind,true);
  }
  onFinished() {
    if(this.kind==='generate') {
      this.displayMaze=this.maze;this.overlay=this.freshOverlay();this.metrics=this.blankMetrics();
      this.ui.status('Maze generated',`${this.maze.size} × ${this.maze.size} · ${this.maze.openCount()} open cells · ready to solve`,'success');
    } else if(this.kind==='solve') {
      this.overlay.current=-1;
      const result=this.searchResult;
      this.metrics={visited:result.expanded,path:result.found?result.path.length-1:0,backtracks:result.backtracks,time:result.computeMs};
      this.ui.status(result.found?`${this.algorithm.toUpperCase()} found a path`:'No route exists',result.found?`${result.path.length-1} moves · ${result.expanded} cells explored`:'Edit the walls and retry.',result.found?'success':'warning');
    } else if(this.kind==='race') {
      const {dfs,bfs}=this.raceData;
      dfs.overlay.current=-1;bfs.overlay.current=-1;
      const d=dfs.result,b=bfs.result;
      const delta=d.found&&b.found?(d.path.length-b.path.length):0;
      this.ui.get('raceDfsResult').textContent=d.found?`${d.path.length-1} moves · ${d.expanded} explored`:'No route found';
      this.ui.get('raceBfsResult').textContent=b.found?`${b.path.length-1} moves · ${b.expanded} explored`:'No route found';
      this.ui.get('raceNote').textContent=delta>0?`BFS found a route ${delta} move${delta===1?'':'s'} shorter, because it searches by distance.`:d.found&&b.found?'Both routes are equal in this maze. Edit passages or generate another looped maze to compare.':'No path was available. Reconnect start and end using Edit mode.';
      this.ui.status('Race complete','Compare route lengths and explored cells in the result panel.','success');
    }
    this.ui.setBusy(null);this.ui.progress(1);this.ui.stats(this.metrics);
    this.refreshHistory();this.redraw();this.redrawRace();
  }
  pauseOrResume() {
    if(!this.timeline.active) return;
    if(this.timeline.state==='playing') this.timeline.pause(); else this.timeline.resume();
    const paused=this.timeline.state==='paused';
    this.ui.setBusy(this.kind,paused);
    this.ui.status(paused?'Animation paused':'Animation resumed',paused?'Scrub or step backward and forward to inspect the trace.':'Watch the current cell advance.',paused?'ready':'running');
  }
  navigateTrace(value) {
    if(!this.timeline.events.length) return;
    this.timeline.seek(value);
    if(this.timeline.state==='paused') {
      this.ui.setBusy(this.kind,true);
      this.ui.status('Inspecting a recorded step','Use Replay to start again or Resume to keep going.','ready');
    }
  }
  setMode(mode) {
    if(!['view','edit','play'].includes(mode)||this.timeline.active)return;
    this.clearTrail({resetStatus:false});this.clearComparison();
    this.mode=mode;this.ui.setMode(mode);
    this.player=this.maze.start;this.playerSteps=0;this.ui.get('playerSteps').textContent='0';
    this.ui.status(mode==='edit'?'Edit mode':mode==='play'?'Your move!':'Ready to explore',
      mode==='edit'?'Drag to draw passages. Undo and redo work for each drag.':mode==='play'?'Reach the coral finish tile.':'Choose a solver to begin.','ready');
    this.redraw();
  }
  paint(index) {
    if(index<0||this.mode!=='edit')return;
    const brush=this.ui.get('brush').value;
    let changed=false;
    if(brush==='start'||brush==='end') {
      changed=this.maze.setEndpoint(brush,index);
      if(changed&&brush==='start')this.player=index;
    } else changed=this.maze.setWall(index,brush==='wall');
    if(changed) {
      this.clearComparison();
      this.ui.get('workspaceLabel').textContent=`${this.maze.openCount()} walkable cells · custom design`;
      this.ui.status('Maze updated','Solve or race again to see the changes.','ready');
      this.redraw();
    }
  }
  finishDrawing() {
    if(this.dragging&&this.dragSnapshot) this.history.commit(this.dragSnapshot,this.maze);
    this.dragging=false;this.lastPainted=-1;this.dragSnapshot=null;
    this.refreshHistory();
  }
  editHistory(operation) {
    if(this.timeline.active||this.mode!=='edit')return;
    if(this.history[operation](this.maze)) {
      this.clearComparison();this.player=this.maze.start;
      this.ui.get('workspaceLabel').textContent=`${this.maze.openCount()} walkable cells · custom design`;
      this.ui.status(operation==='undo'?'Edit undone':'Edit restored','You can safely revise the maze.','ready');
      this.redraw();
    }
    this.refreshHistory();
  }
  movePlayer(direction) {
    if(this.mode!=='play')return;
    const [r,c]=this.maze.coord(this.player),[dr,dc]=direction;
    if(!this.maze.inBounds(r+dr,c+dc))return;
    const next=this.maze.index(r+dr,c+dc);
    if(!this.maze.isOpen(next))return;
    this.player=next;this.playerSteps++;this.ui.get('playerSteps').textContent=String(this.playerSteps);
    this.redraw();
    if(next===this.maze.end){this.ui.status('You escaped!',`You finished in ${this.playerSteps} moves.`,'success');this.ui.toast('✦ You found your way through!');}
  }
  algorithmHelp() {return this.ui.get('algorithm').value==='dfs'
    ?'DFS dives down one corridor at a time. Its stack reveals backtracking, but not necessarily a shortest path.'
    :'BFS expands outward one layer at a time using a queue. It guarantees a shortest path in unweighted mazes.';}
  downloadMaze() {
    if(this.timeline.active)return;
    const data=serializeMaze(this.maze);
    const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`mazelab-${this.maze.size}x${this.maze.size}.json`;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    this.ui.toast('Maze saved as a JSON file');
  }
  async uploadMaze(file) {
    if(!file||this.timeline.active)return;
    try {
      if(file.size>200000)throw new Error('File is too large.');
      const maze=deserializeMaze(await file.text());
      this.clearTrail({resetStatus:false});this.clearComparison();this.history.reset();
      this.maze=maze;this.displayMaze=maze;this.player=maze.start;this.playerSteps=0;
      this.mode='view';this.ui.setMode('view');
      this.ui.get('size').value=String(maze.size);
      this.ui.get('gridLabel').textContent=`${maze.size} × ${maze.size}`;
      this.ui.get('workspaceLabel').textContent=`${maze.openCount()} walkable cells · imported design`;
      this.ui.get('playerSteps').textContent='0';
      this.ui.inspector(null,'dfs',maze);
      this.refreshHistory();this.redraw();
      this.ui.status('Maze loaded','Your custom design is ready to solve or edit.','success');
      this.ui.toast('Maze loaded successfully');
    } catch(error) {this.ui.toast(error?.message||'Unable to read maze file');this.ui.status('Could not load maze',error?.message||'Invalid file.','warning');}
    finally {this.ui.get('mazeFile').value='';}
  }
  installEvents() {
    const ui=this.ui;
    for(const id of ['generate','quickGenerate'])ui.on(id,'click',()=>this.generate());
    ui.on('size','change',()=>this.generate());
    ui.on('mazeStyle','change',()=>this.generate());
    for(const id of ['solve','quickSolve'])ui.on(id,'click',()=>this.solve());
    for(const id of ['pause','quickPause'])ui.on(id,'click',()=>this.pauseOrResume());
    ui.on('step','click',()=>this.timeline.step());
    ui.on('backStep','click',()=>this.navigateTrace(this.timeline.index-1));
    ui.on('timelineSeek','input',()=>this.navigateTrace(Number(ui.get('timelineSeek').value)));
    ui.on('replay','click',()=>{
      if(!this.timeline.events.length)return;
      this.timeline.replay();this.ui.setBusy(this.kind);
      this.ui.status('Replay started','The exact same trace is playing again.','running');
    });
    ui.on('skip','click',()=>this.timeline.skip());
    ui.on('reset','click',()=>{this.clearTrail();this.clearComparison();});
    for(const id of ['compare','quickRace'])ui.on(id,'click',()=>this.compare());
    ui.on('raceClose','click',()=>{this.clearTrail();this.clearComparison();});
    ui.on('clearComparison','click',()=>this.clearComparison());
    ui.on('algorithm','change',()=>{
      ui.get('algorithmDescription').textContent=this.algorithmHelp();
      if(!this.timeline.events.length)ui.inspector(null,ui.get('algorithm').value,this.maze);
    });
    ui.on('speed','input',()=>{ui.get('speedValue').textContent=`${ui.get('speed').value}%`;});
    ui.on('undoEdit','click',()=>this.editHistory('undo'));
    ui.on('redoEdit','click',()=>this.editHistory('redo'));
    ui.on('saveMaze','click',()=>this.downloadMaze());
    ui.on('loadMaze','click',()=>ui.get('mazeFile').click());
    ui.on('mazeFile','change',()=>this.uploadMaze(ui.get('mazeFile').files?.[0]));
    ui.on('restart','click',()=>{
      this.player=this.maze.start;this.playerSteps=0;ui.get('playerSteps').textContent='0';
      ui.status('Player reset','Find a new way to the finish.','ready');this.redraw();
    });
    document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>this.setMode(b.dataset.mode)));
    const directions={up:[-1,0],down:[1,0],left:[0,-1],right:[0,1]};
    document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>this.movePlayer(directions[b.dataset.move])));
    ui.on('helpToggle','click',()=>{
      const closed=ui.get('helpContent').hidden;
      ui.get('helpContent').hidden=!closed;ui.get('helpToggle').setAttribute('aria-expanded',String(closed));
    });
    const canvas=ui.get('board');
    canvas.addEventListener('pointerdown',event=>{
      if(this.mode!=='edit')return;
      event.preventDefault();this.dragging=true;this.lastPainted=-1;
      this.dragSnapshot=this.history.snapshot(this.maze);
      canvas.setPointerCapture(event.pointerId);this.paintPointer(event);
    });
    canvas.addEventListener('pointermove',event=>{
      if(this.mode!=='edit')return;
      const cell=this.renderer.hitTest(event,this.maze);
      if(this.dragging)this.paintPointer(event);
      else if(this.overlay.hovered!==cell){this.overlay.hovered=cell;this.redraw();}
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>this.finishDrawing());
    canvas.addEventListener('pointerleave',()=>{if(!this.dragging){this.overlay.hovered=-1;this.redraw();}});
    window.addEventListener('keydown',event=>{
      const tag=document.activeElement?.tagName;
      if(['INPUT','SELECT','TEXTAREA'].includes(tag))return;
      if(this.mode==='edit'&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z') {
        event.preventDefault();this.editHistory(event.shiftKey?'redo':'undo');return;
      }
      if(this.mode==='edit'&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y') {
        event.preventDefault();this.editHistory('redo');return;
      }
      if(this.mode!=='play')return;
      const moves={ArrowUp:[-1,0],w:[-1,0],W:[-1,0],ArrowRight:[0,1],d:[0,1],D:[0,1],ArrowDown:[1,0],s:[1,0],S:[1,0],ArrowLeft:[0,-1],a:[0,-1],A:[0,-1]};
      if(moves[event.key]){event.preventDefault();this.movePlayer(moves[event.key]);}
    });
  }
  paintPointer(event) {
    const cell=this.renderer.hitTest(event,this.maze);
    if(cell===this.lastPainted||cell<0)return;
    this.lastPainted=cell;this.overlay.hovered=cell;this.paint(cell);
  }
}

if(typeof document!=='undefined')new MazeLab();
