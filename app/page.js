'use client';

import { useEffect, useRef, useState } from 'react';
import { Chess } from '../lib/chess';
import { puzzles } from '../lib/puzzles';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const pieceGlyphs = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
const promotionNames = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
const promotionOrder = ['q', 'r', 'b', 'n'];
const QUIZ_LENGTH = 10;
const difficultyWeight = { easy: 1, medium: 1.25, hard: 1.5 };
const patternLabels = {
  backRankMate: 'Back-rank mate',
  discoveredAttack: 'Discovered attack',
  doubleCheck: 'Double check',
  hangingPiece: 'Hanging piece',
  smotheredMate: 'Smothered mate',
  trappedPiece: 'Trapped piece',
  xRayAttack: 'X-ray attack',
};
const patternCatalog = [...new Set(puzzles.map((puzzle) => puzzle.pattern))]
  .map((key) => ({ key, name: patternLabels[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()) }));

function makeQuizSet(excludedIds = []) {
  const shuffled = (values) => {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  };
  const excluded = new Set(excludedIds);
  const picked = [];
  const selectedIds = new Set();
  for (const [difficulty, count] of [['easy', 4], ['medium', 4], ['hard', 2]]) {
    const available = puzzles.filter((puzzle) => puzzle.difficulty === difficulty);
    const fresh = shuffled(available.filter((puzzle) => !excluded.has(puzzle.id))).slice(0, count);
    picked.push(...fresh);
    fresh.forEach((puzzle) => selectedIds.add(puzzle.id));
  }
  let remaining = QUIZ_LENGTH - picked.length;
  const freshFallback = shuffled(puzzles.filter((puzzle) => !excluded.has(puzzle.id) && !selectedIds.has(puzzle.id)))
    .slice(0, remaining);
  picked.push(...freshFallback);
  freshFallback.forEach((puzzle) => selectedIds.add(puzzle.id));
  remaining = QUIZ_LENGTH - picked.length;
  if (remaining > 0) {
    picked.push(...shuffled(puzzles.filter((puzzle) => !selectedIds.has(puzzle.id))).slice(0, remaining));
  }
  return shuffled(picked);
}

function getAssessment(results) {
  const totalWeight = results.reduce((sum, result) => sum + difficultyWeight[result.difficulty], 0);
  const earned = results.reduce((sum, result) => {
    if (!result.correct) return sum;
    const speedFactor = Math.max(0.55, Math.min(1, 1.15 - result.elapsedMs / 90000));
    return sum + difficultyWeight[result.difficulty] * speedFactor;
  }, 0);
  const score = Math.round((earned / totalWeight) * 100);
  let verdict = 'A thoughtful start, with tactical patterns to build on.';
  if (score >= 85) verdict = 'Sharp tactical eye, with a knack for spotting the key finish.';
  else if (score >= 65) verdict = 'Good pattern sense, with a few chances still hiding in plain sight.';
  else if (score >= 40) verdict = 'Promising instincts, and more puzzle practice will sharpen your reads.';
  if (score >= 85) return { score, verdict, rating: '1600-1800 range' };
  if (score >= 65) return { score, verdict, rating: '1400-1600 range' };
  if (score >= 45) return { score, verdict, rating: '1200-1400 range' };
  if (score >= 25) return { score, verdict, rating: '900-1100 range' };
  return { score, verdict, rating: 'Below 900 range' };
}

function getSquareName(row, column) {
  return `${String.fromCharCode(97 + column)}${8 - row}`;
}

function AuthPanel() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) {
        setMessage('Check your email to confirm your account, then sign in.');
      }
    } catch (caught) {
      setError(caught.message || 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider) {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (authError) {
        if (/unsupported provider|provider is not enabled/i.test(authError.message)) {
          const providerName = provider === 'google' ? 'Google' : 'GitHub';
          throw new Error(`${providerName} sign-in is not enabled in Supabase. Enable it under Authentication → Providers and add its OAuth credentials.`);
        }
        throw authError;
      }
    } catch (caught) {
      setError(caught.message || `Could not sign in with ${provider}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card panel" aria-labelledby="auth-heading">
      <div className="eyebrow">YOUR QUICK TACTICAL READ</div>
      <h1 id="auth-heading">A little chess, a clearer picture.</h1>
      <p className="muted auth-copy">Sign in to solve ten tactical puzzles, from quick mates to longer forced lines, and get an instant read on your pattern-spotting instincts.</p>
      <div className="oauth-buttons">
        <button className="oauth-button" type="button" onClick={() => handleOAuth('google')} disabled={busy}>
          <span className="google-mark" aria-hidden="true">G</span>
          <span>Continue with Google</span>
        </button>
        <button className="oauth-button" type="button" onClick={() => handleOAuth('github')} disabled={busy}>
          <svg className="github-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5A11.5 11.5 0 0 0 8.36 22.91c.58.1.79-.25.79-.56v-2.04c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.19 1.78 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.27.73-1.56-2.57-.29-5.27-1.28-5.27-5.7 0-1.26.45-2.3 1.2-3.11-.12-.3-.52-1.48.11-3.08 0 0 .98-.31 3.2 1.19a11.1 11.1 0 0 1 5.82 0c2.22-1.5 3.2-1.19 3.2-1.19.64 1.6.24 2.78.12 3.08.75.81 1.2 1.85 1.2 3.11 0 4.43-2.71 5.4-5.29 5.69.42.36.79 1.07.79 2.15v3.19c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" /></svg>
          <span>Continue with GitHub</span>
        </button>
      </div>
      <div className="auth-divider"><span>or continue with email</span></div>
      <div className="mode-switch" role="tablist" aria-label="Account mode">
        <button className={mode === 'signin' ? 'mode active' : 'mode'} onClick={() => { setMode('signin'); setError(''); setMessage(''); }} role="tab" aria-selected={mode === 'signin'}>Sign in</button>
        <button className={mode === 'signup' ? 'mode active' : 'mode'} onClick={() => { setMode('signup'); setError(''); setMessage(''); }} role="tab" aria-selected={mode === 'signup'}>Create account</button>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" />
        {error && <p className="inline-message error" role="alert">{error}</p>}
        {message && <p className="inline-message" role="status">{message}</p>}
        <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in and start'}</button>
      </form>
      <p className="fine-print">Your puzzle results stay with you. No rating is submitted to any chess service.</p>
    </section>
  );
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockChecked, setUnlockChecked] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [step, setStep] = useState(0);
  const [boardFen, setBoardFen] = useState('');
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [movePrompt, setMovePrompt] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [licenseError, setLicenseError] = useState('');
  const [licenseSuccess, setLicenseSuccess] = useState(false);
  const [gumroadUrl, setGumroadUrl] = useState('');
  const puzzleStartedAt = useRef(Date.now());

  useEffect(() => {
    if (!supabase) {
      setAuthLoaded(true);
      return undefined;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoaded(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    async function checkUnlock() {
      if (!user || !supabase) {
        setUnlocked(false);
        setUnlockChecked(Boolean(!user));
        return;
      }
      setUnlockChecked(false);
      const { data } = await supabase
        .from('unlocked_users')
        .select('unlocked')
        .eq('user_id', user.id)
        .maybeSingle();
      if (active) {
        setUnlocked(Boolean(data?.unlocked));
        setUnlockChecked(true);
      }
    }
    checkUnlock();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (user && unlockChecked && !quiz) {
      const nextQuiz = makeQuizSet();
      setQuiz(nextQuiz);
      setStep(0);
      setResults([]);
      setLastMove(null);
      setPendingPromotion(null);
      setSolutionIndex(0);
      setMovePrompt('');
      setBoardFen(nextQuiz[0].fen);
      puzzleStartedAt.current = Date.now();
    }
  }, [user, unlockChecked, unlocked, quiz]);

  useEffect(() => {
    if (!quiz || feedback || step >= quiz.length) return undefined;
    const timer = window.setInterval(() => setElapsed(Date.now() - puzzleStartedAt.current), 1000);
    return () => window.clearInterval(timer);
  }, [quiz, step, feedback]);

  useEffect(() => {
    if (results.length !== QUIZ_LENGTH) return;
    fetch('/api/verify-license')
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (payload?.purchaseUrl) setGumroadUrl(payload.purchaseUrl); })
      .catch(() => {});
  }, [results.length]);

  async function signOut() {
    await supabase.auth.signOut();
    setQuiz(null);
    setResults([]);
  }

  function beginNewQuiz() {
    const nextQuiz = makeQuizSet(quiz?.map((puzzle) => puzzle.id) ?? []);
    setQuiz(nextQuiz);
    setStep(0);
    setResults([]);
    setFeedback(null);
    setSelectedSquare(null);
    setPendingPromotion(null);
    setLastMove(null);
    setSolutionIndex(0);
    setMovePrompt('');
    setBoardFen(nextQuiz[0].fen);
    puzzleStartedAt.current = Date.now();
    setElapsed(0);
  }

  const currentPuzzle = quiz?.[step];
  const boardFlipped = currentPuzzle?.sideToMove === 'b';
  let position = null;
  let legalMoves = [];
  try {
    if (boardFen || currentPuzzle) {
      position = new Chess(boardFen || currentPuzzle.fen);
      if (selectedSquare && !feedback) legalMoves = position.moves({ square: selectedSquare, verbose: true });
    }
  } catch {
    position = null;
  }

  function attemptMove(from, to, promotion) {
    if (!currentPuzzle || feedback || !position) return;
    const candidate = position.moves({ square: from, verbose: true }).find((move) =>
      move.to === to && (move.promotion ?? '') === (promotion ?? ''),
    );
    if (!candidate) return;
    setPendingPromotion(null);
    const uci = `${candidate.from}${candidate.to}${candidate.promotion || ''}`;
    const correct = currentPuzzle.solution
      ? currentPuzzle.solution[solutionIndex] === uci
      : currentPuzzle.acceptedFirstMoves.includes(uci);
    const elapsedMs = Date.now() - puzzleStartedAt.current;
    const played = new Chess(boardFen);
    const playerMove = played.move({ from: candidate.from, to: candidate.to, promotion: candidate.promotion });
    setSelectedSquare(null);

    if (!correct) {
      setBoardFen(played.fen());
      setLastMove({ from: playerMove.from, to: playerMove.to });
      setResults((previous) => [...previous, {
        puzzleId: currentPuzzle.id,
        correct: false,
        elapsedMs,
        difficulty: currentPuzzle.difficulty,
        pattern: currentPuzzle.pattern,
      }]);
      setMovePrompt('');
      setFeedback({ correct: false, move: uci });
      return;
    }

    const solution = currentPuzzle.solution ?? [uci];
    const solved = solutionIndex + 1 >= solution.length;
    let lastPlayedMove = playerMove;
    if (!solved && solution[solutionIndex + 1]) {
      const reply = solution[solutionIndex + 1];
      lastPlayedMove = played.move({
        from: reply.slice(0, 2),
        to: reply.slice(2, 4),
        promotion: reply[4],
      });
    }
    setBoardFen(played.fen());
    setLastMove({ from: lastPlayedMove.from, to: lastPlayedMove.to });
    if (solved) {
      setResults((previous) => [...previous, {
        puzzleId: currentPuzzle.id,
        correct: true,
        elapsedMs,
        difficulty: currentPuzzle.difficulty,
        pattern: currentPuzzle.pattern,
      }]);
      setMovePrompt('');
      setFeedback({ correct: true, move: uci });
    } else {
      const nextSolutionIndex = solutionIndex + 2;
      setSolutionIndex(nextSolutionIndex);
      setMovePrompt(`Good move. Find move ${Math.floor(nextSolutionIndex / 2) + 1} of ${currentPuzzle.mateIn}.`);
    }
  }

  function handleSquareClick(square) {
    if (!currentPuzzle || feedback || !position) return;
    if (pendingPromotion) {
      if (square === pendingPromotion.to) return;
      setPendingPromotion(null);
    }
    const piece = position.get(square);
    if (!selectedSquare) {
      if (piece?.color === currentPuzzle.sideToMove) setSelectedSquare(square);
      return;
    }
    if (square === selectedSquare) {
      setSelectedSquare(null);
      return;
    }
    if (piece?.color === currentPuzzle.sideToMove) {
      setSelectedSquare(square);
      return;
    }
    const targetMoves = legalMoves.filter((move) => move.to === square);
    if (targetMoves.some((move) => move.promotion)) {
      const options = promotionOrder.filter((type) => targetMoves.some((move) => move.promotion === type));
      setPendingPromotion({
        from: selectedSquare,
        to: square,
        color: currentPuzzle.sideToMove,
        options,
      });
      return;
    }
    if (targetMoves[0]) attemptMove(selectedSquare, square);
  }

  function continueQuiz() {
    const nextStep = step + 1;
    setFeedback(null);
    setSelectedSquare(null);
    setPendingPromotion(null);
    setLastMove(null);
    setSolutionIndex(0);
    setMovePrompt('');
    setElapsed(0);
    if (nextStep < quiz.length) {
      setStep(nextStep);
      setBoardFen(quiz[nextStep].fen);
      puzzleStartedAt.current = Date.now();
    } else {
      setStep(nextStep);
    }
  }

  function retryPuzzle() {
    if (!currentPuzzle || feedback?.correct !== false) return;
    setResults((previous) => previous.filter((result) => result.puzzleId !== currentPuzzle.id));
    setFeedback(null);
    setSelectedSquare(null);
    setPendingPromotion(null);
    setLastMove(null);
    setSolutionIndex(0);
    setMovePrompt('');
    setBoardFen(currentPuzzle.fen);
    setElapsed(Date.now() - puzzleStartedAt.current);
  }

  async function redeemLicense(event) {
    event.preventDefault();
    setLicenseBusy(true);
    setLicenseError('');
    setLicenseSuccess(false);
    try {
      const verification = await fetch('/api/verify-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey }),
      });
      const payload = await verification.json();
      if (!verification.ok || !payload.valid) throw new Error(payload.error || 'This key could not be verified.');
      const { error } = await supabase.from('unlocked_users').upsert({
        user_id: user.id,
        unlocked: true,
        license_key: licenseKey.trim(),
        unlocked_at: new Date().toISOString(),
      });
      if (error) throw error;
      setUnlocked(true);
      setLicenseSuccess(true);
    } catch (caught) {
      setLicenseError(caught.message || 'Could not unlock the breakdown.');
    } finally {
      setLicenseBusy(false);
    }
  }

  if (!authLoaded) {
    return <main className="app-shell"><div className="loading panel">Loading your board…</div></main>;
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="app-shell">
        <header className="site-header"><div className="brand-mark">♞</div><span>Chess Talent Estimator</span></header>
        <section className="panel setup-panel">
          <div className="eyebrow">SETUP REQUIRED</div>
          <h1>Connect your Supabase project</h1>
          <p className="muted">Copy <code>.env.example</code> to <code>.env.local</code>, add your project URL and publishable key, then restart the dev server.</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="app-shell">
        <header className="site-header"><div className="brand-mark">♞</div><span>Chess Talent Estimator</span></header>
        <AuthPanel />
        <footer className="page-footer">Ten positions. One quick read. No rating pressure.</footer>
      </main>
    );
  }

  const assessment = results.length === QUIZ_LENGTH ? getAssessment(results) : null;
  const patternStats = patternCatalog.map((pattern) => {
    const attempts = results.filter((result) => result.pattern === pattern.key);
    return { ...pattern, attempts: attempts.length, correct: attempts.filter((result) => result.correct).length };
  });
  const bestPattern = [...patternStats].filter((item) => item.attempts).sort((a, b) => b.correct / b.attempts - a.correct / a.attempts)[0];
  const focusPattern = [...patternStats].filter((item) => item.attempts).sort((a, b) => a.correct / a.attempts - b.correct / b.attempts)[0];

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-lockup"><div className="brand-mark">♞</div><span>Chess Talent Estimator</span></div>
        <button className="text-button" onClick={signOut}>Sign out</button>
      </header>

      {!unlockChecked ? <div className="loading panel">Checking your access…</div> : null}

      {unlockChecked && !assessment && currentPuzzle && (
        <section className="quiz-layout panel">
          <div className="quiz-main">
            <div className="quiz-topline">
              <div><div className="eyebrow">FORCED-MATE PUZZLE</div><h1>Find the finish.</h1></div>
              <div className="puzzle-count">{step + 1}<span> / {QUIZ_LENGTH}</span></div>
            </div>
            <div className="progress-track" aria-label={`Puzzle ${step + 1} of ${QUIZ_LENGTH}`}><span style={{ width: `${((step + 1) / QUIZ_LENGTH) * 100}%` }} /></div>
            <div className="puzzle-meta"><span className="difficulty-dot" data-level={currentPuzzle.difficulty} />{currentPuzzle.difficulty} <span className="meta-divider">·</span> Mate in {currentPuzzle.mateIn}</div>
            <div className="board-wrap">
              <div className="chessboard" role="grid" aria-label="Chessboard. Select a piece, then its destination square.">
                {(position?.board() || []).map((row, rowIndex, board) => {
                  const displayedRow = boardFlipped ? board[7 - rowIndex] : row;
                  return displayedRow.map((_, columnIndex) => {
                  const visualColumn = boardFlipped ? 7 - columnIndex : columnIndex;
                  const visualRow = boardFlipped ? 7 - rowIndex : rowIndex;
                  const piece = displayedRow[visualColumn];
                  const square = getSquareName(visualRow, visualColumn);
                  const isLegalTarget = legalMoves.some((move) => move.to === square);
                  const isSelected = selectedSquare === square;
                  const isLastMove = lastMove?.from === square || lastMove?.to === square;
                  return (
                    <button
                      className={`square ${(visualRow + visualColumn) % 2 === 0 ? 'light-square' : 'dark-square'}${isSelected ? ' selected-square' : ''}${isLegalTarget ? ' legal-target' : ''}${isLastMove ? ' last-move' : ''}`}
                      key={square}
                      role="gridcell"
                      aria-label={`${square}${piece ? `, ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}${isLegalTarget ? ', legal destination' : ''}`}
                      onClick={() => handleSquareClick(square)}
                      disabled={Boolean(feedback)}
                    >
                      {piece && <span className={`piece ${piece.color === 'b' ? 'black-piece' : 'white-piece'}`}>{pieceGlyphs[piece.color][piece.type]}</span>}
                      {isLegalTarget && !piece && <span className="move-dot" />}
                      {isLegalTarget && piece && <span className="capture-ring" />}
                      {columnIndex === 0 && <span className="rank-label">{square[1]}</span>}
                      {rowIndex === 7 && <span className="file-label">{square[0]}</span>}
                    </button>
                  );
                  });
                })}
              </div>
            </div>
            {pendingPromotion && (
              <div className="promotion-picker" role="group" aria-label={`Choose a piece for promotion on ${pendingPromotion.to}`}>
                <span className="promotion-label">Promote to</span>
                {pendingPromotion.options.map((type) => (
                  <button
                    className="promotion-option"
                    key={type}
                    type="button"
                    aria-label={`Promote to ${promotionNames[type]}`}
                    onClick={() => attemptMove(pendingPromotion.from, pendingPromotion.to, type)}
                  >
                    <span className={`piece ${pendingPromotion.color === 'b' ? 'black-piece' : 'white-piece'}`} aria-hidden="true">{pieceGlyphs[pendingPromotion.color][type]}</span>
                  </button>
                ))}
                <button className="promotion-cancel" type="button" onClick={() => setPendingPromotion(null)}>Cancel</button>
              </div>
            )}
            <div className="board-instruction" role="status">
              {feedback ? (feedback.correct ? 'Correct. That is mate.' : 'Not the best move. The solution is shown.') : selectedSquare ? `Choose a destination for ${selectedSquare}.` : movePrompt || `Find mate in ${currentPuzzle.mateIn}. Select a piece to begin.`}
            </div>
            {feedback && (
              <div className="puzzle-actions">
                {feedback.correct === false && <button className="secondary-button" onClick={retryPuzzle}>Try again <span aria-hidden="true">↻</span></button>}
                <button className="primary-button continue-button" onClick={continueQuiz}>{step === QUIZ_LENGTH - 1 ? 'See my result' : 'Next puzzle'} <span aria-hidden="true">→</span></button>
              </div>
            )}
          </div>
          <aside className="quiz-aside">
            <div className="aside-stat"><span className="aside-icon">◷</span><div><span className="aside-label">Time on this puzzle</span><strong>{(feedback?.correct || feedback?.correct === false ? results[results.length - 1]?.elapsedMs ?? elapsed : elapsed) / 1000 | 0}s</strong></div></div>
            <div className="aside-rule" />
            <p className="aside-note">Find the forced line. Your opponent&apos;s replies follow automatically.</p>
            <div className="aside-bottom"><span className="tiny-board">♙</span><span>Verified tactical puzzles</span></div>
          </aside>
        </section>
      )}

      {unlockChecked && quiz && assessment && (
        <section className="panel result-panel">
          <div className="eyebrow">YOUR CHESS PROFILE</div>
          <div className="result-heading-row"><h1>{getAssessment(results).verdict}</h1><span className="result-spark">✳</span></div>
          <p className="muted result-copy">A quick read from ten tactical positions. Your full pattern breakdown is below.</p>
          <div className="result-summary"><div><strong>{results.filter((result) => result.correct).length}<small> / {QUIZ_LENGTH}</small></strong><span>positions solved</span></div><div><strong>{Math.round(results.reduce((sum, result) => sum + result.elapsedMs, 0) / results.length / 1000)}<small>s</small></strong><span>average solve time</span></div><div><strong>{new Set(results.filter((result) => result.correct).map((result) => result.difficulty)).size}<small> / 3</small></strong><span>difficulty levels cleared</span></div></div>
          <section className={`breakdown-card${unlocked ? ' is-unlocked' : ''}`}>
            {unlocked ? (
              <>
                <div className="breakdown-header"><div><div className="eyebrow">FULL BREAKDOWN</div><h2>Your tactical profile</h2></div><span className="unlocked-badge">UNLOCKED</span></div>
                <div className="rating-band"><span>Estimated rating band</span><strong>{assessment.rating}</strong><small>Directional estimate from a short puzzle sample, not a formal rating.</small></div>
                <div className="pattern-heading"><h3>Pattern read</h3><span>From this set</span></div>
                <div className="pattern-list">{patternStats.map((pattern) => (
                  <div className="pattern-row" key={pattern.name}>
                    <span>{pattern.name}</span>
                    {pattern.attempts ? <><span className="pattern-meter"><i style={{ width: `${(pattern.correct / pattern.attempts) * 100}%` }} /></span><strong>{pattern.correct}/{pattern.attempts}</strong></> : <span className="not-tested">Not tested</span>}
                  </div>
                ))}</div>
                <p className="profile-note">{bestPattern ? `Most convincing today: ${bestPattern.name}. ` : ''}{focusPattern && focusPattern !== bestPattern ? `A useful practice target: ${focusPattern.name}.` : 'More puzzle attempts will make the pattern read clearer.'} Pattern results are directional and based on this short sample.</p>
              </>
            ) : (
              <>
                <div className="blurred-content" aria-hidden="true">
                  <div className="breakdown-header"><div><div className="eyebrow">FULL BREAKDOWN</div><h2>Your tactical profile</h2></div><span className="lock-symbol">▣</span></div>
                  <div className="rating-band"><span>Estimated rating band</span><strong>{assessment.rating}</strong><small>Directional estimate from a short puzzle sample.</small></div>
                  <div className="pattern-heading"><h3>Pattern read</h3><span>From this set</span></div>
                  {patternStats.slice(0, 4).map((pattern) => <div className="pattern-row" key={pattern.name}><span>{pattern.name}</span><span className="pattern-meter"><i style={{ width: `${pattern.attempts ? (pattern.correct / pattern.attempts) * 100 : 34}%` }} /></span><strong>{pattern.attempts ? `${pattern.correct}/${pattern.attempts}` : '—'}</strong></div>)}
                </div>
                <div className="unlock-overlay">
                  <span className="lock-round">▣</span>
                  <h3>See what your moves say</h3>
                  <p>Unlock your estimated rating band and pattern-by-pattern read for a one-time $10.</p>
                  {gumroadUrl ? <a className="primary-button buy-button" href={gumroadUrl} target="_blank" rel="noreferrer">Get your license key <span aria-hidden="true">↗</span></a> : <button className="primary-button buy-button" type="button" disabled>Checkout unavailable</button>}
                  <form className="license-form" onSubmit={redeemLicense}>
                    <label htmlFor="license-key">Already have a key?</label>
                    <div className="license-entry"><input id="license-key" value={licenseKey} onChange={(event) => setLicenseKey(event.target.value)} placeholder="Paste license key" autoComplete="off" required /><button className="secondary-button" disabled={licenseBusy}>{licenseBusy ? 'Checking…' : 'Unlock'}</button></div>
                    {licenseError && <p className="inline-message error" role="alert">{licenseError}</p>}
                    {licenseSuccess && <p className="inline-message" role="status">Breakdown unlocked.</p>}
                  </form>
                </div>
              </>
            )}
          </section>
          <button className="text-button retake-button" onClick={beginNewQuiz}>Take another ten puzzles <span aria-hidden="true">↻</span></button>
        </section>
      )}

      <footer className="page-footer">A small puzzle set is a snapshot, not a verdict.</footer>
    </main>
  );
}
