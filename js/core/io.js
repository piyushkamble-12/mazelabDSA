import { Maze } from './maze.js';
export const FORMAT = 'mazelab-v1';
/** Convert to a portable, intentionally small JSON schema (never embed executable data). */
export function serializeMaze(maze) {
  return JSON.stringify({format: FORMAT, size: maze.size, start: maze.start, end: maze.end, cells: Array.from(maze.cells)}, null, 2);
}
export function deserializeMaze(json) {
  if (typeof json !== 'string' || json.length > 200000) throw new Error('Invalid or oversized maze file.');
  let data;
  try { data = JSON.parse(json); } catch { throw new Error('This is not valid JSON.'); }
  if (!data || data.format !== FORMAT || !Number.isInteger(data.size) || data.size < 5 || data.size > 41 || data.size % 2 === 0) {
    throw new Error('Unsupported MazeLab file format or grid size.');
  }
  if (!Array.isArray(data.cells) || data.cells.length !== data.size ** 2 || !data.cells.every(cell => cell === 0 || cell === 1)) {
    throw new Error('Invalid maze cell data.');
  }
  const maze = new Maze(data.size, data.cells);
  if (![data.start, data.end].every(i => Number.isInteger(i) && i >= 0 && i < maze.cells.length)
    || data.start === data.end || data.cells[data.start] !== 0 || data.cells[data.end] !== 0) {
    throw new Error('Invalid maze start or finish position.');
  }
  maze.start = data.start;
  maze.end = data.end;
  return maze;
}
