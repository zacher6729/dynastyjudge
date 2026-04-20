import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import Nav from '../../components/Nav';
import Link from 'next/link';
import { useSleeper } from '../../hooks/useSleeper';
import { supabase } from '../../lib/supabase';

// ── Pick values ───────────────────────────────────────────────────────────────
const PICK_BASE = {
  '2026': { 1: { early:4800, mid:3600, late:2600 }, 2: { early:1400, mid:1000, late:700  } },
  '2027': { 1: { early:5800, mid:4400, late:3200 }, 2: { early:1800, mid:1300, late:900  } },
  '2028': { 1: { early:5200, mid:4000, late:2800 }, 2: { early:1600, mid:1200, late:800  } },
  '2029': { 1: { early:4800, mid:3600, late:2600 }, 2: { early:1400, mid:1000, late:700  } },
};

const SKILL_POS = ['QB','RB','WR','TE','K'];

const POS_COLORS = {
  QB:{ bg:'rgba(239,68,68,0.15)',  text:'#FCA5A5' },
  RB:{ bg:'rgba(34,197,94,0.15)', text:'#86EFAC' },
  WR:{ bg:'rgba(59,130,246,0.15)',text:'#93C5FD' },
  TE:{ bg:'rgba(251,191,36,0.15)',text:'#FDE68A' },
  K: { bg:'rgba(156,163,175,0.15)',text:'#D1D5DB' },
};

function fv(v) {
  if (!v || v === 0) return '—';
  return v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v);
}

function adjVal(item, format, valMap) {
  if (item.type === 'pick') return item.value || 0;
  const base = valMap?.[item.player_id] || item.value || 500;
  if (format === 'sf'     && item.position === 'QB') return Math.round(base * 1.6);
  if (format === 'teprem' && item.position === 'TE') return Math.round(base * 1.4);
  return base;
}

// Enrich sleeper player IDs → full objects using a player map
function enrichPlayers(ids, pmap, valMap) {
  if (!ids?.length || !pmap || !Object.keys(pmap).length) return [];
  return ids
    .map(id => {
      const p = pmap[id];
      if (!p || !SKILL_POS.includes(p.position)) return null;
      return {
        type:      'player',
        player_id: id,
        full_name: p.full_name || p.first_name + ' ' + p.last_name,
        position:  p.position,
        team:      p.team || p.nfl_team,
        age:       p.age,
        value:     valMap?.[id] || 500,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const order = { QB:0, WR:1, RB:2, TE:3, K:4 };
      return (order[a.position]||9) - (order[b.position]||9)
          || (b.value || 0) - (a.value || 0);
    });
}

// Build picks for a specific roster using traded_picks data
function buildPicksForRoster(rosterId, tradedPicks, allRosters, userMap) {
  const picks = [];
  const currentYear = 2026;
  const years = [currentYear, currentYear + 1, currentYear + 2];

  years.forEach(yr => {
    const yrStr = String(yr);

    // Which original picks does this roster own?
    // Start with all teams' original picks
    allRosters.forEach(r => {
      [1, 2].forEach(round => {
        // Who originally owned this pick
        const originalOwner = r.roster_id;

        // Has this pick been traded?
        // Find the final destination of this pick in the traded_picks chain
        const tradedEntry = tradedPicks.find(tp =>
          tp.roster_id === originalOwner &&   // original team
          tp.round === round &&
          tp.season === yrStr
        );

        const currentHolder = tradedEntry ? tradedEntry.owner_id : originalOwner;

        if (currentHolder === rosterId) {
          const isOwn = originalOwner === rosterId;
          const origOwnerUser = userMap[allRosters.find(r2 => r2.roster_id === originalOwner)?.owner_id];

          picks.push({
            type:           'pick',
            id:             `pick-${yrStr}-${round}-from-${originalOwner}`,
            label:          `${yrStr} Round ${round}`,
            year:           yr,
            round,
            slot:           'mid',
            value:          PICK_BASE[yrStr]?.[round]?.mid || 1000,
            original_owner: isOwn ? null : (origOwnerUser?.display_name || `Team ${originalOwner}`),
            roster_id:      rosterId,
          });
        }
      });
    });
  });

  // Remove duplicates
  const seen = new Set();
  return picks.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

// ── Small UI components ───────────────────────────────────────────────────────
function PosTag({ pos }) {
  const c = POS_COLORS[pos] || { bg:'rgba(156,163,175,0.15)', text:'#D1D5DB' };
  return (
    <span style={{ display:'inline-block', padding:'1px 5px', borderRadius:3, fontSize:'0.65rem', fontWeight:700, background:c.bg, color:c.text, flexShrink:0 }}>
      {pos}
    </span>
  );
}

function ItemCard({ item, format, valMap, onAction, actionLabel, actionColor, dimmed }) {
  const val = adjVal(item, format, valMap);
  const isPlayer = item.type !== 'pick';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, padding:'0.5rem 0.75rem', background: dimmed ? 'rgba(0,0,0,0.2)' : 'var(--bg-secondary)', border:`0.5px solid ${dimmed ? 'var(--border-subtle)' : 'var(--border-default)'}`, borderRadius:'var(--radius-md)', opacity: dimmed ? 0.45 : 1, transition:'opacity .1s' }}>
      {isPlayer ? <PosTag pos={item.position} /> : <span style={{ fontSize:'0.85rem' }}>🎟</span>}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'0.875rem', fontWeight:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {item.full_name || item.label || item.name}
        </div>
        {isPlayer && (
          <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>
            {item.team}{item.age ? ` · ${item.age}` : ''}
          </div>
        )}
        {!isPlayer && item.original_owner && (
          <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>via {item.original_owner}</div>
        )}
      </div>
      <span style={{ fontSize:'0.8125rem', fontWeight:600, color: val > 2000 ? 'var(--gold-400)' : 'var(--text-secondary)', flexShrink:0 }}>{fv(val)}</span>
      {onAction && (
        <button
          onMouseDown={e => { e.preventDefault(); onAction(); }}
          style={{ padding:'2px 7px', borderRadius:4, border:`0.5px solid ${actionColor || 'var(--border-default)'}`, background:'transparent', color: actionColor || 'var(--text-muted)', fontSize:'0.75rem', cursor:'pointer', fontFamily:'var(--font-body)', flexShrink:0 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TradeCalculator() {
  const { sleeperId, isConnected, loading: sleeperLoading } = useSleeper();

  const [step, setStep]       = useState(1);
  const [leagues, setLeagues] = useState([]);
  const [league, setLeague]   = useState(null);
  const [format, setFormat]   = useState('1qb');

  // Raw Sleeper data
  const [rosters, setRosters]         = useState([]);
  const [userMap, setUserMap]         = useState({});
  const [tradedPicks, setTradedPicks] = useState([]);
  const slPlayerMap                   = useRef({}); // use ref so not stale in callbacks

  // Dynasty values from Supabase
  const [valMap, setValMap] = useState({});

  // My team
  const [myRoster, setMyRoster]   = useState(null);
  const [myPlayers, setMyPlayers] = useState([]);
  const [myPicks, setMyPicks]     = useState([]);

  // Opponent
  const [oppRoster, setOppRoster]   = useState(null);
  const [oppPlayers, setOppPlayers] = useState([]);
  const [oppPicks, setOppPicks]     = useState([]);

  // Trade build
  const [wantFromOpp, setWant]      = useState([]);
  const [givingMine, setGiving]     = useState([]);
  const [untouchable, setUntouch]   = useState(new Set());
  const [suggestion, setSuggestion] = useState(null);

  // Loading states
  const [loadingLeague, setLoadingLeague]   = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // Search
  const [mySearch, setMySearch]   = useState('');
  const [oppSearch, setOppSearch] = useState('');

  // ── Load Sleeper player map ──────────────────────────────────────────────────
  useEffect(() => {
    setLoadingPlayers(true);
    const cached = sessionStorage.getItem('sleeper_players');
    if (cached) {
      slPlayerMap.current = JSON.parse(cached);
      setLoadingPlayers(false);
      return;
    }
    fetch('https://api.sleeper.app/v1/players/nfl')
      .then(r => r.json())
      .then(d => {
        sessionStorage.setItem('sleeper_players', JSON.stringify(d));
        slPlayerMap.current = d;
        setLoadingPlayers(false);
      });
  }, []);

  // ── Load leagues ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sleeperId) return;
    fetch(`https://api.sleeper.app/v1/user/${sleeperId}/leagues/nfl/2026`)
      .then(r => r.json()).then(d => setLeagues(d || []));
  }, [sleeperId]);

  // ── Load dynasty values ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('v_consensus_rankings')
      .select('player_id, consensus_rank, editorial_rank')
      .eq('format', format).limit(500)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(r => {
          const rank = r.consensus_rank || r.editorial_rank || 300;
          map[r.player_id] = Math.max(100, Math.round(10000 - (rank - 1) * 33));
        });
        setValMap(map);
      });
  }, [format]);

  // ── Select league ─────────────────────────────────────────────────────────────
  async function selectLeague(l) {
    setLeague(l);
    setLoadingLeague(true);
    setStep(2);
    setOppRoster(null);
    setWant([]); setGiving([]); setUntouch(new Set()); setSuggestion(null);

    // Detect format
    const hasSF  = l.roster_positions?.includes('SUPER_FLEX');
    const hasTEP = (l.scoring_settings?.bonus_rec_te || 0) >= 0.5;
    const fmt = hasSF ? 'sf' : hasTEP ? 'teprem' : '1qb';
    setFormat(fmt);

    const [rostersRes, usersRes, picksRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${l.league_id}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${l.league_id}/users`),
      fetch(`https://api.sleeper.app/v1/league/${l.league_id}/traded_picks`),
    ]);

    const rList  = await rostersRes.json();
    const uList  = await usersRes.json();
    const pList  = await picksRes.json() || [];
    const umap   = Object.fromEntries(uList.map(u => [u.user_id, u]));

    setRosters(rList);
    setUserMap(umap);
    setTradedPicks(pList);

    // Make sure player map is loaded before enriching
    const pmap = slPlayerMap.current;
    const mine = rList.find(r => r.owner_id === sleeperId);
    setMyRoster(mine);

    if (mine) {
      // Load fresh valMap for this format
      const { data: vals } = await supabase
        .from('v_consensus_rankings')
        .select('player_id, consensus_rank, editorial_rank')
        .eq('format', fmt).limit(500);

      const vm = {};
      (vals || []).forEach(r => {
        const rank = r.consensus_rank || r.editorial_rank || 300;
        vm[r.player_id] = Math.max(100, Math.round(10000 - (rank - 1) * 33));
      });
      setValMap(vm);

      setMyPlayers(enrichPlayers(mine.players || [], pmap, vm));
      setMyPicks(buildPicksForRoster(mine.roster_id, pList, rList, umap));
    }

    setLoadingLeague(false);
  }

  // ── Select opponent ───────────────────────────────────────────────────────────
  function selectOpponent(roster) {
    setOppRoster(roster);
    const pmap = slPlayerMap.current;
    setOppPlayers(enrichPlayers(roster.players || [], pmap, valMap));
    setOppPicks(buildPicksForRoster(roster.roster_id, tradedPicks, rosters, userMap));
    setWant([]); setGiving([]); setSuggestion(null);
    setStep(3);
  }

  // ── Trade helpers ─────────────────────────────────────────────────────────────
  const wantIds   = new Set(wantFromOpp.map(p => p.player_id || p.id));
  const givingIds = new Set(givingMine.map(p => p.player_id || p.id));

  function toggleWant(item) {
    const id = item.player_id || item.id;
    setWant(prev => prev.find(p => (p.player_id||p.id) === id)
      ? prev.filter(p => (p.player_id||p.id) !== id)
      : [...prev, item]);
  }

  function toggleGive(item) {
    const id = item.player_id || item.id;
    if (untouchable.has(id)) return;
    setGiving(prev => prev.find(p => (p.player_id||p.id) === id)
      ? prev.filter(p => (p.player_id||p.id) !== id)
      : [...prev, item]);
  }

  function toggleUntouchable(id) {
    setUntouch(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setGiving(prev => prev.filter(p => (p.player_id||p.id) !== id));
  }

  // Totals
  function total(items) {
    return items.reduce((s, item) => s + adjVal(item, format, valMap), 0);
  }

  const wantTotal  = total(wantFromOpp);
  const giveTotal  = total(givingMine);
  const diff       = wantTotal - giveTotal;
  const maxTotal   = Math.max(wantTotal, giveTotal);
  const pct        = maxTotal > 0 ? Math.round((Math.abs(diff) / maxTotal) * 100) : 0;

  function getVerdict() {
    if (!wantFromOpp.length && !givingMine.length) return null;
    if (pct <= 5)  return { label:'◆ FAIR',        cls:'verdict-hold', msg:'Roughly even. Accept or decline based on roster fit.'        };
    if (diff > 0)  return pct >= 20
      ? { label:'▲ STRONG BUY', cls:'verdict-buy',  msg:`You're winning this trade by ${pct}%. Pull the trigger.`          }
      : { label:'▲ BUY',        cls:'verdict-buy',  msg:'Slight advantage to you. Reasonable to accept.'                   };
    return pct >= 20
      ? { label:'▼ STRONG SELL',cls:'verdict-sell', msg:`You're losing by ${pct}%. Counter or walk away.`                  }
      : { label:'▼ SELL',       cls:'verdict-sell', msg:"You're giving up slightly more. Try countering."                   };
  }

  // ── Trade suggester ───────────────────────────────────────────────────────────
  function suggestTrade() {
    if (!wantFromOpp.length) {
      alert('Select at least one player or pick you want from your opponent.');
      return;
    }

    const target  = wantTotal;
    const ceiling = target * 1.08;
    const floor   = target * 0.82;

    // Available assets (not untouchable, not already selected to give)
    const pool = [
      ...myPlayers.filter(p => !untouchable.has(p.player_id) && !givingIds.has(p.player_id)),
      ...myPicks.filter(p  => !untouchable.has(p.id)         && !givingIds.has(p.id)),
    ].sort((a, b) => adjVal(b, format, valMap) - adjVal(a, format, valMap));

    let best = null;
    let bestDiff = Infinity;

    // 1-asset
    for (const a of pool) {
      const v = adjVal(a, format, valMap);
      if (v >= floor && v <= ceiling) {
        const d = Math.abs(v - target);
        if (d < bestDiff) { bestDiff = d; best = [a]; }
      }
    }

    // 2-asset
    if (!best || bestDiff > target * 0.1) {
      for (let i = 0; i < Math.min(pool.length, 20); i++) {
        for (let j = i + 1; j < Math.min(pool.length, 20); j++) {
          const v = adjVal(pool[i], format, valMap) + adjVal(pool[j], format, valMap);
          if (v >= floor && v <= ceiling) {
            const d = Math.abs(v - target);
            if (d < bestDiff) { bestDiff = d; best = [pool[i], pool[j]]; }
          }
        }
      }
    }

    // 3-asset
    if (!best || bestDiff > target * 0.15) {
      for (let i = 0; i < Math.min(pool.length, 15); i++) {
        for (let j = i + 1; j < Math.min(pool.length, 15); j++) {
          for (let k = j + 1; k < Math.min(pool.length, 15); k++) {
            const v = adjVal(pool[i], format, valMap) + adjVal(pool[j], format, valMap) + adjVal(pool[k], format, valMap);
            if (v >= floor && v <= ceiling) {
              const d = Math.abs(v - target);
              if (d < bestDiff) { bestDiff = d; best = [pool[i], pool[j], pool[k]]; }
            }
          }
        }
      }
    }

    if (best) {
      setSuggestion(best);
      setGiving(best);
      setStep(4);
    } else {
      alert(`No combination of your available assets closely matches the value (${fv(target)}) of what you want. You may need to add more to the offer or reconsider what you're targeting.`);
    }
  }

  // Filtered lists
  const myFiltered  = mySearch  ? myPlayers.filter(p  => (p.full_name||'').toLowerCase().includes(mySearch.toLowerCase()))  : myPlayers;
  const oppFiltered = oppSearch ? oppPlayers.filter(p => (p.full_name||'').toLowerCase().includes(oppSearch.toLowerCase())) : oppPlayers;

  const myTeamName  = userMap[myRoster?.owner_id]?.display_name  || 'My team';
  const oppTeamName = userMap[oppRoster?.owner_id]?.display_name || 'Opponent';
  const verdict     = getVerdict();

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Head><title>Trade Calculator — DynastyJudge</title></Head>
      <Nav />

      <main style={{ minHeight:'100vh', paddingBottom:'4rem' }}>

        {/* Header */}
        <div style={{ borderBottom:'0.5px solid var(--border-subtle)', padding:'2.5rem 0 2rem' }}>
          <div className="container">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div className="gold-bar" />
              <span className="label text-gold">Judge tools</span>
            </div>
            <h1 className="display-md" style={{ marginBottom:8 }}>Trade calculator</h1>
            <p className="body-md" style={{ color:'var(--text-secondary)', maxWidth:520 }}>
              Select a league, pick your trade partner, choose what you want — and the Judge suggests a fair offer from your roster.
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop:'1.5rem' }}>

          {/* Not connected */}
          {!sleeperLoading && !isConnected && (
            <div style={{ padding:'1rem 1.25rem', background:'rgba(200,151,58,0.08)', border:'0.5px solid var(--border-gold)', borderRadius:'var(--radius-md)', marginBottom:'1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.875rem', color:'var(--text-secondary)' }}>Connect Sleeper to build trades from your real rosters.</span>
              <Link href="/tools/connect-sleeper" className="btn btn-primary btn-sm">Connect Sleeper</Link>
            </div>
          )}

          {/* Player map loading notice */}
          {isConnected && loadingPlayers && (
            <div style={{ padding:'0.75rem 1rem', background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-md)', marginBottom:'1rem', fontSize:'0.8125rem', color:'var(--text-muted)' }}>
              Loading player database... (first load only, then cached)
            </div>
          )}

          {/* Step progress */}
          {isConnected && (
            <div style={{ display:'flex', gap:0, marginBottom:'1.5rem', borderBottom:'0.5px solid var(--border-subtle)', paddingBottom:'1rem', overflowX:'auto' }}>
              {[[1,'Select league'],[2,'Select opponent'],[3,'Build trade'],[4,'Suggestion']].map(([n, label]) => (
                <div key={n} onClick={() => n < step && setStep(n)}
                  style={{ display:'flex', alignItems:'center', gap:6, marginRight:20, cursor: n < step ? 'pointer' : 'default', flexShrink:0 }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, background: step >= n ? 'var(--gold-500)' : 'var(--bg-secondary)', color: step >= n ? 'var(--charcoal-900)' : 'var(--text-muted)', border:`0.5px solid ${step >= n ? 'var(--gold-500)' : 'var(--border-default)'}` }}>
                    {step > n ? '✓' : n}
                  </div>
                  <span style={{ fontSize:'0.875rem', color: step >= n ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: step === n ? 600 : 400 }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 1: Select league ── */}
          {isConnected && step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {leagues.length === 0 && !sleeperLoading && (
                <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>No active leagues found for 2026.</div>
              )}
              {leagues.map(l => (
                <button key={l.league_id} onClick={() => !loadingPlayers && selectLeague(l)}
                  disabled={loadingPlayers}
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.25rem', background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', cursor: loadingPlayers ? 'not-allowed' : 'pointer', fontFamily:'var(--font-body)', textAlign:'left', opacity: loadingPlayers ? 0.6 : 1, transition:'border-color .12s' }}
                  onMouseEnter={e => { if (!loadingPlayers) e.currentTarget.style.borderColor='var(--border-gold)'; }}
                  onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-subtle)'}
                >
                  <div>
                    <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)', marginBottom:3 }}>{l.name}</div>
                    <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>
                      {l.total_rosters} teams ·{' '}
                      {l.roster_positions?.includes('SUPER_FLEX') ? 'SuperFlex' : '1QB'} ·{' '}
                      {l.scoring_settings?.rec === 1 ? 'PPR' : l.scoring_settings?.rec === 0.5 ? 'Half PPR' : 'Standard'}
                    </div>
                  </div>
                  <span style={{ color:'var(--gold-400)', fontSize:'0.875rem' }}>
                    {loadingPlayers ? 'Loading players...' : 'Select →'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── STEP 2: Select opponent ── */}
          {isConnected && step === 2 && (
            <div>
              {loadingLeague && <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>Loading rosters...</div>}
              {!loadingLeague && (
                <>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
                    <h2 style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)' }}>Select your trade partner</h2>
                    <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                      <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{league?.name}</span>
                      <button onClick={() => setStep(1)} style={{ fontSize:'0.8125rem', color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-body)' }}>← Back</button>
                    </div>
                  </div>

                  {/* My team info */}
                  {myRoster && (
                    <div style={{ padding:'0.875rem 1rem', background:'rgba(200,151,58,0.06)', border:'0.5px solid var(--border-gold)', borderRadius:'var(--radius-md)', marginBottom:'1rem', fontSize:'0.8125rem', color:'var(--text-secondary)' }}>
                      <strong style={{ color:'var(--text-primary)' }}>Your roster:</strong> {myPlayers.length} players · {myPicks.length} picks loaded
                    </div>
                  )}

                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {rosters.filter(r => r.owner_id !== sleeperId).map(r => {
                      const user      = userMap[r.owner_id] || {};
                      const pmap      = slPlayerMap.current;
                      const topPlayers = (r.players || [])
                        .map(id => ({ id, p: pmap[id] }))
                        .filter(({ p }) => p && ['WR','RB','QB','TE'].includes(p.position))
                        .sort((a, b) => (valMap[b.id]||0) - (valMap[a.id]||0))
                        .slice(0, 4);

                      return (
                        <button key={r.roster_id} onClick={() => selectOpponent(r)}
                          style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'1rem 1.25rem', background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', cursor:'pointer', fontFamily:'var(--font-body)', textAlign:'left', transition:'border-color .12s' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-gold)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-subtle)'}
                        >
                          <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--bg-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', fontWeight:700, color:'var(--text-muted)', flexShrink:0 }}>
                            {(user.display_name || '?')[0].toUpperCase()}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>
                              {user.display_name || 'Unknown'}
                            </div>
                            <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', display:'flex', gap:8, flexWrap:'wrap' }}>
                              {topPlayers.map(({ id, p }) => (
                                <span key={id}>{p.full_name?.split(' ').pop()}</span>
                              ))}
                              {r.players?.length > 4 && <span>+{r.players.length - 4} more</span>}
                            </div>
                          </div>
                          <span style={{ color:'var(--gold-400)', fontSize:'0.875rem', flexShrink:0 }}>Trade →</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── STEP 3 & 4: Build trade ── */}
          {isConnected && (step === 3 || step === 4) && myRoster && oppRoster && (
            <div>

              {/* Header bar */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1rem', flexWrap:'wrap' }}>
                <span style={{ fontSize:'0.8125rem', padding:'3px 10px', borderRadius:99, background:'rgba(200,151,58,0.12)', color:'var(--gold-400)', border:'0.5px solid var(--border-gold)', fontWeight:600 }}>
                  {format === 'sf' ? 'SuperFlex' : format === 'teprem' ? 'TE Premium' : '1QB'}
                </span>
                <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{league?.name}</span>
                <button onClick={() => setStep(2)} style={{ fontSize:'0.8125rem', color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-body)', marginLeft:'auto' }}>
                  ← Change opponent
                </button>
              </div>

              {/* Trade summary */}
              {(wantFromOpp.length > 0 || givingMine.length > 0) && (
                <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-default)', borderRadius:'var(--radius-lg)', padding:'1rem 1.25rem', marginBottom:'1rem', display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'0.75rem', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>You give</div>
                    <div style={{ fontSize:'1.25rem', fontWeight:700, color:'#F87171' }}>{fv(giveTotal)}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{givingMine.length} asset{givingMine.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    {verdict
                      ? <>
                          <span className={`verdict ${verdict.cls}`} style={{ fontSize:'0.75rem', padding:'4px 10px' }}>{verdict.label}</span>
                          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>
                            {diff > 0 ? '+' : ''}{fv(Math.abs(diff))} {diff >= 0 ? 'your way' : 'against you'}
                          </div>
                        </>
                      : <span style={{ fontSize:'1.5rem', color:'var(--text-muted)' }}>⇄</span>
                    }
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>You receive</div>
                    <div style={{ fontSize:'1.25rem', fontWeight:700, color:'#4ADE80' }}>{fv(wantTotal)}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{wantFromOpp.length} asset{wantFromOpp.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              )}

              {/* Verdict message */}
              {verdict && (
                <div style={{ padding:'0.75rem 1rem', background:'var(--bg-secondary)', borderLeft:`4px solid ${verdict.cls === 'verdict-buy' ? '#4ADE80' : verdict.cls === 'verdict-sell' ? '#F87171' : 'var(--gold-400)'}`, borderRadius:'0 var(--radius-md) var(--radius-md) 0', marginBottom:'1rem', fontSize:'0.875rem', color:'var(--text-secondary)' }}>
                  {verdict.msg}
                </div>
              )}

              {/* Suggestion callout */}
              {step === 4 && suggestion && (
                <div style={{ background:'rgba(200,151,58,0.06)', border:'0.5px solid var(--border-gold)', borderRadius:'var(--radius-lg)', padding:'1.25rem', marginBottom:'1.25rem' }}>
                  <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--gold-400)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.75rem' }}>
                    ⚖ The Judge suggests offering:
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {suggestion.map((item, i) => <ItemCard key={i} item={item} format={format} valMap={valMap} />)}
                  </div>
                  <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:'0.75rem' }}>
                    Combined: {fv(total(suggestion))} vs. {fv(wantTotal)} requested · {pct}% {diff >= 0 ? 'in your favor' : 'against you'}
                  </div>
                </div>
              )}

              {/* Suggest button */}
              {wantFromOpp.length > 0 && (
                <button onClick={suggestTrade}
                  style={{ width:'100%', padding:'0.875rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'0.9375rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)', marginBottom:'1.25rem' }}>
                  ⚖ Suggest what to offer for {wantFromOpp.length} selected asset{wantFromOpp.length !== 1 ? 's' : ''} ({fv(wantTotal)})
                </button>
              )}

              {/* Three columns */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>

                {/* COL 1: Opponent — select what you want */}
                <div>
                  <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.5rem', display:'flex', justifyContent:'space-between' }}>
                    <span>{oppTeamName}</span>
                    {wantFromOpp.length > 0 && <span style={{ color:'#4ADE80' }}>{wantFromOpp.length} selected</span>}
                  </div>
                  <input type="text" placeholder="Filter..." value={oppSearch} onChange={e => setOppSearch(e.target.value)}
                    style={{ width:'100%', padding:'0.375rem 0.625rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:'0.8125rem', fontFamily:'var(--font-body)', outline:'none', marginBottom:'0.5rem' }} />
                  <div style={{ maxHeight:500, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                    {oppFiltered.map(p => (
                      <ItemCard key={p.player_id} item={p} format={format} valMap={valMap}
                        onAction={() => toggleWant(p)}
                        actionLabel={wantIds.has(p.player_id) ? '✓' : '+'}
                        actionColor={wantIds.has(p.player_id) ? '#4ADE80' : undefined}
                      />
                    ))}
                    {oppPicks.map(pk => (
                      <ItemCard key={pk.id} item={pk} format={format} valMap={valMap}
                        onAction={() => toggleWant(pk)}
                        actionLabel={wantIds.has(pk.id) ? '✓' : '+'}
                        actionColor={wantIds.has(pk.id) ? '#4ADE80' : undefined}
                      />
                    ))}
                    {oppFiltered.length === 0 && oppPicks.length === 0 && (
                      <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.8125rem' }}>No players found</div>
                    )}
                  </div>
                </div>

                {/* COL 2: My roster — mark untouchable */}
                <div>
                  <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.5rem', display:'flex', justifyContent:'space-between' }}>
                    <span>{myTeamName}</span>
                    {untouchable.size > 0 && <span style={{ color:'#F87171' }}>{untouchable.size} 🔒</span>}
                  </div>
                  <input type="text" placeholder="Filter..." value={mySearch} onChange={e => setMySearch(e.target.value)}
                    style={{ width:'100%', padding:'0.375rem 0.625rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:'0.8125rem', fontFamily:'var(--font-body)', outline:'none', marginBottom:'0.5rem' }} />
                  <div style={{ maxHeight:500, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                    {myFiltered.map(p => (
                      <ItemCard key={p.player_id} item={p} format={format} valMap={valMap}
                        dimmed={untouchable.has(p.player_id)}
                        onAction={() => toggleUntouchable(p.player_id)}
                        actionLabel={untouchable.has(p.player_id) ? '🔒' : '🔓'}
                        actionColor={untouchable.has(p.player_id) ? '#F87171' : 'var(--text-muted)'}
                      />
                    ))}
                    {myPicks.map(pk => (
                      <ItemCard key={pk.id} item={pk} format={format} valMap={valMap}
                        dimmed={untouchable.has(pk.id)}
                        onAction={() => toggleUntouchable(pk.id)}
                        actionLabel={untouchable.has(pk.id) ? '🔒' : '🔓'}
                        actionColor={untouchable.has(pk.id) ? '#F87171' : 'var(--text-muted)'}
                      />
                    ))}
                    {myFiltered.length === 0 && myPicks.length === 0 && (
                      <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.8125rem' }}>No players loaded</div>
                    )}
                  </div>
                </div>

                {/* COL 3: Offering */}
                <div>
                  <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.5rem', display:'flex', justifyContent:'space-between' }}>
                    <span>Offering</span>
                    {givingMine.length > 0 && (
                      <button onClick={() => { setGiving([]); setSuggestion(null); setStep(3); }} style={{ fontSize:'0.7rem', color:'#F87171', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-body)' }}>Clear</button>
                    )}
                  </div>
                  <div style={{ padding:'0.375rem 0.625rem', background:'var(--bg-tertiary)', borderRadius:'var(--radius-md)', fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.5rem' }}>
                    Click players from your roster → or use Suggest
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {givingMine.length === 0 ? (
                      <div style={{ padding:'2rem', textAlign:'center', border:'0.5px dashed var(--border-subtle)', borderRadius:'var(--radius-md)', fontSize:'0.8125rem', color:'var(--text-muted)' }}>
                        Nothing offered yet
                      </div>
                    ) : (
                      givingMine.map((item, i) => (
                        <ItemCard key={i} item={item} format={format} valMap={valMap}
                          onAction={() => toggleGive(item)}
                          actionLabel="✕"
                          actionColor="#F87171"
                        />
                      ))
                    )}
                    {/* Quick-add from my roster */}
                    {givingMine.length < 4 && myPlayers.filter(p => !untouchable.has(p.player_id) && !givingIds.has(p.player_id)).length > 0 && (
                      <div style={{ marginTop:8 }}>
                        <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:4 }}>Click to add from your roster:</div>
                        {myPlayers.filter(p => !untouchable.has(p.player_id) && !givingIds.has(p.player_id)).slice(0, 6).map(p => (
                          <button key={p.player_id} onClick={() => toggleGive(p)}
                            style={{ display:'block', width:'100%', textAlign:'left', padding:'0.375rem 0.625rem', marginBottom:3, background:'transparent', border:'0.5px solid var(--border-subtle)', borderRadius:4, fontSize:'0.8125rem', color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                            + {p.full_name} <span style={{ color:'var(--text-muted)' }}>({fv(adjVal(p, format, valMap))})</span>
                          </button>
                        ))}
                        {myPicks.filter(p => !untouchable.has(p.id) && !givingIds.has(p.id)).slice(0, 3).map(pk => (
                          <button key={pk.id} onClick={() => toggleGive(pk)}
                            style={{ display:'block', width:'100%', textAlign:'left', padding:'0.375rem 0.625rem', marginBottom:3, background:'transparent', border:'0.5px solid var(--border-subtle)', borderRadius:4, fontSize:'0.8125rem', color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                            + {pk.label}{pk.original_owner ? ` (via ${pk.original_owner})` : ''} <span style={{ color:'var(--text-muted)' }}>({fv(pk.value)})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
