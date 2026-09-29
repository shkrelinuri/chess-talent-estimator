import { createReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { createZstdDecompress } from 'node:zlib';
import { Chess } from 'chess.js';

const archivePath = process.argv[2] ?? join(tmpdir(), 'lichess_db_puzzle.csv.zst');
const outputPath = process.argv[3] ?? 'lib/lichess-puzzles.js';
const targets = [
  { name: 'easy', matches: (mateIn) => mateIn === 1 },
  { name: 'medium', matches: (mateIn) => mateIn === 2 || mateIn === 3 },
  { name: 'hard', matches: (mateIn) => mateIn > 3 },
];
const ratingBands = [800, 1200, 1600, 2000];
const samplesPerBand = 30;
const targetsPerDifficulty = 24;
const randomIndex = (length) => Math.floor(Math.random() * length);
const reservoirs = new Map();
const seen = new Map();

function playUci(position, uci) {
  return position.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4],
  });
}

function ratingBand(rating) {
  const start = ratingBands.findLast((value) => rating >= value);
  return start ?? ratingBands[0];
}

function sourcePattern(themes) {
  const priorities = [
    'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'backRankMate',
    'smotheredMate', 'sacrifice', 'promotion', 'deflection', 'attraction',
    'interference', 'clearance', 'quietMove', 'trappedPiece', 'hangingPiece',
    'xRayAttack', 'zugzwang', 'mate',
  ];
  return priorities.find((theme) => themes.includes(theme)) ?? 'Mate pattern';
}

class StripZstdSkippableFrames extends Transform {
  pending = Buffer.alloc(0);

  _transform(chunk, encoding, callback) {
    const data = Buffer.concat([this.pending, chunk]);
    let cursor = 0;
    let searchFrom = 0;

    while (searchFrom <= data.length - 8) {
      const offset = data.indexOf(Buffer.from([0x50, 0x2a, 0x4d]), searchFrom);
      if (offset < 0 || offset > data.length - 8) break;
      const magicSuffix = data[offset + 3];
      if (magicSuffix < 0x18 || magicSuffix > 0x27) {
        searchFrom = offset + 1;
        continue;
      }
      const frameEnd = offset + 8 + data.readUInt32LE(offset + 4);
      if (frameEnd > data.length) break;
      this.push(data.subarray(cursor, offset));
      cursor = frameEnd;
      searchFrom = frameEnd;
    }

    const safeEnd = Math.max(cursor, data.length - 7);
    this.push(data.subarray(cursor, safeEnd));
    this.pending = data.subarray(safeEnd);
    callback();
  }

  _flush(callback) {
    this.push(this.pending);
    callback();
  }
}

const compressed = createReadStream(archivePath)
  .pipe(new StripZstdSkippableFrames())
  .pipe(createZstdDecompress());
const lines = createInterface({ input: compressed, crlfDelay: Infinity });
let processed = 0;

for await (const line of lines) {
  processed += 1;
  if (processed === 1 || !line) continue;
  const fields = line.split(',');
  if (fields.length < 8) continue;

  const [sourceId, sourceFen, rawMoves, rawRating, , rawPopularity, rawPlays, rawThemes] = fields;
  const moves = rawMoves.split(' ').filter(Boolean);
  const rating = Number(rawRating);
  const popularity = Number(rawPopularity);
  const plays = Number(rawPlays);
  const mateIn = Math.ceil((moves.length - 1) / 2);
  const themes = rawThemes.split(' ').filter(Boolean);
  if (!sourceId || !sourceFen || !moves.length || !Number.isFinite(rating)) continue;
  if (!themes.includes(`mateIn${mateIn}`) || popularity < 50 || plays < 30 || rating < 800 || rating > 2400) continue;

  const difficulty = targets.find((target) => target.matches(mateIn))?.name;
  if (!difficulty) continue;
  const band = ratingBand(rating);
  const key = `${difficulty}:${band}`;
  const count = (seen.get(key) ?? 0) + 1;
  seen.set(key, count);

  const reservoir = reservoirs.get(key) ?? [];
  const candidate = { sourceId, sourceFen, moves, mateIn, difficulty, rating, themes, pattern: sourcePattern(themes) };
  if (reservoir.length < samplesPerBand) reservoir.push(candidate);
  else {
    const replacement = randomIndex(count);
    if (replacement < samplesPerBand) reservoir[replacement] = candidate;
  }
  reservoirs.set(key, reservoir);
}

const selected = [];
const selectedIds = new Set();
for (const { name, matches } of targets) {
  const available = ratingBands.flatMap((band) => reservoirs.get(`${name}:${band}`) ?? []);
  const candidates = available.sort(() => Math.random() - 0.5);
  for (const candidate of candidates) {
    if (selected.filter((puzzle) => puzzle.difficulty === name).length >= targetsPerDifficulty) break;
    if (selectedIds.has(candidate.sourceId)) continue;

    try {
      const position = new Chess(candidate.sourceFen);
      const initialMove = playUci(position, candidate.moves[0]);
      if (!initialMove) continue;
      const solution = candidate.moves.slice(1);
      for (const uci of solution) {
        const move = playUci(position, uci);
        if (!move) throw new Error('Illegal move in line');
      }
      if (!position.isCheckmate()) continue;
      const puzzlePosition = new Chess(candidate.sourceFen);
      playUci(puzzlePosition, candidate.moves[0]);
      selected.push({
        id: candidate.sourceId,
        fen: puzzlePosition.fen(),
        sideToMove: puzzlePosition.turn(),
        mateIn: candidate.mateIn,
        solution,
        acceptedFirstMoves: [solution[0]],
        difficulty: candidate.difficulty,
        rating: candidate.rating,
        pattern: candidate.pattern,
      });
      selectedIds.add(candidate.sourceId);
    } catch {
      continue;
    }
  }
}

const totals = Object.fromEntries(targets.map(({ name }) => [
  name,
  selected.filter((puzzle) => puzzle.difficulty === name).length,
]));
if (Object.values(totals).some((count) => count < 10)) {
  throw new Error(`Not enough verified puzzles by difficulty: ${JSON.stringify(totals)}`);
}

const output = `export const lichessPuzzles = ${JSON.stringify(selected, null, 2)};\n`;
await writeFile(outputPath, output, 'utf8');
console.log(`Scanned ${processed.toLocaleString()} CSV lines; wrote ${selected.length} verified puzzles to ${outputPath}.`);
console.log(JSON.stringify(totals));
