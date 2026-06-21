import { useState, useEffect, useRef, useCallback } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg: "#0E0E0F",
  surface: "#1A1A1D",
  surfaceRaised: "#202024",
  border: "#2A2A2F",
  accent: "#C62828",
  accentSubtle: "#3B1010",
  accentText: "#EF5350",
  positive: "#4CAF80",
  negative: "#EF5350",
  textPrimary: "#F0F0F2",
  textSecondary: "#8A8A94",
  textTertiary: "#52525A",
  textDisabled: "#38383F",
  teamA: "#0F2540",
  teamAText: "#5B9BD5",
  teamABorder: "#1E3A5F",
  teamB: "#1E1028",
  teamBText: "#9C6FD6",
  teamBBorder: "#2D1B3D",
  white: "#FFFFFF",
};

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────
function calcRoundScore(bid, actual) {
  if (actual >= bid) return bid * 3 + (actual - bid);
  return -(bid * 3);
}

function recalcAllRounds(rounds, teams) {
  const totals = {};
  teams.forEach(t => totals[t.id] = 0);
  return rounds.map(r => {
    if (r.phase !== "complete") return r;
    const scores = {};
    teams.forEach(t => {
      scores[t.id] = calcRoundScore(r.teamBids[t.id] ?? 0, r.actualTricks[t.id] ?? 0);
      totals[t.id] = (totals[t.id] ?? 0) + scores[t.id];
    });
    return { ...r, scores, runningTotals: { ...totals } };
  });
}

function getDealerForRound(players, initialIdx, round) {
  return players[(initialIdx + round - 1) % 4];
}

// ─── LOCAL STORAGE ────────────────────────────────────────────────────────────
const SAVE_KEY = "deuce_game_v1";

function saveGame(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function makeRound(n) {
  return { roundNumber: n, phase: "bidding", bids: {}, teamBids: {}, actualTricks: {}, scores: {}, runningTotals: {} };
}

function initGame(players, teams, dealerIdx = 0) {
  return { players, teams, currentRound: 1, initialDealerIdx: dealerIdx, rounds: Array.from({ length: 13 }, (_, i) => makeRound(i + 1)) };
}

// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────

function Stepper({ value, onChange, min = 0, max = 13 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button onClick={() => value > min && onChange(value - 1)} disabled={value <= min}
        style={{ width: 40, height: 40, borderRadius: 8, background: C.surfaceRaised,
          border: `1px solid ${C.border}`, color: value <= min ? C.textDisabled : C.textPrimary,
          fontSize: 22, cursor: value <= min ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        −
      </button>
      <span style={{ fontFamily: "system-ui", fontSize: 28, fontWeight: 600,
        color: C.textPrimary, minWidth: 40, textAlign: "center", letterSpacing: -1 }}>
        {value}
      </span>
      <button onClick={() => value < max && onChange(value + 1)} disabled={value >= max}
        style={{ width: 40, height: 40, borderRadius: 8, background: C.surfaceRaised,
          border: `1px solid ${C.border}`, color: value >= max ? C.textDisabled : C.textPrimary,
          fontSize: 22, cursor: value >= max ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        +
      </button>
    </div>
  );
}

function AnimatedNumber({ value, color, size = 22 }) {
  const [delta, setDelta] = useState(null);
  const [show, setShow] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    const diff = value - prev.current;
    if (diff !== 0 && prev.current !== 0) {
      setDelta(diff); setShow(true);
      setTimeout(() => setShow(false), 1400);
    }
    prev.current = value;
  }, [value]);
  const fmt = n => n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {show && delta !== null && (
        <span style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
          fontSize: 11, fontWeight: 700, color: delta > 0 ? C.positive : C.negative,
          whiteSpace: "nowrap", fontFamily: "system-ui", pointerEvents: "none" }}>
          {fmt(delta)}
        </span>
      )}
      <span style={{ color, fontFamily: "system-ui", fontWeight: 700, fontSize: size, letterSpacing: -0.5 }}>
        {value < 0 ? `−${Math.abs(value)}` : value}
      </span>
    </div>
  );
}

function Btn({ label, onClick, variant = "primary", disabled = false, small = false }) {
  const base = {
    width: "100%", fontFamily: "system-ui", fontWeight: 600, borderRadius: 12,
    padding: small ? "10px 16px" : "15px 20px", border: "none", cursor: disabled ? "default" : "pointer",
    fontSize: small ? 13 : 16, letterSpacing: -0.2, transition: "opacity 0.15s",
    opacity: disabled ? 0.38 : 1,
  };
  const styles = {
    primary: { ...base, background: C.accent, color: C.white },
    secondary: { ...base, background: "transparent", border: `1px solid ${C.border}`, color: C.textPrimary },
    ghost: { ...base, background: "transparent", color: C.textSecondary, width: "auto", padding: "10px 16px" },
    danger: { ...base, background: "transparent", border: `1px solid ${C.accent}`, color: C.accentText },
  };
  return <button onClick={disabled ? undefined : onClick} style={styles[variant] || styles.primary}>{label}</button>;
}

function Label({ children, color = C.textTertiary }) {
  return <div style={{ fontFamily: "system-ui", fontSize: 9, fontWeight: 600,
    letterSpacing: 2, textTransform: "uppercase", color, marginBottom: 4 }}>{children}</div>;
}

function Modal({ visible, onClose, title, children }) {
  if (!visible) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100,
      display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: "20px 20px 0 0", width: "100%",
        maxWidth: 480, maxHeight: "85vh", overflowY: "auto",
        border: `1px solid ${C.border}`, borderBottom: "none", padding: "0 20px 40px" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 16px" }}>
          <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2 }} />
        </div>
        {title && <div style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 700,
          color: C.textPrimary, letterSpacing: -0.3, marginBottom: 16 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

// ─── TEAM CARD ────────────────────────────────────────────────────────────────
function TeamCard({ team, players, roundNum, phase, bids, tricks, onBidChange, onTricksChange, runningTotal }) {
  const isA = team.scheme === "A";
  const accent = isA ? C.teamAText : C.teamBText;
  const bg = isA ? C.teamA : C.teamB;
  const borderCol = isA ? C.teamABorder : C.teamBBorder;
  const teamPlayers = players.filter(p => team.playerIds.includes(p.id));
  const teamBid = teamPlayers.reduce((s, p) => s + (bids[p.id] ?? 0), 0);
  const teamTricks = tricks[team.id] ?? 0;
  const roundScore = phase === "complete" ? calcRoundScore(teamBid, teamTricks) : null;
  const scoreColor = roundScore === null ? C.textTertiary : roundScore >= 0 ? C.positive : C.negative;
  const totalColor = runningTotal > 0 ? C.positive : runningTotal < 0 ? C.negative : C.textSecondary;

  return (
    <div style={{ background: bg, borderRadius: 14, border: `1px solid ${borderCol}`, overflow: "hidden", marginBottom: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "10px 14px 10px 0" }}>
        <div style={{ width: 3, background: accent, alignSelf: "stretch", marginRight: 12, borderRadius: 2, minHeight: 36 }} />
        <span style={{ flex: 1, fontFamily: "system-ui", fontSize: 10, fontWeight: 600,
          letterSpacing: 2, textTransform: "uppercase", color: accent }}>{team.name}</span>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "system-ui", fontSize: 9, letterSpacing: 1.5,
            textTransform: "uppercase", color: C.textTertiary, marginBottom: 2 }}>Total</div>
          <AnimatedNumber value={runningTotal} color={totalColor} size={22} />
        </div>
      </div>

      <div style={{ height: 1, background: `${accent}22` }} />

      {/* Player rows */}
      <div style={{ padding: "6px 14px" }}>
        {teamPlayers.map(player => (
          <div key={player.id} style={{ display: "flex", alignItems: "center",
            justifyContent: "space-between", minHeight: 52 }}>
            <span style={{ fontFamily: "system-ui", fontSize: 15, color: C.textPrimary, flex: 1 }}>
              {player.name}
            </span>
            {phase === "bidding" ? (
              <Stepper value={bids[player.id] ?? 0} onChange={val => onBidChange(player.id, val)} min={0} max={roundNum} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "system-ui", fontSize: 10, letterSpacing: 1.5,
                  textTransform: "uppercase", color: C.textTertiary }}>Bid</span>
                <span style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 700, color: accent }}>
                  {bids[player.id] ?? 0}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: `${accent}22` }} />

      {/* Bottom stats */}
      <div style={{ display: "flex", padding: "10px 14px", gap: 8 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <Label>Contract</Label>
          <span style={{ fontFamily: "system-ui", fontSize: 24, fontWeight: 700, color: accent, letterSpacing: -1 }}>
            {teamBid}
          </span>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <Label>Tricks</Label>
          {phase === "tricks" ? (
            <Stepper value={tricks[team.id] ?? 0} onChange={val => onTricksChange(team.id, val)} min={0} max={roundNum} />
          ) : phase === "complete" ? (
            <span style={{ fontFamily: "system-ui", fontSize: 24, fontWeight: 700, color: C.textPrimary, letterSpacing: -1 }}>
              {teamTricks}
            </span>
          ) : (
            <span style={{ fontFamily: "system-ui", fontSize: 24, color: C.textDisabled }}>—</span>
          )}
        </div>
        <div style={{ flex: 1, textAlign: "center", borderLeft: `1px solid ${C.border}` }}>
          <Label>Round</Label>
          {roundScore !== null ? (
            <span style={{ fontFamily: "system-ui", fontSize: 24, fontWeight: 700, color: scoreColor, letterSpacing: -1 }}>
              {roundScore >= 0 ? `+${roundScore}` : `−${Math.abs(roundScore)}`}
            </span>
          ) : (
            <span style={{ fontFamily: "system-ui", fontSize: 24, color: C.textDisabled }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VALIDATION BAR ───────────────────────────────────────────────────────────
function ValidationBar({ entered, required }) {
  const pct = Math.min(entered / Math.max(required, 1), 1);
  const isOver = entered > required;
  const isValid = entered === required;
  const fillColor = isOver ? C.accent : isValid ? C.positive : C.textTertiary;
  const msg = isValid ? `✓ All ${required} tricks accounted for`
    : isOver ? `Too many — reduce by ${entered - required}`
    : `${entered} of ${required} — ${required - entered} remaining`;
  return (
    <div style={{ margin: "4px 0 8px" }}>
      <div style={{ height: 2, background: C.border, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: fillColor,
          borderRadius: 2, transition: "width 0.2s ease, background 0.15s" }} />
      </div>
      <div style={{ textAlign: "center", fontFamily: "system-ui", fontSize: 11, letterSpacing: 0.5,
        color: isValid ? C.positive : isOver ? C.accentText : C.textSecondary }}>
        {msg}
      </div>
    </div>
  );
}

// ─── SCREEN: HOME ─────────────────────────────────────────────────────────────
function HomeScreen({ onNewGame, onContinue, hasSaved }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "40px 28px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <div style={{ flex: 1, height: 1, background: C.accent }} />
          <span style={{ fontFamily: "system-ui", fontSize: 40, fontWeight: 800,
            letterSpacing: 10, color: C.textPrimary }}>DEUCE</span>
          <div style={{ flex: 1, height: 1, background: C.accent }} />
        </div>
        <div style={{ textAlign: "center", fontFamily: "system-ui", fontSize: 10,
          letterSpacing: 5, textTransform: "uppercase", color: C.textTertiary, marginBottom: 64 }}>
          The Master Key
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Btn label="New Game" onClick={onNewGame} variant="primary" />
          {hasSaved && <Btn label="Continue Game" onClick={onContinue} variant="secondary" />}
          <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
          <div style={{ textAlign: "center", fontFamily: "system-ui", fontSize: 11,
            color: C.textTertiary, letterSpacing: 0.3, lineHeight: 1.6 }}>
            4 players · 2 teams · 13 rounds<br />
            Score keeps automatically
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 64, fontFamily: "system-ui",
          fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: C.textDisabled }}>
          DEUCE: The Master Key · Companion App
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN: SETUP ────────────────────────────────────────────────────────────
function SetupScreen({ onStart, onBack }) {
  const [step, setStep] = useState("players");
  const [names, setNames] = useState(["", "", "", ""]);
  const [teamNames, setTeamNames] = useState(["Team Alpha", "Team Bravo"]);
  const [assignment, setAssignment] = useState([["0", "2"], ["1", "3"]]);
  const [errors, setErrors] = useState(["", "", "", ""]);

  const validateAndNext = () => {
    const errs = ["", "", "", ""];
    let ok = true;
    const seen = [];
    for (let i = 0; i < 4; i++) {
      const n = names[i].trim();
      if (!n) { errs[i] = "Required"; ok = false; }
      else if (seen.includes(n.toLowerCase())) { errs[i] = "Duplicate name"; ok = false; }
      else seen.push(n.toLowerCase());
    }
    setErrors(errs);
    if (ok) setStep("teams");
  };

  const swapPlayer = (idx) => {
    const fromTeam = assignment[0].includes(idx) ? 0 : 1;
    const toTeam = fromTeam === 0 ? 1 : 0;
    const newA = [[...assignment[0]], [...assignment[1]]];
    newA[fromTeam] = newA[fromTeam].filter(i => i !== idx);
    if (newA[toTeam].length >= 2) {
      const bumped = newA[toTeam].pop();
      newA[fromTeam].push(bumped);
    }
    newA[toTeam].push(idx);
    setAssignment(newA);
  };

  const randomize = () => {
    const idx = ["0","1","2","3"].sort(() => Math.random() - 0.5);
    setAssignment([[idx[0], idx[1]], [idx[2], idx[3]]]);
  };

  const handleStart = () => {
    const players = names.map((n, i) => ({
      id: `p${i}`, name: n.trim(),
      teamId: assignment[0].includes(String(i)) ? "ta" : "tb"
    }));
    const dealerIdx = Math.floor(Math.random() * 4);
    onStart(players, [
      { id: "ta", name: teamNames[0].trim() || "Team Alpha",
        playerIds: [players[parseInt(assignment[0][0])].id, players[parseInt(assignment[0][1])].id], scheme: "A" },
      { id: "tb", name: teamNames[1].trim() || "Team Bravo",
        playerIds: [players[parseInt(assignment[1][0])].id, players[parseInt(assignment[1][1])].id], scheme: "B" },
    ], dealerIdx);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 40px" }}>
      {/* Back + steps */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <button onClick={step === "teams" ? () => setStep("players") : onBack}
          style={{ background: "none", border: "none", color: C.textTertiary,
            fontFamily: "system-ui", fontSize: 13, cursor: "pointer", padding: 0 }}>
          ← Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: step === "players" ? C.accent : C.positive }} />
          <div style={{ width: 20, height: 1, background: C.border }} />
          <div style={{ width: 8, height: 8, borderRadius: 4, background: step === "teams" ? C.accent : C.border }} />
        </div>
      </div>

      {step === "players" ? (
        <>
          <div style={{ fontFamily: "system-ui", fontSize: 26, fontWeight: 700,
            color: C.textPrimary, letterSpacing: -0.5, marginBottom: 6 }}>Players</div>
          <div style={{ fontFamily: "system-ui", fontSize: 14, color: C.textSecondary, marginBottom: 24 }}>
            Enter the name of each person playing.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
            {names.map((n, i) => (
              <div key={i}>
                <Label>Player {i + 1}</Label>
                <input value={n} onChange={e => { const u = [...names]; u[i] = e.target.value; setNames(u); const errs = [...errors]; errs[i] = ""; setErrors(errs); }}
                  placeholder={`Player ${i + 1}`}
                  style={{ width: "100%", background: C.surface, border: `1px solid ${errors[i] ? C.accent : C.border}`,
                    borderRadius: 10, padding: "13px 14px", color: C.textPrimary,
                    fontFamily: "system-ui", fontSize: 16, boxSizing: "border-box", outline: "none" }} />
                {errors[i] && <div style={{ fontFamily: "system-ui", fontSize: 11, color: C.accentText, marginTop: 4 }}>{errors[i]}</div>}
              </div>
            ))}
          </div>
          <Btn label="Assign Teams →" onClick={validateAndNext} />
        </>
      ) : (
        <>
          <div style={{ fontFamily: "system-ui", fontSize: 26, fontWeight: 700,
            color: C.textPrimary, letterSpacing: -0.5, marginBottom: 6 }}>Teams</div>
          <div style={{ fontFamily: "system-ui", fontSize: 14, color: C.textSecondary, marginBottom: 16 }}>
            Tap any player to move them to the other team.
          </div>

          <button onClick={randomize} style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "8px 14px", color: C.textSecondary, fontFamily: "system-ui",
            fontSize: 12, cursor: "pointer", marginBottom: 16 }}>
            🔀 Randomize
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
            {[0, 1].map(ti => (
              <div key={ti} style={{ background: ti === 0 ? C.teamA : C.teamB,
                border: `1px solid ${ti === 0 ? C.teamABorder : C.teamBBorder}`,
                borderRadius: 14, padding: 16 }}>
                <input value={teamNames[ti]}
                  onChange={e => { const u = [...teamNames]; u[ti] = e.target.value; setTeamNames(u); }}
                  style={{ background: "transparent", border: "none",
                    borderBottom: `1px solid ${ti === 0 ? C.teamABorder : C.teamBBorder}`,
                    color: ti === 0 ? C.teamAText : C.teamBText, fontFamily: "system-ui",
                    fontSize: 16, fontWeight: 700, outline: "none", width: "100%",
                    paddingBottom: 8, marginBottom: 12, letterSpacing: -0.3 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {assignment[ti].map(idx => (
                    <div key={idx} onClick={() => swapPlayer(idx)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: C.surfaceRaised, borderRadius: 10, padding: "12px 14px",
                        cursor: "pointer", border: `1px solid ${C.border}` }}>
                      <span style={{ fontFamily: "system-ui", fontSize: 15, color: C.textPrimary }}>
                        {names[parseInt(idx)]}
                      </span>
                      <span style={{ fontFamily: "system-ui", fontSize: 11, color: C.textTertiary }}>
                        move →
                      </span>
                    </div>
                  ))}
                  {assignment[ti].length < 2 && (
                    <div style={{ border: `1px dashed ${C.border}`, borderRadius: 10,
                      padding: "12px 14px", textAlign: "center" }}>
                      <span style={{ fontFamily: "system-ui", fontSize: 12, color: C.textDisabled }}>
                        Tap a player above to add
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Btn label="Start Game" onClick={handleStart}
            disabled={assignment[0].length !== 2 || assignment[1].length !== 2} />
        </>
      )}
    </div>
  );
}

// ─── SCREEN: GAME ─────────────────────────────────────────────────────────────
function GameScreen({ gameState, onAction, onShowHistory, onAbandon }) {
  const { players, teams, currentRound, rounds, initialDealerIdx } = gameState;
  const roundData = rounds[currentRound - 1];
  const phase = roundData.phase;
  const dealer = getDealerForRound(players, initialDealerIdx, currentRound);

  const [bids, setBids] = useState(() => {
    const b = {};
    players.forEach(p => b[p.id] = roundData.bids[p.id] ?? 0);
    return b;
  });
  const [tricks, setTricks] = useState(() => {
    const t = {};
    teams.forEach(t2 => t[t2.id] = roundData.actualTricks?.[t2.id] ?? 0);
    return t;
  });
  const [showUndo, setShowUndo] = useState(false);
  const [showAbandon, setShowAbandon] = useState(false);

  // Reset when round changes
  useEffect(() => {
    const r = rounds[currentRound - 1];
    const b = {};
    players.forEach(p => b[p.id] = r.bids[p.id] ?? 0);
    setBids(b);
    const t = {};
    teams.forEach(t2 => t[t2.id] = r.actualTricks?.[t2.id] ?? 0);
    setTricks(t);
  }, [currentRound]);

  const totalTricks = Object.values(tricks).reduce((a, b) => a + b, 0);
  const tricksValid = totalTricks === currentRound;

  const getRunningTotal = (teamId) => {
    if (phase === "complete") return roundData.runningTotals?.[teamId] ?? 0;
    if (currentRound <= 1) return 0;
    return rounds[currentRound - 2].runningTotals?.[teamId] ?? 0;
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Round header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "10px 16px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <Label>Round</Label>
            <div style={{ fontFamily: "system-ui", fontSize: 22, fontWeight: 700,
              color: C.textPrimary, letterSpacing: -0.5 }}>
              {currentRound} <span style={{ color: C.textTertiary, fontSize: 15, fontWeight: 400 }}>of 13</span>
            </div>
          </div>
          <div style={{ width: 1, height: 36, background: C.border, margin: "0 16px" }} />
          <div style={{ textAlign: "right" }}>
            <Label>Dealer</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: C.accent }} />
              <span style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 700, color: C.textPrimary }}>
                {dealer.name}
              </span>
            </div>
          </div>
        </div>
        {/* Progress */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: C.border }}>
          <div style={{ height: "100%", width: `${(currentRound / 13) * 100}%`,
            background: C.accent, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={() => setShowAbandon(true)}
          style={{ background: "none", border: "none", color: C.textTertiary,
            fontFamily: "system-ui", fontSize: 12, cursor: "pointer", padding: "4px 0" }}>
          ✕ Quit
        </button>
        <div style={{ fontFamily: "system-ui", fontSize: 10, letterSpacing: 2,
          textTransform: "uppercase", color: C.textTertiary }}>
          {phase === "bidding" ? "Enter Bids" : phase === "tricks" ? "Enter Tricks" : "Round Complete"}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {currentRound > 1 && phase === "bidding" && (
            <button onClick={() => setShowUndo(true)}
              style={{ background: "none", border: "none", color: C.textTertiary,
                fontFamily: "system-ui", fontSize: 12, cursor: "pointer", padding: "4px 0" }}>
              ↩ Undo
            </button>
          )}
          <button onClick={onShowHistory}
            style={{ background: "none", border: "none", color: C.textTertiary,
              fontFamily: "system-ui", fontSize: 12, cursor: "pointer", padding: "4px 0" }}>
            History
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 20px" }}>
        {teams.map(team => (
          <TeamCard key={team.id} team={team} players={players} roundNum={currentRound}
            phase={phase} bids={bids} tricks={tricks}
            onBidChange={(pid, val) => setBids(p => ({ ...p, [pid]: val }))}
            onTricksChange={(tid, val) => setTricks(p => ({ ...p, [tid]: val }))}
            runningTotal={getRunningTotal(team.id)} />
        ))}

        {phase === "tricks" && <ValidationBar entered={totalTricks} required={currentRound} />}

        <div style={{ textAlign: "center", fontFamily: "system-ui", fontSize: 11,
          color: C.textDisabled, marginTop: 4 }}>
          {currentRound} {currentRound === 1 ? "card" : "cards"} dealt this round
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: "10px 14px 20px", borderTop: `1px solid ${C.border}`, flexShrink: 0, background: C.bg }}>
        {phase === "bidding" && (
          <Btn label="Lock Bids →" onClick={() => onAction({ type: "lockBids", bids })} />
        )}
        {phase === "tricks" && (
          <Btn label="Complete Round" onClick={() => tricksValid && onAction({ type: "completeRound", tricks })}
            disabled={!tricksValid} />
        )}
        {phase === "complete" && (
          <Btn label={currentRound === 13 ? "See Results →" : `Start Round ${currentRound + 1} →`}
            onClick={() => onAction({ type: "nextRound" })} />
        )}
      </div>

      {/* Undo modal */}
      <Modal visible={showUndo} onClose={() => setShowUndo(false)} title="Undo Last Round?">
        <div style={{ fontFamily: "system-ui", fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>
          This will erase Round {currentRound - 1}'s scores and go back to bidding.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn label="Yes, Undo" onClick={() => { setShowUndo(false); onAction({ type: "undo" }); }} variant="danger" />
          <Btn label="Cancel" onClick={() => setShowUndo(false)} variant="ghost" />
        </div>
      </Modal>

      {/* Abandon modal */}
      <Modal visible={showAbandon} onClose={() => setShowAbandon(false)} title="Quit Game?">
        <div style={{ fontFamily: "system-ui", fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>
          Your progress will be saved. You can continue later from the home screen.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn label="Save & Quit" onClick={() => { setShowAbandon(false); onAbandon(); }} variant="secondary" />
          <Btn label="Keep Playing" onClick={() => setShowAbandon(false)} variant="ghost" />
        </div>
      </Modal>
    </div>
  );
}

// ─── SCREEN: HISTORY ─────────────────────────────────────────────────────────
function HistoryScreen({ gameState, onClose, onEdit }) {
  const { rounds, teams, players } = gameState;
  const done = [...rounds].filter(r => r.phase === "complete").reverse();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 700, color: C.textPrimary }}>
          Round History
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none",
          color: C.textTertiary, fontFamily: "system-ui", fontSize: 13, cursor: "pointer" }}>
          Close
        </button>
      </div>

      {done.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "system-ui", fontSize: 14, color: C.textSecondary }}>
            No rounds completed yet.
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 40px" }}>
          {done.map(round => {
            const dealer = getDealerForRound(players, gameState.initialDealerIdx, round.roundNumber);
            return (
              <div key={round.roundNumber} style={{ paddingVertical: 14,
                borderBottom: `1px solid ${C.border}`, paddingTop: 14, paddingBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ background: C.surfaceRaised, borderRadius: 6,
                    padding: "3px 10px", fontFamily: "system-ui", fontSize: 11,
                    fontWeight: 600, color: C.textTertiary, letterSpacing: 0.5 }}>
                    R{round.roundNumber}
                  </div>
                  <div style={{ fontFamily: "system-ui", fontSize: 11, color: C.textTertiary }}>
                    Dealer: {dealer.name}
                  </div>
                  <button onClick={() => onEdit(round.roundNumber)}
                    style={{ marginLeft: "auto", background: "none", border: "none",
                      color: C.accentText, fontFamily: "system-ui", fontSize: 11, cursor: "pointer" }}>
                    Edit
                  </button>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  {teams.map(t => {
                    const isA = t.scheme === "A";
                    const accent = isA ? C.teamAText : C.teamBText;
                    const score = round.scores?.[t.id] ?? 0;
                    const total = round.runningTotals?.[t.id] ?? 0;
                    const bid = round.teamBids?.[t.id] ?? 0;
                    const actual = round.actualTricks?.[t.id] ?? 0;
                    const teamPlayers = players.filter(p => t.playerIds.includes(p.id));
                    return (
                      <div key={t.id} style={{ flex: 1 }}>
                        <div style={{ fontFamily: "system-ui", fontSize: 10, fontWeight: 600,
                          letterSpacing: 1.5, textTransform: "uppercase", color: accent, marginBottom: 6 }}>
                          {t.name}
                        </div>
                        {teamPlayers.map(p => (
                          <div key={p.id} style={{ display: "flex", justifyContent: "space-between",
                            fontFamily: "system-ui", fontSize: 12, marginBottom: 3 }}>
                            <span style={{ color: C.textSecondary }}>{p.name}</span>
                            <span style={{ color: C.textTertiary }}>bid {round.bids?.[p.id] ?? 0}</span>
                          </div>
                        ))}
                        <div style={{ height: 1, background: C.border, margin: "6px 0" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontFamily: "system-ui", fontSize: 11, color: C.textTertiary }}>
                            {bid} → {actual}
                          </span>
                          <span style={{ fontFamily: "system-ui", fontSize: 15, fontWeight: 700,
                            color: score >= 0 ? C.positive : C.negative }}>
                            {score >= 0 ? `+${score}` : `−${Math.abs(score)}`}
                          </span>
                        </div>
                        <div style={{ fontFamily: "system-ui", fontSize: 11,
                          color: total >= 0 ? C.textSecondary : C.negative, marginTop: 2 }}>
                          Total: {total < 0 ? `−${Math.abs(total)}` : total}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── EDIT ROUND MODAL ─────────────────────────────────────────────────────────
function EditRoundModal({ visible, roundNumber, gameState, onSave, onClose }) {
  const round = gameState?.rounds.find(r => r.roundNumber === roundNumber);
  const [editBids, setEditBids] = useState({});
  const [editTricks, setEditTricks] = useState({});

  useEffect(() => {
    if (!round || !gameState) return;
    const b = {};
    gameState.players.forEach(p => b[p.id] = round.bids?.[p.id] ?? 0);
    setEditBids(b);
    const t = {};
    gameState.teams.forEach(t2 => t[t2.id] = round.actualTricks?.[t2.id] ?? 0);
    setEditTricks(t);
  }, [roundNumber, visible]);

  if (!round || !gameState) return null;
  const total = Object.values(editTricks).reduce((a, b) => a + b, 0);
  const valid = total === roundNumber;

  return (
    <Modal visible={visible} onClose={onClose} title={`Edit Round ${roundNumber}`}>
      <div style={{ fontFamily: "system-ui", fontSize: 13, color: C.textSecondary, marginBottom: 20 }}>
        {roundNumber} cards dealt. All later rounds will recalculate automatically.
      </div>

      <Label>Player Bids</Label>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        {gameState.players.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "system-ui", fontSize: 15, color: C.textPrimary }}>{p.name}</span>
            <Stepper value={editBids[p.id] ?? 0} onChange={val => setEditBids(prev => ({ ...prev, [p.id]: val }))}
              min={0} max={roundNumber} />
          </div>
        ))}
      </div>

      <Label>Tricks Won</Label>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {gameState.teams.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "system-ui", fontSize: 15, color: C.textPrimary }}>{t.name}</span>
            <Stepper value={editTricks[t.id] ?? 0} onChange={val => setEditTricks(prev => ({ ...prev, [t.id]: val }))}
              min={0} max={roundNumber} />
          </div>
        ))}
      </div>

      <ValidationBar entered={total} required={roundNumber} />

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Btn label="Cancel" onClick={onClose} variant="ghost" />
        <Btn label="Save & Recalculate" onClick={() => valid && onSave(roundNumber, editBids, editTricks)} disabled={!valid} />
      </div>
    </Modal>
  );
}

// ─── SCREEN: SUMMARY ──────────────────────────────────────────────────────────
function SummaryScreen({ gameState, onPlayAgain, onNewTeams, onHome }) {
  const { players, teams, rounds } = gameState;
  const last = rounds[12];
  const totals = last?.runningTotals ?? {};
  const [ta, tb] = teams;
  const scoreA = totals[ta.id] ?? 0;
  const scoreB = totals[tb.id] ?? 0;
  const winner = scoreA > scoreB ? ta : scoreB > scoreA ? tb : null;
  const margin = Math.abs(scoreA - scoreB);
  const totalTricks = tid => rounds.filter(r => r.phase === "complete").reduce((s, r) => s + (r.actualTricks?.[tid] ?? 0), 0);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 20px 60px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ display: "inline-block", border: `1px solid ${C.accent}`,
          borderRadius: 99, padding: "5px 18px", marginBottom: 18 }}>
          <span style={{ fontFamily: "system-ui", fontSize: 9, letterSpacing: 3,
            textTransform: "uppercase", color: C.accent }}>Mission Complete</span>
        </div>
        {winner ? (
          <>
            <div style={{ fontFamily: "system-ui", fontSize: 36, fontWeight: 800,
              color: C.textPrimary, letterSpacing: -1.5, marginBottom: 6 }}>{winner.name}</div>
            <div style={{ fontFamily: "system-ui", fontSize: 12, letterSpacing: 1,
              textTransform: "uppercase", color: C.textTertiary }}>
              wins by {margin} point{margin !== 1 ? "s" : ""}
            </div>
          </>
        ) : (
          <div style={{ fontFamily: "system-ui", fontSize: 36, fontWeight: 800, color: C.textPrimary }}>
            It's a Draw
          </div>
        )}
      </div>

      {/* Score cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {teams.map(t => {
          const isA = t.scheme === "A";
          const accent = isA ? C.teamAText : C.teamBText;
          const score = totals[t.id] ?? 0;
          const isWinner = winner?.id === t.id;
          return (
            <div key={t.id} style={{ flex: 1, background: isA ? C.teamA : C.teamB,
              border: `1px solid ${isWinner ? C.accent : isA ? C.teamABorder : C.teamBBorder}`,
              borderRadius: 14, padding: 14 }}>
              {isWinner && <div style={{ fontFamily: "system-ui", fontSize: 9, letterSpacing: 2,
                textTransform: "uppercase", color: C.accent, marginBottom: 6 }}>Winner</div>}
              <div style={{ fontFamily: "system-ui", fontSize: 13, fontWeight: 700,
                color: accent, marginBottom: 6 }}>{t.name}</div>
              {t.playerIds.map(pid => {
                const p = players.find(pl => pl.id === pid);
                return <div key={pid} style={{ fontFamily: "system-ui", fontSize: 12, color: C.textSecondary }}>{p?.name}</div>;
              })}
              <div style={{ height: 1, background: C.border, margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "system-ui", fontSize: 10, letterSpacing: 1.5,
                  textTransform: "uppercase", color: C.textTertiary }}>Score</span>
                <span style={{ fontFamily: "system-ui", fontSize: 26, fontWeight: 700, letterSpacing: -1,
                  color: score >= 0 ? C.positive : C.negative }}>
                  {score < 0 ? `−${Math.abs(score)}` : score}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span style={{ fontFamily: "system-ui", fontSize: 10, letterSpacing: 1.5,
                  textTransform: "uppercase", color: C.textTertiary }}>Tricks</span>
                <span style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 600, color: C.textPrimary }}>
                  {totalTricks(t.id)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Score progression */}
      <div style={{ fontFamily: "system-ui", fontSize: 9, letterSpacing: 2,
        textTransform: "uppercase", color: C.textTertiary, marginBottom: 10 }}>
        Score Progression
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: "12px 14px", marginBottom: 28 }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, paddingBottom: 6, marginBottom: 6 }}>
          <span style={{ fontFamily: "system-ui", fontSize: 10, color: C.textTertiary, width: 28 }}>Rnd</span>
          {teams.map(t => (
            <span key={t.id} style={{ flex: 1, fontFamily: "system-ui", fontSize: 10, textAlign: "center",
              color: t.scheme === "A" ? C.teamAText : C.teamBText }}>{t.name}</span>
          ))}
        </div>
        {rounds.filter(r => r.phase === "complete").map(r => (
          <div key={r.roundNumber} style={{ display: "flex", padding: "3px 0" }}>
            <span style={{ fontFamily: "system-ui", fontSize: 10, color: C.textTertiary, width: 28 }}>
              {r.roundNumber}
            </span>
            {teams.map(t => {
              const score = r.scores?.[t.id] ?? 0;
              const total = r.runningTotals?.[t.id] ?? 0;
              return (
                <div key={t.id} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontFamily: "system-ui", fontSize: 10,
                    color: score >= 0 ? C.positive : C.negative }}>
                    {score >= 0 ? `+${score}` : `−${Math.abs(score)}`}
                  </div>
                  <div style={{ fontFamily: "system-ui", fontSize: 9, color: C.textSecondary }}>
                    {total < 0 ? `−${Math.abs(total)}` : total}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn label="Play Again — Same Teams" onClick={onPlayAgain} />
        <Btn label="Play Again — New Teams" onClick={onNewTeams} variant="secondary" />
        <Btn label="Return Home" onClick={onHome} variant="ghost" />
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function DeuceApp() {
  const [screen, setScreen] = useState("home");
  const [gameState, setGameState] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editingRound, setEditingRound] = useState(null);

  // Load saved game on mount
  useEffect(() => {
    const saved = loadGame();
    if (saved) setGameState(saved);
  }, []);

  // Auto-save whenever gameState changes
  useEffect(() => {
    if (gameState) saveGame(gameState);
  }, [gameState]);

  const updateGame = useCallback((updater) => {
    setGameState(prev => {
      const next = updater(prev);
      saveGame(next);
      return next;
    });
  }, []);

  const handleAction = (action) => {
    if (action.type === "lockBids") {
      updateGame(prev => {
        const rounds = [...prev.rounds];
        const round = { ...rounds[prev.currentRound - 1] };
        const teamBids = {};
        prev.teams.forEach(t => {
          teamBids[t.id] = t.playerIds.reduce((s, pid) => s + (action.bids[pid] ?? 0), 0);
        });
        round.bids = { ...action.bids };
        round.teamBids = teamBids;
        round.phase = "tricks";
        rounds[prev.currentRound - 1] = round;
        return { ...prev, rounds };
      });
    }

    if (action.type === "completeRound") {
      updateGame(prev => {
        const rounds = [...prev.rounds];
        const round = { ...rounds[prev.currentRound - 1] };
        round.actualTricks = { ...action.tricks };
        round.phase = "complete";
        rounds[prev.currentRound - 1] = round;
        const recalc = recalcAllRounds(rounds, prev.teams);
        return { ...prev, rounds: recalc };
      });
    }

    if (action.type === "nextRound") {
      if (gameState.currentRound === 13) {
        setScreen("summary");
        return;
      }
      updateGame(prev => ({ ...prev, currentRound: prev.currentRound + 1 }));
    }

    if (action.type === "undo") {
      updateGame(prev => {
        if (prev.currentRound <= 1) return prev;
        const rounds = [...prev.rounds];
        // Reset previous round back to bidding
        const prevRound = { ...rounds[prev.currentRound - 2] };
        prevRound.phase = "bidding";
        prevRound.bids = {};
        prevRound.teamBids = {};
        prevRound.actualTricks = {};
        prevRound.scores = {};
        prevRound.runningTotals = prev.currentRound > 2 ? rounds[prev.currentRound - 3].runningTotals : {};
        rounds[prev.currentRound - 2] = prevRound;
        // Reset current round too
        rounds[prev.currentRound - 1] = makeRound(prev.currentRound);
        return { ...prev, currentRound: prev.currentRound - 1, rounds };
      });
    }
  };

  const handleEditSave = (roundNumber, newBids, newTricks) => {
    updateGame(prev => {
      const rounds = [...prev.rounds];
      const round = { ...rounds[roundNumber - 1] };
      const teamBids = {};
      prev.teams.forEach(t => {
        teamBids[t.id] = t.playerIds.reduce((s, pid) => s + (newBids[pid] ?? 0), 0);
      });
      round.bids = { ...newBids };
      round.teamBids = teamBids;
      round.actualTricks = { ...newTricks };
      round.phase = "complete";
      rounds[roundNumber - 1] = round;
      const recalc = recalcAllRounds(rounds, prev.teams);
      return { ...prev, rounds: recalc };
    });
    setEditingRound(null);
  };

  const hasSaved = !!gameState;

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg,
      display: "flex", flexDirection: "column", overflow: "hidden",
      fontFamily: "system-ui", maxWidth: 480, margin: "0 auto" }}>

      {screen === "home" && (
        <HomeScreen
          onNewGame={() => { clearGame(); setGameState(null); setScreen("setup"); }}
          onContinue={() => setScreen("game")}
          hasSaved={hasSaved && gameState?.currentRound <= 13}
        />
      )}

      {screen === "setup" && (
        <SetupScreen
          onStart={(players, teams, dealerIdx) => {
            const g = initGame(players, teams, dealerIdx);
            setGameState(g);
            saveGame(g);
            setScreen("game");
          }}
          onBack={() => setScreen("home")}
        />
      )}

      {screen === "game" && gameState && !showHistory && (
        <GameScreen
          gameState={gameState}
          onAction={handleAction}
          onShowHistory={() => setShowHistory(true)}
          onAbandon={() => setScreen("home")}
        />
      )}

      {screen === "game" && gameState && showHistory && (
        <HistoryScreen
          gameState={gameState}
          onClose={() => setShowHistory(false)}
          onEdit={(n) => { setEditingRound(n); setShowHistory(false); }}
        />
      )}

      {screen === "summary" && gameState && (
        <SummaryScreen
          gameState={gameState}
          onPlayAgain={() => {
            const g = initGame(gameState.players, gameState.teams);
            setGameState(g);
            saveGame(g);
            setScreen("game");
          }}
          onNewTeams={() => { clearGame(); setGameState(null); setScreen("setup"); }}
          onHome={() => setScreen("home")}
        />
      )}

      <EditRoundModal
        visible={editingRound !== null}
        roundNumber={editingRound}
        gameState={gameState}
        onSave={handleEditSave}
        onClose={() => setEditingRound(null)}
      />
    </div>
  );
}
