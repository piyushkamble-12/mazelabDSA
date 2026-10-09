/** Snapshot-based undo history. One drag gesture is one undoable change. */
export class EditHistory {
  constructor(limit = 60) { this.limit = limit; this.undoStack = []; this.redoStack = []; }
  snapshot(maze) { return {cells: Array.from(maze.cells), start: maze.start, end: maze.end}; }
  commit(before, maze) {
    const after = this.snapshot(maze);
    if (before.start === after.start && before.end === after.end && before.cells.every((x, i) => x === after.cells[i])) return false;
    this.undoStack.push(before);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    return true;
  }
  apply(maze, snapshot) { maze.cells = Uint8Array.from(snapshot.cells); maze.start = snapshot.start; maze.end = snapshot.end; }
  undo(maze) {
    if (!this.undoStack.length) return false;
    this.redoStack.push(this.snapshot(maze)); this.apply(maze, this.undoStack.pop()); return true;
  }
  redo(maze) {
    if (!this.redoStack.length) return false;
    this.undoStack.push(this.snapshot(maze)); this.apply(maze, this.redoStack.pop()); return true;
  }
  reset() { this.undoStack = []; this.redoStack = []; }
}
