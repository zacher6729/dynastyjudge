import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import Nav from '../../components/Nav';
import { usePlayerSearch } from '../../hooks/useSleeper';
import { supabase } from '../../lib/supabase';

// ── Pick values by year and round ─────────────────────────────────────────────
const PICK_VALUES = {
  '2025': { 1: { early: 3200, mid: 2400, late: 1800 }, 2: { early: 900, mid: 650, late: 450 } },
  '2026': { 1: { early: 4800, mid: 3600, late: 2600 }, 2: { early: 1400, mid: 1000, late: 700 } },
  '2027': { 1: { early: 5800, mid: 4400, late: 3200 }, 2: { early: 1800, mid: 1300, late: 900 } },
  '2028': { 1: { early: 5200, mid: 4000, late: 2800 }, 2: { early: 1600, mid: 1200, late: 800 } },
};

const FORMATS = [
  { id: '1qb',    label: '1QB'        },
  { id: 'sf',     label: 'SuperFlex'  },
  { id: 'teprem', label: 'TE Premium' },
];

// SF multiplier for QB value
const SF_QB_MULT = 1.6;
// TE Premium multiplier for TE value
const TEP_TE_MULT = 1.4;

const POS_COLORS = {
  QB: { bg: 'rgba(239,68,68,0.15)',  text: '#FCA5A5' },
  RB: { bg: 'rgba(34,197,94,0.15)', text: '#86EFAC' },
  WR: { bg: 'rgba(59,130,246,0.15)',text: '#93C5FD' },
  TE: { bg: 'rgba(251,191,36,0.15)',text: '#FDE68A' },
};

function formatValue(v) {
  if (!v) return '—';
  return v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toString();
}

function getAdjustedValue(player, format) {
  let v = player.trade_value || player.consensus_value || 0;
  if (format === 'sf' && player.position === 'QB') v = Math.round(v * SF_QB_MULT);
  if (format === 'teprem' && player.position === 'TE') v = Math.round(v * TEP_TE_MULT);
  return v;
}

// ── Player search dropdown ─────────────────────────────────────────────────────
function PlayerSearch({ onSelect, placeholder = 'Search player...', excludeIds = [] }) {
  const { results, loading, search, query } = usePlayerSearch({ limit: 10 });
  const [show, setShow] = useState(false);

  const filtered = results.filter(p => !excludeIds.includes(p.id));

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={e => { search(e.target.value); setShow(true); }}
        onFocus={() => query.length >= 2 && setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'var(--font-body)', outline: 'none' }}
      />
      {show && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-md)', zIndex: 100, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
          {filtered.map(p => {
            const pos = POS_COLORS[p.position] || { bg: 'rgba(156,163,175,0.15)', text: '#D1D5DB' };
            return (
              <button
                key={p.id}
                onMouseDown={() => { onSelect(p); search(''); setShow(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '0.5rem 0.875rem', background: 'none', border: 'none', borderBottom: '0.5px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ display: 'inline-block', padding: '1px 5px', borderRadius: 3, fontSize: '0.65rem', fontWeight: 700, background: pos.bg, color: pos.text, flexShrink: 0 }}>{p.position}</span>
                <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.nfl_team}</span>
              </button>
            );
          })}
        </div>
      )}
      {show && loading && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)', zIndex: 100 }}>
          Searching...
        </div>
      )}
    </div>
  );
}

// ── Trade side ────────────────────────────────────────────────────────────────
function TradeSide({ label, color, items, onAddPlayer, onAddPick, onRemove, format, opponentBoard, allIds }) {
  const [showPickForm, setPickForm] = useState(false);
  const [pickYear, setPickYear]     = useState('2026');
  const [pickRound, setPickRound]   = useState('1');
  const [pickSlot, setPickSlot]     = useState('mid');

  function addPick() {
    const val = PICK_VALUES[pickYear]?.[parseInt(pickRound)]?.[pickSlot] || 1000;
    onAddPick({ type: 'pick', label: `${pickYear} Round ${pickRound} (${pickSlot})`, value: val, id: `pick-${Date.now()}` });
    setPickForm(false);
  }

  const total = items.reduce((sum, item) => {
    if (item.type === 'pick') return sum + item.value;
    const v = opponentBoard?.[item.id] || getAdjustedValue(item, format);
    return sum + v;
  }, 0);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color, borderBottom: `2px solid ${color}`, paddingBottom: 4, display: 'inline-block' }}>{label}</h2>
        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {formatValue(total)}
        </div>
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '0.75rem', minHeight: 60 }}>
        {items.length === 0 && (
          <div style={{ padding: '1.5rem', textAlign: 'center', border: '0.5px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Add players or picks
          </div>
        )}
        {items.map(item => {
          const isPlayer = item.type !== 'pick';
          const djVal    = isPlayer ? getAdjustedValue(item, format) : item.value;
          const oppVal   = isPlayer && opponentBoard ? opponentBoard[item.id] : null;
          const pos      = isPlayer ? (POS_COLORS[item.position] || { bg: 'rgba(156,163,175,0.15)', text: '#D1D5DB' }) : null;

          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.625rem 0.75rem', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              {pos && (
                <span style={{ display: 'inline-block', padding: '1px 5px', borderRadius: 3, fontSize: '0.65rem', fontWeight: 700, background: pos.bg, color: pos.text, flexShrink: 0 }}>{item.position}</span>
              )}
              {!pos && <span style={{ fontSize: '0.75rem' }}>🎟</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name || item.label}
                </div>
                {isPlayer && item.nfl_team && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.nfl_team}{item.age ? ` · Age ${item.age}` : ''}</div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatValue(djVal)}</div>
                {oppVal && oppVal !== djVal && (
                  <div style={{ fontSize: '0.7rem', color: '#FBBF24' }}>Opp: {formatValue(oppVal)}</div>
                )}
              </div>
              <button onClick={() => onRemove(item.id)} style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', color: '#F87171', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}>✕</button>
            </div>
          );
        })}
      </div>

      {/* Add player */}
      <PlayerSearch
        placeholder="Add player..."
        onSelect={onAddPlayer}
        excludeIds={allIds}
      />

      {/* Add pick */}
      <div style={{ marginTop: 8 }}>
        {!showPickForm ? (
          <button onClick={() => setPickForm(true)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '0.5px dashed var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            + Add draft pick
          </button>
        ) : (
          <div style={{ padding: '0.875rem', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 3 }}>Year</div>
              <select value={pickYear} onChange={e => setPickYear(e.target.value)} style={{ padding: '0.375rem 0.5rem', borderRadius: 4, border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'var(--font-body)' }}>
                {Object.keys(PICK_VALUES).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 3 }}>Round</div>
              <select value={pickRound} onChange={e => setPickRound(e.target.value)} style={{ padding: '0.375rem 0.5rem', borderRadius: 4, border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'var(--font-body)' }}>
                <option value="1">1st</option>
                <option value="2">2nd</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 3 }}>Position</div>
              <select value={pickSlot} onChange={e => setPickSlot(e.target.value)} style={{ padding: '0.375rem 0.5rem', borderRadius: 4, border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'var(--font-body)' }}>
                <option value="early">Early (1–4)</option>
                <option value="mid">Mid (5–8)</option>
                <option value="late">Late (9–12)</option>
              </select>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--gold-400)', fontWeight: 600, alignSelf: 'center', paddingBottom: 2 }}>
              = {formatValue(PICK_VALUES[pickYear]?.[parseInt(pickRound)]?.[pickSlot])}
            </div>
            <button onClick={addPick} style={{ padding: '0.375rem 0.875rem', borderRadius: 4, background: 'var(--gold-500)', color: 'var(--charcoal-900)', border: 'none', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Add</button>
            <button onClick={() => setPickForm(false)} style={{ padding: '0.375rem 0.875rem', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', border: '0.5px solid var(--border-subtle)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TradeCalculator() {
  const [format, setFormat]         = useState('1qb');
  const [sideA, setSideA]           = useState([]); // you give
  const [sideB, setSideB]           = useState([]); // you receive
  const [playerValues, setValues]   = useState({}); // id -> value from DB
  const [opponentUsername, setOppU] = useState('');
  const [opponentBoard, setOppBoard] = useState(null); // id -> value from their rankings
  const [loadingOpp, setLoadingOpp] = useState(false);
  const [oppError, setOppError]     = useState('');
  const [loadingValues, setLoadingValues] = useState(false);

  // Load values from Supabase consensus rankings
  const loadValues = useCallback(async () => {
    setLoadingValues(true);
    try {
      const { data } = await supabase
        .from('v_consensus_rankings')
        .select('player_id, consensus_rank, editorial_rank')
        .eq('format', format)
        .limit(300);

      if (data?.length) {
        const map = {};
        data.forEach(r => {
          // Convert rank to value: rank 1 = 9999, rank 300 = 100
          const rank = r.consensus_rank || r.editorial_rank || 300;
          const val  = Math.max(100, Math.round(10000 - (rank - 1) * 33));
          map[r.player_id] = val;
        });
        setValues(map);
      }
    } catch (e) {
      console.error('Failed to load values:', e);
    }
    setLoadingValues(false);
  }, [format]);

  useEffect(() => { loadValues(); }, [loadValues]);

  // Enrich player with value from DB
  function enrichPlayer(player) {
    const dbVal = playerValues[player.id];
    return { ...player, trade_value: dbVal || estimateValue(player) };
  }

  // Fallback value estimate if not in rankings
  function estimateValue(player) {
    const base = { QB: 4000, WR: 3500, RB: 3000, TE: 2500 }[player.position] || 2000;
    const agePenalty = player.age ? Math.max(0, (player.age - 25) * 200) : 0;
    return Math.max(200, base - agePenalty);
  }

  // Load opponent's rankings by username
  async function loadOpponentRankings() {
    if (!opponentUsername.trim()) return;
    setLoadingOpp(true);
    setOppError('');
    setOppBoard(null);

    try {
      // Find user profile by username
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', opponentUsername.trim())
        .single();

      if (!profile) throw new Error(`No DynastyJudge user found with username "${opponentUsername}". They need to have a public rankings board.`);

      // Find their public board for this format
      const { data: boards } = await supabase
        .from('ranking_boards')
        .select('id')
        .eq('owner_id', profile.id)
        .eq('format', format)
        .eq('is_public', true)
        .in('type', ['community', 'personal', 'creator'])
        .limit(1);

      if (!boards?.length) throw new Error(`${opponentUsername} hasn't shared their ${format.toUpperCase()} rankings publicly.`);

      // Load their rankings
      const { data: entries } = await supabase
        .from('ranking_entries')
        .select('player_id, rank')
        .eq('board_id', boards[0].id)
        .order('rank', { ascending: true });

      if (!entries?.length) throw new Error('Their rankings board is empty.');

      // Convert ranks to values
      const oppMap = {};
      entries.forEach(e => {
        const val = Math.max(100, Math.round(10000 - (e.rank - 1) * 33));
        oppMap[e.player_id] = val;
      });
      setOppBoard(oppMap);
    } catch (err) {
      setOppError(err.message);
    }
    setLoadingOpp(false);
  }

  // Side management
  function addToSide(side, player) {
    const enriched = enrichPlayer(player);
    if (side === 'A') setSideA(prev => [...prev, enriched]);
    else setSideB(prev => [...prev, enriched]);
  }

  function addPickToSide(side, pick) {
    if (side === 'A') setSideA(prev => [...prev, pick]);
    else setSideB(prev => [...prev, pick]);
  }

  function removeFromSide(side, id) {
    if (side === 'A') setSideA(prev => prev.filter(p => p.id !== id));
    else setSideB(prev => prev.filter(p => p.id !== id));
  }

  const allIds = [...sideA, ...sideB].map(p => p.id).filter(Boolean);

  // Calculate totals
  function sideTotal(items, useOpp = false) {
    return items.reduce((sum, item) => {
      if (item.type === 'pick') return sum + item.value;
      const v = (useOpp && opponentBoard?.[item.id]) || getAdjustedValue({ ...item, trade_value: playerValues[item.id] || item.trade_value }, format);
      return sum + v;
    }, 0);
  }

  const totalA    = sideTotal(sideA);
  const totalB    = sideTotal(sideB);
  const diff      = totalB - totalA; // positive = you win
  const pctDiff   = totalA > 0 ? Math.round((diff / Math.max(totalA, totalB)) * 100) : 0;

  const oppTotalA = opponentBoard ? sideTotal(sideA, true) : null;
  const oppTotalB = opponentBoard ? sideTotal(sideB, true) : null;
  const oppDiff   = opponentBoard ? (oppTotalA - oppTotalB) : null; // positive = they think they win

  function getVerdict() {
    if (!sideA.length && !sideB.length) return null;
    if (Math.abs(pctDiff) <= 5) return { label: '◆ FAIR', cls: 'verdict-hold', msg: 'This trade is roughly even. Accept or decline based on roster fit.' };
    if (diff > 0) {
      if (pctDiff >= 20) return { label: '▲ STRONG BUY', cls: 'verdict-buy', msg: `You're winning this trade by ${pctDiff}%. Pull the trigger.` };
      return { label: '▲ BUY', cls: 'verdict-buy', msg: `You're getting slightly the better end. Reasonable trade to accept.` };
    }
    if (pctDiff <= -20) return { label: '▼ STRONG SELL', cls: 'verdict-sell', msg: `You're losing this trade by ${Math.abs(pctDiff)}%. Counter or walk away.` };
    return { label: '▼ SELL', cls: 'verdict-sell', msg: `You're giving up slightly more than you're getting. Counter if possible.` };
  }

  const verdict = getVerdict();

  return (
    <>
      <Head>
        <title>Trade Calculator — DynastyJudge</title>
        <meta name="description" content="Dynasty trade calculator with DynastyJudge consensus values. Import opponent rankings to see the trade from their perspective." />
      </Head>
      <Nav />

      <main style={{ minHeight: '100vh', paddingBottom: '4rem' }}>

        {/* Header */}
        <div style={{ borderBottom: '0.5px solid var(--border-subtle)', padding: '2.5rem 0 2rem' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div className="gold-bar" />
              <span className="label text-gold">Judge tools</span>
            </div>
            <h1 className="display-md" style={{ marginBottom: 8 }}>Trade calculator</h1>
            <p className="body-md" style={{ color: 'var(--text-secondary)', maxWidth: 520 }}>
              Dynasty values from the DynastyJudge consensus. Import your opponent's public rankings to see the trade from their perspective.
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: '1.5rem' }}>

          {/* Format tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem' }}>
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => setFormat(f.id)} style={{ padding: '0.375rem 1rem', borderRadius: 'var(--radius-md)', border: format === f.id ? '0.5px solid var(--gold-500)' : '0.5px solid var(--border-default)', background: format === f.id ? 'rgba(200,151,58,0.12)' : 'transparent', color: format === f.id ? 'var(--gold-400)' : 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: format === f.id ? 600 : 400, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                {f.label}
              </button>
            ))}
            {loadingValues && <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 8 }}>Loading values...</span>}
          </div>

          {/* Trade sides */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <TradeSide
              label="You give"
              color="#F87171"
              items={sideA}
              onAddPlayer={p => addToSide('A', p)}
              onAddPick={p => addPickToSide('A', p)}
              onRemove={id => removeFromSide('A', id)}
              format={format}
              opponentBoard={opponentBoard}
              allIds={allIds}
            />

            {/* Center divider */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2.5rem', gap: 8 }}>
              <div style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>⇄</div>
              {sideA.length > 0 || sideB.length > 0 ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>difference</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: diff > 0 ? '#4ADE80' : diff < 0 ? '#F87171' : 'var(--text-muted)' }}>
                    {diff > 0 ? '+' : ''}{formatValue(Math.abs(diff))}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {diff > 0 ? 'in your favor' : diff < 0 ? 'against you' : 'even'}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 60 }}>Add players to both sides</div>
              )}
            </div>

            <TradeSide
              label="You receive"
              color="#4ADE80"
              items={sideB}
              onAddPlayer={p => addToSide('B', p)}
              onAddPick={p => addPickToSide('B', p)}
              onRemove={id => removeFromSide('B', id)}
              format={format}
              opponentBoard={opponentBoard}
              allIds={allIds}
            />
          </div>

          {/* Verdict */}
          {verdict && (
            <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`verdict ${verdict.cls}`} style={{ flexShrink: 0, fontSize: '0.9rem', padding: '6px 14px' }}>{verdict.label}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{verdict.msg}</p>
                {opponentBoard && oppDiff !== null && (
                  <p style={{ fontSize: '0.8125rem', color: '#FBBF24', marginTop: 4 }}>
                    From @{opponentUsername}'s perspective: they think they're {oppDiff > 0 ? `winning by ${formatValue(Math.abs(oppDiff))}` : oppDiff < 0 ? `losing by ${formatValue(Math.abs(oppDiff))}` : 'getting a fair deal'}.
                    {oppDiff > 0 && diff > 0 && ' Both sides see value — this trade should get done.'}
                    {oppDiff < 0 && diff < 0 && ' Both sides think they\'re losing — unusual. Check your values.'}
                  </p>
                )}
              </div>
              <button onClick={() => { setSideA([]); setSideB([]); }} style={{ padding: '0.375rem 0.875rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0 }}>
                Reset
              </button>
            </div>
          )}

          {/* Opponent rankings import */}
          <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' }}>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Import opponent's rankings
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.875rem', lineHeight: 1.6 }}>
              If your trade partner has shared their DynastyJudge rankings publicly, enter their username to see how they value the players in this trade. Helps you understand what they think they're getting.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Their DynastyJudge username"
                value={opponentUsername}
                onChange={e => setOppU(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadOpponentRankings()}
                style={{ flex: 1, minWidth: 200, padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'var(--font-body)', outline: 'none' }}
              />
              <button onClick={loadOpponentRankings} disabled={loadingOpp || !opponentUsername.trim()} style={{ padding: '0.5rem 1.125rem', borderRadius: 'var(--radius-md)', background: 'var(--gold-500)', color: 'var(--charcoal-900)', border: 'none', fontSize: '0.875rem', fontWeight: 700, cursor: loadingOpp ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: loadingOpp ? 0.7 : 1 }}>
                {loadingOpp ? 'Loading...' : 'Load their rankings'}
              </button>
              {opponentBoard && (
                <button onClick={() => { setOppBoard(null); setOppU(''); }} style={{ padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-subtle)', background: 'transparent', color: '#F87171', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  Clear
                </button>
              )}
            </div>

            {oppError && (
              <div style={{ marginTop: 8, fontSize: '0.8125rem', color: '#F87171' }}>{oppError}</div>
            )}
            {opponentBoard && (
              <div style={{ marginTop: 8, fontSize: '0.8125rem', color: '#4ADE80' }}>
                ✓ Loaded @{opponentUsername}'s rankings — their values now shown in yellow on each player.
              </div>
            )}
          </div>

          {/* Value legend */}
          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <span>Values from DynastyJudge consensus rankings</span>
            <span>· SF QBs multiplied ×1.6</span>
            <span>· TE Premium TEs multiplied ×1.4</span>
            <span>· Pick values adjust by year and slot</span>
          </div>

        </div>
      </main>
    </>
  );
}
