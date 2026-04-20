import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import Nav from '../../components/Nav';
import Link from 'next/link';
import { useSleeper } from '../../hooks/useSleeper';
import { supabase } from '../../lib/supabase';

// ── Pick values ───────────────────────────────────────────────────────────────
const PICK_BASE = {
  '2025': { 1: { early:3200,mid:2400,late:1800 }, 2: { early:900,mid:650,late:450 } },
  '2026': { 1: { early:4800,mid:3600,late:2600 }, 2: { early:1400,mid:1000,late:700 } },
  '2027': { 1: { early:5800,mid:4400,late:3200 }, 2: { early:1800,mid:1300,late:900 } },
  '2028': { 1: { early:5200,mid:4000,late:2800 }, 2: { early:1600,mid:1200,late:800 } },
};

const POS_COLORS = {
  QB:{ bg:'rgba(239,68,68,0.15)',  text:'#FCA5A5' },
  RB:{ bg:'rgba(34,197,94,0.15)', text:'#86EFAC' },
  WR:{ bg:'rgba(59,130,246,0.15)',text:'#93C5FD' },
  TE:{ bg:'rgba(251,191,36,0.15)',text:'#FDE68A' },
  K: { bg:'rgba(156,163,175,0.15)',text:'#D1D5DB' },
};

function fv(v) {
  if (!v) return '—';
  return v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v);
}

function adjVal(player, format, valMap) {
  const base = valMap?.[player.player_id] || valMap?.[player.id] || player.value || 500;
  if (format === 'sf'     && player.position === 'QB') return Math.round(base * 1.6);
  if (format === 'teprem' && player.position === 'TE') return Math.round(base * 1.4);
  return base;
}

// ── Small components ──────────────────────────────────────────────────────────
function PosTag({ pos }) {
  const c = POS_COLORS[pos] || { bg:'rgba(156,163,175,0.15)', text:'#D1D5DB' };
  return <span style={{ display:'inline-block', padding:'1px 6px', borderRadius:4, fontSize:'0.65rem', fontWeight:700, background:c.bg, color:c.text, flexShrink:0 }}>{pos}</span>;
}

function PlayerCard({ player, format, valMap, action, actionLabel, actionColor, dimmed }) {
  const val = adjVal(player, format, valMap);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0.5rem 0.75rem', background: dimmed ? 'transparent' : 'var(--bg-secondary)', border:`0.5px solid ${dimmed ? 'var(--border-subtle)' : 'var(--border-default)'}`, borderRadius:'var(--radius-md)', opacity: dimmed ? 0.4 : 1 }}>
      <PosTag pos={player.position} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'0.875rem', fontWeight:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{player.full_name || player.name}</div>
        <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{player.team || player.nfl_team}{player.age ? ` · ${player.age}` : ''}</div>
      </div>
      <span style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--text-secondary)', flexShrink:0 }}>{fv(val)}</span>
      {action && (
        <button onMouseDown={action} style={{ padding:'2px 8px', borderRadius:4, border:`0.5px solid ${actionColor || 'var(--border-default)'}`, background:'transparent', color: actionColor || 'var(--text-muted)', fontSize:'0.75rem', cursor:'pointer', fontFamily:'var(--font-body)', flexShrink:0 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function PickCard({ pick, action, actionLabel, actionColor }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0.5rem 0.75rem', background:'var(--bg-secondary)', border:'0.5px solid var(--border-default)', borderRadius:'var(--radius-md)' }}>
      <span style={{ fontSize:'0.9rem' }}>🎟</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:'0.875rem', fontWeight:500, color:'var(--text-primary)' }}>{pick.label}</div>
        {pick.original_owner && <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>via {pick.original_owner}</div>}
      </div>
      <span style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--text-secondary)' }}>{fv(pick.value)}</span>
      {action && (
        <button onMouseDown={action} style={{ padding:'2px 8px', borderRadius:4, border:`0.5px solid ${actionColor || 'var(--border-default)'}`, background:'transparent', color: actionColor || 'var(--text-muted)', fontSize:'0.75rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.5rem', display:'flex', justifyContent:'space-between' }}>
      <span>{title}</span>
      {count !== undefined && <span>{count}</span>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TradeCalculator() {
  const { sleeperId, isConnected, loading:sleeperLoading } = useSleeper();

  // Step state
  const [step, setStep] = useState(1); // 1=league, 2=opponent, 3=build, 4=suggest

  // League / roster data
  const [leagues, setLeagues]         = useState([]);
  const [league, setLeague]           = useState(null);
  const [format, setFormat]           = useState('1qb');
  const [rosters, setRosters]         = useState([]); // all rosters
  const [userMap, setUserMap]         = useState({});
  const [sleeperPlayers, setSlPlayers] = useState({}); // sleeper player map
  const [tradedPicks, setTradedPicks] = useState([]);
  const [valMap, setValMap]           = useState({}); // player_id -> dynasty value

  // My roster
  const [myRoster, setMyRoster]       = useState(null);
  const [myPlayers, setMyPlayers]     = useState([]);
  const [myPicks, setMyPicks]         = useState([]);

  // Opponent
  const [oppRoster, setOppRoster]     = useState(null);
  const [oppPlayers, setOppPlayers]   = useState([]);
  const [oppPicks, setOppPicks]       = useState([]);

  // Trade build
  const [wantFromOpp, setWantFromOpp] = useState([]); // what I want
  const [givingMine, setGivingMine]   = useState([]); // what I give
  const [untouchable, setUntouchable] = useState(new Set()); // my untouchable player ids

  // UI state
  const [loading, setLoading]         = useState(false);
  const [suggestion, setSuggestion]   = useState(null);
  const [mySearch, setMySearch]       = useState('');
  const [oppSearch, setOppSearch]     = useState('');

  // Load leagues on connect
  useEffect(() => {
    if (!sleeperId) return;
    fetch(`https://api.sleeper.app/v1/user/${sleeperId}/leagues/nfl/2026`)
      .then(r => r.json()).then(d => setLeagues(d || []));
  }, [sleeperId]);

  // Load Sleeper player map (cached)
  useEffect(() => {
    const cached = sessionStorage.getItem('sleeper_players');
    if (cached) { setSlPlayers(JSON.parse(cached)); return; }
    fetch('https://api.sleeper.app/v1/players/nfl')
      .then(r => r.json())
      .then(d => { sessionStorage.setItem('sleeper_players', JSON.stringify(d)); setSlPlayers(d); });
  }, []);

  // Load dynasty values from Supabase
  useEffect(() => {
    if (!format) return;
    supabase.from('v_consensus_rankings')
      .select('player_id, consensus_rank, editorial_rank')
      .eq('format', format).limit(400)
      .then(({ data }) => {
        if (!data?.length) return;
        const map = {};
        data.forEach(r => {
          const rank = r.consensus_rank || r.editorial_rank || 300;
          map[r.player_id] = Math.max(100, Math.round(10000 - (rank-1) * 33));
        });
        setValMap(map);
      });
  }, [format]);

  // Select a league — load rosters, users, picks
  async function selectLeague(l) {
    setLeague(l);
    setLoading(true);
    setStep(2);
    setOppRoster(null);
    setWantFromOpp([]);
    setGivingMine([]);
    setUntouchable(new Set());

    // Detect format
    const hasSF  = l.roster_positions?.includes('SUPER_FLEX');
    const hasTEP = (l.scoring_settings?.bonus_rec_te || 0) >= 0.5;
    setFormat(hasSF ? 'sf' : hasTEP ? 'teprem' : '1qb');

    const [rostersRes, usersRes, picksRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${l.league_id}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${l.league_id}/users`),
      fetch(`https://api.sleeper.app/v1/league/${l.league_id}/traded_picks`),
    ]);
    const r = await rostersRes.json();
    const u = await usersRes.json();
    const p = await picksRes.json();

    const umap = Object.fromEntries(u.map(x => [x.user_id, x]));
    setUserMap(umap);
    setRosters(r);
    setTradedPicks(p || []);

    const mine = r.find(x => x.owner_id === sleeperId);
    setMyRoster(mine);
    if (mine) {
      setMyPlayers(enrichPlayers(mine.players || [], sleeperPlayers));
      setMyPicks(buildPicks(mine, p || [], umap, l));
    }
    setLoading(false);
  }

  // Enrich sleeper player ids with full player data
  function enrichPlayers(ids, pmap) {
    return ids
      .map(id => {
        const p = pmap[id];
        if (!p || !['QB','RB','WR','TE','K'].includes(p.position)) return null;
        return { player_id: id, full_name: p.full_name, position: p.position, team: p.team, age: p.age };
      })
      .filter(Boolean)
      .sort((a,b) => {
        const posOrder = { QB:0,WR:1,RB:2,TE:3,K:4 };
        return (posOrder[a.position]||9) - (posOrder[b.position]||9) ||
               (valMap[b.player_id]||0) - (valMap[a.player_id]||0);
      });
  }

  // Build pick list for a roster
  function buildPicks(roster, traded, umap, l) {
    const picks = [];
    const currentYear = 2026;
    const years = [currentYear, currentYear+1, currentYear+2];

    years.forEach(yr => {
      [1, 2].forEach(round => {
        // Check if this team has this pick (could be traded away / received)
        const sentAway = traded.find(tp =>
          tp.previous_owner_id === roster.roster_id &&
          tp.season === String(yr) && tp.round === round
        );
        const received = traded.find(tp =>
          tp.owner_id === roster.roster_id &&
          tp.season === String(yr) && tp.round === round
        );

        // Own pick if not sent away
        if (!sentAway) {
          picks.push({
            id: `${roster.roster_id}-${yr}-${round}-own`,
            label: `${yr} Round ${round}`,
            year: yr, round,
            slot: 'mid',
            value: PICK_BASE[yr]?.[round]?.mid || 1000,
            roster_id: roster.roster_id,
          });
        }
        // Received picks
        if (received && received.previous_owner_id !== roster.roster_id) {
          const origOwner = umap[rosters.find(r => r.roster_id === received.previous_owner_id)?.owner_id]?.display_name || 'Unknown';
          picks.push({
            id: `${roster.roster_id}-${yr}-${round}-recv-${received.previous_owner_id}`,
            label: `${yr} Round ${round}`,
            year: yr, round,
            slot: 'mid',
            value: PICK_BASE[yr]?.[round]?.mid || 1000,
            original_owner: origOwner,
            roster_id: roster.roster_id,
          });
        }
      });
    });

    return picks;
  }

  // Select opponent team
  function selectOpponent(roster) {
    setOppRoster(roster);
    setOppPlayers(enrichPlayers(roster.players || [], sleeperPlayers));
    setOppPicks(buildPicks(roster, tradedPicks, userMap, league));
    setWantFromOpp([]);
    setGivingMine([]);
    setStep(3);
  }

  // Trade build helpers
  const wantIds     = new Set(wantFromOpp.map(p => p.player_id || p.id));
  const givingIds   = new Set(givingMine.map(p => p.player_id || p.id));

  function toggleWant(item) {
    const id = item.player_id || item.id;
    setWantFromOpp(prev => prev.find(p => (p.player_id||p.id) === id)
      ? prev.filter(p => (p.player_id||p.id) !== id)
      : [...prev, item]);
  }

  function toggleGive(item) {
    const id = item.player_id || item.id;
    if (untouchable.has(id)) return;
    setGivingMine(prev => prev.find(p => (p.player_id||p.id) === id)
      ? prev.filter(p => (p.player_id||p.id) !== id)
      : [...prev, item]);
  }

  function toggleUntouchable(id) {
    setUntouchable(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    // Remove from giving if marked untouchable
    setGivingMine(prev => prev.filter(p => (p.player_id||p.id) !== id));
  }

  // Calculate totals
  function total(items) {
    return items.reduce((s, p) => s + adjVal(p, format, valMap), 0);
  }

  const wantTotal  = total(wantFromOpp);
  const giveTotal  = total(givingMine);
  const diff       = wantTotal - giveTotal;
  const pct        = Math.max(wantTotal, giveTotal) > 0
    ? Math.round((Math.abs(diff) / Math.max(wantTotal, giveTotal)) * 100) : 0;

  function getVerdict() {
    if (!wantFromOpp.length && !givingMine.length) return null;
    if (pct <= 5)  return { label:'◆ FAIR',        cls:'verdict-hold', msg:'Roughly even. Accept or decline based on roster fit.' };
    if (diff > 0)  return pct >= 20
      ? { label:'▲ STRONG BUY', cls:'verdict-buy',  msg:`You're winning by ${pct}%. Pull the trigger.` }
      : { label:'▲ BUY',        cls:'verdict-buy',  msg:'Slight advantage to you. Reasonable to accept.' };
    return pct >= 20
      ? { label:'▼ STRONG SELL',cls:'verdict-sell', msg:`You're losing by ${pct}%. Counter or walk away.` }
      : { label:'▼ SELL',       cls:'verdict-sell', msg:'You\'re giving up slightly more. Counter if possible.' };
  }

  // Generate trade suggestion
  function suggestTrade() {
    if (!wantFromOpp.length) { alert('Select at least one player/pick you want from the opponent.'); return; }

    const target  = wantTotal;
    const budget  = target * 1.05; // can overpay by 5%
    const floor   = target * 0.85; // minimum value to offer

    // Available assets (not untouchable, not already in give)
    const available = [
      ...myPlayers.filter(p => !untouchable.has(p.player_id) && !givingIds.has(p.player_id)),
      ...myPicks.filter(p => !givingIds.has(p.id)),
    ].sort((a,b) => adjVal(b, format, valMap) - adjVal(a, format, valMap));

    // Try to find a combo within range
    let best = null;
    let bestDiff = Infinity;

    // 1-asset trades
    for (const a of available) {
      const v = adjVal(a, format, valMap);
      if (v >= floor && v <= budget) {
        const d = Math.abs(v - target);
        if (d < bestDiff) { bestDiff = d; best = [a]; }
      }
    }

    // 2-asset trades if no 1-asset found
    if (!best) {
      for (let i = 0; i < available.length; i++) {
        for (let j = i+1; j < available.length; j++) {
          const v = adjVal(available[i], format, valMap) + adjVal(available[j], format, valMap);
          if (v >= floor && v <= budget) {
            const d = Math.abs(v - target);
            if (d < bestDiff) { bestDiff = d; best = [available[i], available[j]]; }
          }
        }
      }
    }

    // 3-asset trades
    if (!best) {
      for (let i = 0; i < available.length; i++) {
        for (let j = i+1; j < available.length; j++) {
          for (let k = j+1; k < available.length; k++) {
            const v = [available[i],available[j],available[k]].reduce((s,a) => s + adjVal(a, format, valMap), 0);
            if (v >= floor && v <= budget) {
              const d = Math.abs(v - target);
              if (d < bestDiff) { bestDiff = d; best = [available[i],available[j],available[k]]; }
            }
          }
        }
      }
    }

    if (best) {
      setSuggestion(best);
      setGivingMine(best);
      setStep(4);
    } else {
      setSuggestion(null);
      alert(`No combination of your available assets matches the value of what you want (${fv(target)}). You may need to include more players or accept a slightly uneven trade.`);
    }
  }

  // Filtered player lists for search
  const myFiltered  = mySearch
    ? myPlayers.filter(p => (p.full_name||'').toLowerCase().includes(mySearch.toLowerCase()))
    : myPlayers;
  const oppFiltered = oppSearch
    ? oppPlayers.filter(p => (p.full_name||'').toLowerCase().includes(oppSearch.toLowerCase()))
    : oppPlayers;

  const myTeamName  = userMap[myRoster?.owner_id]?.display_name  || 'My team';
  const oppTeamName = userMap[oppRoster?.owner_id]?.display_name || 'Opponent';
  const verdict     = getVerdict();

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Trade Calculator — DynastyJudge</title>
      </Head>
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
              Select a Sleeper league, pick your trade partner, choose what you want — and the Judge suggests what to offer.
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

          {/* Step progress */}
          {isConnected && (
            <div style={{ display:'flex', gap:0, marginBottom:'1.5rem', borderBottom:'0.5px solid var(--border-subtle)', paddingBottom:'1rem', overflowX:'auto' }}>
              {[
                [1,'Select league'],
                [2,'Select opponent'],
                [3,'Build trade'],
                [4,'Suggestion'],
              ].map(([n, label]) => (
                <div key={n} style={{ display:'flex', alignItems:'center', gap:6, marginRight:20, cursor: n < step ? 'pointer' : 'default', flexShrink:0 }}
                  onClick={() => n < step && setStep(n)}>
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
              {leagues.length === 0 && <div style={{ color:'var(--text-muted)', textAlign:'center', padding:'2rem' }}>No active leagues found.</div>}
              {leagues.map(l => (
                <button key={l.league_id} onClick={() => selectLeague(l)}
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.25rem', background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', cursor:'pointer', fontFamily:'var(--font-body)', textAlign:'left', transition:'border-color .12s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-gold)'}
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
                  <span style={{ color:'var(--gold-400)', fontSize:'0.875rem' }}>Select →</span>
                </button>
              ))}
            </div>
          )}

          {/* ── STEP 2: Select opponent ── */}
          {isConnected && step === 2 && (
            <div>
              {loading && <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>Loading rosters...</div>}
              {!loading && (
                <>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
                    <h2 style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)' }}>Select your trade partner</h2>
                    <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{league?.name}</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {rosters
                      .filter(r => r.owner_id !== sleeperId)
                      .map(r => {
                        const user = userMap[r.owner_id] || {};
                        const topPlayers = (r.players || [])
                          .map(id => sleeperPlayers[id])
                          .filter(p => p && ['QB','WR','RB','TE'].includes(p.position))
                          .sort((a,b) => (valMap[Object.keys(sleeperPlayers).find(k => sleeperPlayers[k]===b)]||0) - (valMap[Object.keys(sleeperPlayers).find(k => sleeperPlayers[k]===a)]||0))
                          .slice(0, 3);

                        return (
                          <button key={r.roster_id} onClick={() => selectOpponent(r)}
                            style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'1rem 1.25rem', background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', cursor:'pointer', fontFamily:'var(--font-body)', textAlign:'left', transition:'border-color .12s' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-gold)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-subtle)'}
                          >
                            {/* Avatar */}
                            <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--bg-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', fontWeight:700, color:'var(--text-muted)', flexShrink:0 }}>
                              {(user.display_name || '?')[0].toUpperCase()}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>
                                {user.display_name || 'Unknown'}
                              </div>
                              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                                {topPlayers.map((p,i) => (
                                  <span key={i} style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                                    {p.full_name?.split(' ').slice(-1)[0]}{i < topPlayers.length-1 ? ',' : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div style={{ textAlign:'right', flexShrink:0 }}>
                              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{r.players?.length || 0} players</div>
                              <div style={{ fontSize:'0.875rem', color:'var(--gold-400)', marginTop:2 }}>Trade →</div>
                            </div>
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
              {/* Format badge */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1.25rem' }}>
                <span style={{ fontSize:'0.8125rem', padding:'3px 10px', borderRadius:99, background:'rgba(200,151,58,0.12)', color:'var(--gold-400)', border:'0.5px solid var(--border-gold)', fontWeight:600 }}>
                  {format === 'sf' ? 'SuperFlex' : format === 'teprem' ? 'TE Premium' : '1QB'}
                </span>
                <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{league?.name}</span>
                <button onClick={() => setStep(2)} style={{ fontSize:'0.8125rem', color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-body)', marginLeft:'auto' }}>← Change opponent</button>
              </div>

              {/* Trade summary bar */}
              {(wantFromOpp.length > 0 || givingMine.length > 0) && (
                <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-default)', borderRadius:'var(--radius-lg)', padding:'1rem 1.25rem', marginBottom:'1.25rem', display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'0.75rem', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>You give</div>
                    <div style={{ fontSize:'1.25rem', fontWeight:700, color:'#F87171' }}>{fv(giveTotal)}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{givingMine.length} asset{givingMine.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    {verdict ? (
                      <>
                        <span className={`verdict ${verdict.cls}`} style={{ fontSize:'0.75rem', padding:'4px 10px' }}>{verdict.label}</span>
                        <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>
                          {diff > 0 ? '+' : ''}{fv(Math.abs(diff))} {diff >= 0 ? 'your way' : 'against you'}
                        </div>
                      </>
                    ) : <span style={{ fontSize:'1.5rem', color:'var(--text-muted)' }}>⇄</span>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>You receive</div>
                    <div style={{ fontSize:'1.25rem', fontWeight:700, color:'#4ADE80' }}>{fv(wantTotal)}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{wantFromOpp.length} asset{wantFromOpp.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              )}

              {/* Verdict message */}
              {verdict && (
                <div style={{ padding:'0.875rem 1rem', background:'var(--bg-secondary)', border:`0.5px solid var(--border-default)`, borderLeft:`4px solid ${verdict.cls === 'verdict-buy' ? '#4ADE80' : verdict.cls === 'verdict-sell' ? '#F87171' : 'var(--gold-400)'}`, borderRadius:'0 var(--radius-md) var(--radius-md) 0', marginBottom:'1.25rem', fontSize:'0.875rem', color:'var(--text-secondary)' }}>
                  {verdict.msg}
                </div>
              )}

              {/* Suggest button */}
              {wantFromOpp.length > 0 && (
                <button onClick={suggestTrade}
                  style={{ width:'100%', padding:'0.875rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'0.9375rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)', marginBottom:'1.5rem', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  ⚖ Suggest what to offer for {wantFromOpp.length} selected asset{wantFromOpp.length !== 1 ? 's' : ''}
                </button>
              )}

              {/* Suggestion result */}
              {step === 4 && suggestion && (
                <div style={{ background:'rgba(200,151,58,0.06)', border:'0.5px solid var(--border-gold)', borderRadius:'var(--radius-lg)', padding:'1.25rem', marginBottom:'1.5rem' }}>
                  <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--gold-400)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.75rem' }}>
                    ⚖ The Judge suggests offering:
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {suggestion.map((asset, i) => (
                      asset.player_id
                        ? <PlayerCard key={i} player={asset} format={format} valMap={valMap} />
                        : <PickCard key={i} pick={asset} />
                    ))}
                  </div>
                  <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:'0.75rem' }}>
                    Combined value: {fv(total(suggestion))} vs. {fv(wantTotal)} requested — {pct}% {diff >= 0 ? 'in your favor' : 'against you'}
                  </div>
                </div>
              )}

              {/* Three column layout: opponent | untouchable | give */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>

                {/* COL 1: Opponent roster — want from them */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                    <SectionHeader title={oppTeamName} count={oppPlayers.length} />
                    {wantFromOpp.length > 0 && <span style={{ fontSize:'0.75rem', color:'#4ADE80', fontWeight:600 }}>{wantFromOpp.length} selected</span>}
                  </div>
                  <input type="text" placeholder="Filter players..." value={oppSearch} onChange={e => setOppSearch(e.target.value)}
                    style={{ width:'100%', padding:'0.375rem 0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:'0.8125rem', fontFamily:'var(--font-body)', outline:'none', marginBottom:'0.5rem' }} />
                  <div style={{ maxHeight:420, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
                    {oppFiltered.map(p => (
                      <PlayerCard key={p.player_id} player={p} format={format} valMap={valMap}
                        action={() => toggleWant(p)}
                        actionLabel={wantIds.has(p.player_id) ? '✓ Want' : '+ Want'}
                        actionColor={wantIds.has(p.player_id) ? '#4ADE80' : undefined}
                      />
                    ))}
                    {oppPicks.map(pk => (
                      <PickCard key={pk.id} pick={pk}
                        action={() => toggleWant(pk)}
                        actionLabel={wantIds.has(pk.id) ? '✓ Want' : '+ Want'}
                        actionColor={wantIds.has(pk.id) ? '#4ADE80' : undefined}
                      />
                    ))}
                  </div>
                </div>

                {/* COL 2: My roster — mark untouchable */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                    <SectionHeader title={myTeamName} count={myPlayers.length} />
                    {untouchable.size > 0 && <span style={{ fontSize:'0.75rem', color:'#F87171', fontWeight:600 }}>{untouchable.size} untouchable</span>}
                  </div>
                  <input type="text" placeholder="Filter players..." value={mySearch} onChange={e => setMySearch(e.target.value)}
                    style={{ width:'100%', padding:'0.375rem 0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:'0.8125rem', fontFamily:'var(--font-body)', outline:'none', marginBottom:'0.5rem' }} />
                  <div style={{ maxHeight:420, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
                    {myFiltered.map(p => (
                      <PlayerCard key={p.player_id} player={p} format={format} valMap={valMap}
                        dimmed={untouchable.has(p.player_id)}
                        action={() => toggleUntouchable(p.player_id)}
                        actionLabel={untouchable.has(p.player_id) ? '🔒' : '🔓'}
                        actionColor={untouchable.has(p.player_id) ? '#F87171' : undefined}
                      />
                    ))}
                    {myPicks.map(pk => (
                      <PickCard key={pk.id} pick={pk}
                        action={() => toggleUntouchable(pk.id)}
                        actionLabel={untouchable.has(pk.id) ? '🔒' : '🔓'}
                        actionColor={untouchable.has(pk.id) ? '#F87171' : undefined}
                      />
                    ))}
                  </div>
                </div>

                {/* COL 3: What I'm giving */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                    <SectionHeader title="Offering" count={givingMine.length} />
                    {givingMine.length > 0 && (
                      <button onClick={() => setGivingMine([])} style={{ fontSize:'0.7rem', color:'#F87171', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-body)' }}>Clear</button>
                    )}
                  </div>
                  <div style={{ marginBottom:'0.5rem', padding:'0.375rem 0.75rem', background:'var(--bg-tertiary)', borderRadius:'var(--radius-md)', fontSize:'0.75rem', color:'var(--text-muted)' }}>
                    Click players from your roster to add
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {givingMine.length === 0 && (
                      <div style={{ padding:'2rem', textAlign:'center', border:'0.5px dashed var(--border-subtle)', borderRadius:'var(--radius-md)', fontSize:'0.8125rem', color:'var(--text-muted)' }}>
                        Select players/picks from your roster
                      </div>
                    )}
                    {givingMine.map((item, i) => (
                      item.player_id
                        ? <PlayerCard key={i} player={item} format={format} valMap={valMap}
                            action={() => toggleGive(item)}
                            actionLabel="✕"
                            actionColor="#F87171"
                          />
                        : <PickCard key={i} pick={item}
                            action={() => toggleGive(item)}
                            actionLabel="✕"
                            actionColor="#F87171"
                          />
                    ))}
                    {/* Also allow clicking from my roster to add to give */}
                    {myFiltered.filter(p => !untouchable.has(p.player_id) && !givingIds.has(p.player_id)).slice(0, 5).length > 0 && givingMine.length < 3 && (
                      <div style={{ marginTop:8 }}>
                        <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:4 }}>Quick add from your roster:</div>
                        {myFiltered.filter(p => !untouchable.has(p.player_id) && !givingIds.has(p.player_id)).slice(0, 5).map(p => (
                          <button key={p.player_id} onClick={() => toggleGive(p)}
                            style={{ display:'block', width:'100%', textAlign:'left', padding:'0.375rem 0.5rem', marginBottom:3, background:'transparent', border:'0.5px solid var(--border-subtle)', borderRadius:4, fontSize:'0.8125rem', color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                            + {p.full_name} ({fv(adjVal(p, format, valMap))})
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
