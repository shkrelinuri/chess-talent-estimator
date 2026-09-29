import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { puzzles } from '../lib/puzzles.js';

for (const puzzle of puzzles) {
  const expectedDifficulty = puzzle.mateIn === 1 ? 'easy' : puzzle.mateIn <= 3 ? 'medium' : 'hard';
  assert.equal(puzzle.difficulty, expectedDifficulty, `Puzzle ${puzzle.id} difficulty must match its mate length`);
  assert.equal(puzzle.fen.split(' ')[1], puzzle.sideToMove, `Puzzle ${puzzle.id} side-to-move mismatch`);
  assert.equal(puzzle.solution.length, puzzle.mateIn * 2 - 1, `Puzzle ${puzzle.id} should include a full alternating line`);

  const position = new Chess(puzzle.fen);
  for (const uci of puzzle.solution) {
    const move = position.moves({ verbose: true }).find((candidate) => {
      const promotion = candidate.promotion ?? '';
      return `${candidate.from}${candidate.to}${promotion}` === uci;
    });
    assert.ok(move, `Puzzle ${puzzle.id}: ${uci} must be legal`);
    position.move({ from: move.from, to: move.to, promotion: move.promotion });
  }
  assert.equal(position.isCheckmate(), true, `Puzzle ${puzzle.id} solution must deliver mate`);
  assert.deepEqual(puzzle.acceptedFirstMoves, [puzzle.solution[0]], `Puzzle ${puzzle.id} must expose its first move`);
}

assert.equal(new Set(puzzles.map((puzzle) => puzzle.fen)).size, puzzles.length, 'Puzzle positions should be distinct');
console.log(`Verified ${puzzles.length} distinct full-line puzzles across all three difficulties.`);