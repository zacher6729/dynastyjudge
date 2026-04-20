import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Nav from '../../../components/Nav';
import { supabase } from '../../../lib/supabase';

const POS_COLORS = {
  QB:{ bg:'rgba(239,68,68,0.15)',  text:'#FCA5A5' },
  RB:{ bg:'rgba(34,197,94,0.15)', text:'#86EFAC' },
  WR:{ bg:'rgba(59,130,246,0.15)',text:'#93C5FD' },
  TE:{ bg:'rgba(251,191,36,0.15)',text:'#FDE68A' },
  K: { bg:'rgba(156,163,175,0.15)',text:'#D1D5DB' },
  DL:{ bg:'rgba(168,85,247,0.15)', text:'#D8B4FE' },
  LB:{ bg:'rgba(168,85,247,0.15)', text:'#D8B4FE' },
  DB:{ bg:'rgba(168,85,247,0.15)', text:'#D8B4FE' },
  CB:{ bg:'rgba(168,85,247,0.15)', text:'#D8B4FE' },
  S: { bg:'rgba(168,85,247,0.15)', text:'#D8B4FE' },
};

function PosTag({ pos, small }) {
  const c = POS_COLORS[pos] || { bg:'rgba(156,163,175,0.15)', text:'#D1D5DB' };
  return (
    <span style={{ display:'inline-block', padding: small ? '0 4px':'1px 6px', borderRadius:3, fontSize: small ? '0.6rem':'0.65rem', fontWeight:700, background:c.bg, color:c.text, flexShrink:0 }}>
      {pos}
    </span>
  );
}

const STAR_COLORS = { 5:'#FBBF24', 4:'#60A5FA', 3:'#A3E635' };
function Stars({ n }) {
  if (!n) return null;
  return <span style={{ color: STAR_COLORS[n] || '#9CA3AF', fontSize:'0.7rem' }}>{'★'.repeat(n)}</span>;
}

export default function DevyDraftRoom() {
  const router = useRouter();
  const { id: draftId } = router.query;

  // Draft state
  const [draft, setDraft]       = useState(null);
  const [picks, setPicks]       = useState([]);
  const [pool, setPool]         = useState([]);
  const [trades, setTrades]     = useState([]);
  const [myRosterId, setMyRosterId] = useState(null);
  const [isCommish, setIsCommish]   = useState(false);
  const [session, setSession]   = useState(null);

  // UI state
  const [activeTab, setTab]     = useState('board');  // board | pool | rosters | trades
  const [poolSearch, setSearch] = useState('');
  const [poolPos, setPoolPos]   = useState('ALL');
  const [poolClass, setClass]   = useState('ALL');
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [picking, setPicking]   = useState(false);
  const [error, setError]       = useState('');

  // Trade UI
  const [showTradeModal, setShowTrade]   = useState(false);
  const [tradeTarget, setTradeTarget]    = useState(null);
  const [tradeGive, setTradeGive]        = useState([]);
  const [tradeReceive, setTradeReceive]  = useState([]);

  const timerRef = useRef(null);
  const pickStartRef = useRef(null);

  // Load draft on mount
  useEffect(() => {
    if (!draftId) return;
    loadDraft();

    // Auth
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });
  }, [draftId]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!draftId) return;

    const picksChannel = supabase
      .channel(`devy_picks_${draftId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'devy_picks',
        filter: `draft_id=eq.${draftId}`,
      }, payload => {
        setPicks(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(p => p.id === payload.new.id);
          if (idx >= 0) updated[idx] = payload.new;
          else updated.push(payload.new);
          return updated.sort((a,b) => a.overall - b.overall);
        });
        resetTimer();
      })
      .subscribe();

    const draftChannel = supabase
      .channel(`devy_draft_${draftId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'devy_drafts',
        filter: `id=eq.${draftId}`,
      }, payload => setDraft(payload.new))
      .subscribe();

    const tradesChannel = supabase
      .channel(`devy_trades_${draftId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'devy_draft_trades',
        filter: `draft_id=eq.${draftId}`,
      }, payload => {
        setTrades(prev => {
          const idx = prev.findIndex(t => t.id === payload.new.id);
          if (idx >= 0) { const u = [...prev]; u[idx] = payload.new; return u; }
          return [payload.new, ...prev];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(picksChannel);
      supabase.removeChannel(draftChannel);
      supabase.removeChannel(tradesChannel);
    };
  }, [draftId]);

  async function loadDraft() {
    setLoading(true);
    const [
      { data: draftData },
      { data: picksData },
      { data: tradesData },
    ] = await Promise.all([
      supabase.from('devy_drafts').select('*').eq('id', draftId).single(),
      supabase.from('devy_picks').select('*').eq('draft_id', draftId).order('overall'),
      supabase.from('devy_draft_trades').select('*').eq('draft_id', draftId).order('created_at', { ascending: false }),
    ]);

    setDraft(draftData);
    setPicks(picksData || []);
    setTrades(tradesData || []);

    if (draftData) {
      await loadPool(draftData);
      // Determine if current user is commissioner
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s && draftData.commissioner_id === s.user.id) setIsCommish(true);

      // Set my roster from localStorage (set during draft setup)
      const storedRosterId = localStorage.getItem(`devy_draft_${draftId}_roster_id`);
      if (storedRosterId) setMyRosterId(parseInt(storedRosterId));
    }

    setLoading(false);
  }

  async function loadPool(draftData) {
    let query = supabase
      .from('players')
      .select('id, name, position, college, recruiting_class, recruiting_rank, recruiting_stars, nfl_team, age, is_devy, injury_status')
      .eq('is_active', true);

    if (draftData.include_devy && !draftData.include_nfl_players) {
      query = query.eq('is_devy', true).in('recruiting_class', draftData.devy_classes?.map(Number) || [2027, 2028]);
    } else if (draftData.include_devy && draftData.include_nfl_players) {
      query = query.or(`is_devy.eq.true,is_devy.eq.false`);
    } else {
      query = query.eq('is_devy', false);
    }

    const { data } = await query.order('recruiting_rank', { ascending: true, nullsFirst: false }).limit(500);
    setPool(data || []);
  }

  // Pick timer
  function resetTimer() {
    if (!draft?.seconds_per_pick || draft?.status !== 'active') return;
    clearInterval(timerRef.current);
    pickStartRef.current = Date.now();
    setTimeLeft(draft.seconds_per_pick);
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - pickStartRef.current) / 1000);
      const remaining = Math.max(0, draft.seconds_per_pick - elapsed);
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(timerRef.current);
    }, 1000);
  }

  useEffect(() => {
    if (draft?.status === 'active') resetTimer();
    return () => clearInterval(timerRef.current);
  }, [draft?.status, draft?.current_pick]);

  // Derived state
  const draftedIds   = new Set(picks.filter(p => p.is_picked).map(p => p.player_id));
  const availPool    = pool.filter(p => !draftedIds.has(p.id));
  const currentPick  = picks.find(p => p.overall === draft?.current_pick);
  const isMyPick     = currentPick?.current_roster_id === myRosterId;
  const totalPicks   = draft ? draft.num_teams * draft.rounds : 0;
  const picksLeft    = totalPicks - (draft?.current_pick || 1) + 1;

  // Filter pool
  const filteredPool = availPool.filter(p => {
    if (poolPos !== 'ALL' && p.position !== poolPos) return false;
    if (poolClass !== 'ALL' && String(p.recruiting_class) !== poolClass) return false;
    if (poolSearch && !p.name.toLowerCase().includes(poolSearch.toLowerCase())) return false;
    return true;
  });

  // My roster picks
  const myPicks = picks.filter(p => p.current_roster_id === myRosterId && p.is_picked);
  const myFuturePicks = picks.filter(p => p.current_roster_id === myRosterId && !p.is_picked);

  // Roster view — all teams
  const teams = draft?.draft_order || [];
  function teamPicks(rosterId) {
    return picks.filter(p => p.current_roster_id === rosterId && p.is_picked);
  }

  // Commissioner controls
  async function controlDraft(action, extra = {}) {
    const res = await fetch('/api/devy/control-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, draft_id: draftId, ...extra }),
    });
    const data = await res.json();
    if (!data.success) setError(data.error);
    else { setError(''); loadDraft(); }
  }

  // Make a pick
  async function makePick(player) {
    if (!isMyPick && !isCommish) return;
    if (picking) return;
    setPicking(true);
    setError('');
    const res = await fetch('/api/devy/make-pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft_id:  draftId,
        overall:   draft.current_pick,
        player_id: player.id,
        roster_id: currentPick?.current_roster_id,
      }),
    });
    const data = await res.json();
    if (!data.success) setError(data.error);
    setPicking(false);
  }

  // Propose trade
  async function proposeTrade() {
    if (!tradeTarget || !tradeGive.length && !tradeReceive.length) return;
    await fetch('/api/devy/draft-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'propose',
        draft_id: draftId,
        proposing_roster_id: myRosterId,
        receiving_roster_id: tradeTarget.roster_id,
        proposing_name: teams.find(t => t.roster_id === myRosterId)?.owner_name || 'Me',
        receiving_name: tradeTarget.owner_name,
        proposing_gives: tradeGive,
        receiving_gives: tradeReceive,
      }),
    });
    setShowTrade(false); setTradeGive([]); setTradeReceive([]);
  }

  async function respondTrade(trade_id, action) {
    await fetch('/api/devy/draft-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, trade_id }),
    });
  }

  // Post-draft recap
  function generateRecap() {
    const accepted = trades.filter(t => t.status === 'accepted');
    const draftedByTeam = {};
    teams.forEach(t => { draftedByTeam[t.roster_id] = []; });
    picks.filter(p => p.is_picked).forEach(p => {
      if (!draftedByTeam[p.current_roster_id]) draftedByTeam[p.current_roster_id] = [];
      draftedByTeam[p.current_roster_id].push(p);
    });
    return { accepted, draftedByTeam };
  }

  const timerColor = timeLeft <= 10 ? '#F87171' : timeLeft <= 30 ? '#FBBF24' : '#4ADE80';

  if (loading) return (
    <><Nav /><div style={{ padding:'4rem', textAlign:'center', color:'var(--text-muted)' }}>Loading draft room...</div></>
  );

  if (!draft) return (
    <><Nav /><div style={{ padding:'4rem', textAlign:'center', color:'var(--text-muted)' }}>Draft not found.</div></>
  );

  const isComplete = draft.status === 'complete';
  const recap      = isComplete ? generateRecap() : null;

  return (
    <>
      <Head><title>{draft.name} — Devy Draft Room</title></Head>
      <Nav />

      <main style={{ minHeight:'100vh', background:'var(--bg-primary)' }}>

        {/* ── DRAFT HEADER ── */}
        <div style={{ background:'var(--bg-secondary)', borderBottom:'0.5px solid var(--border-default)', position:'sticky', top:56, zIndex:100 }}>
          <div style={{ maxWidth:1400, margin:'0 auto', padding:'0.75rem 1.5rem', display:'flex', alignItems:'center', gap:'1.5rem', flexWrap:'wrap' }}>

            {/* Draft name + status */}
            <div>
              <div style={{ fontSize:'0.9375rem', fontWeight:700, color:'var(--text-primary)' }}>{draft.name}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                {draft.league_name} · {draft.num_teams} teams · {draft.rounds} rounds
              </div>
            </div>

            {/* Current pick + timer */}
            {draft.status === 'active' && !isComplete && (
              <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.5rem 1rem', background:'rgba(200,151,58,0.08)', border:'0.5px solid var(--border-gold)', borderRadius:'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>On the clock</div>
                  <div style={{ fontSize:'0.9375rem', fontWeight:700, color: isMyPick ? 'var(--gold-400)' : 'var(--text-primary)' }}>
                    {isMyPick ? '⭐ YOUR PICK' : currentPick?.owner_name || '—'}
                  </div>
                  <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                    Pick {draft.current_pick} · Round {Math.ceil(draft.current_pick / draft.num_teams)}
                  </div>
                </div>
                {timeLeft !== null && (
                  <div style={{ textAlign:'center', minWidth:48 }}>
                    <div style={{ fontSize:'1.75rem', fontWeight:700, color: timerColor, fontVariantNumeric:'tabular-nums', lineHeight:1 }}>{timeLeft}</div>
                    <div style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>secs</div>
                  </div>
                )}
              </div>
            )}

            {isComplete && (
              <div style={{ padding:'0.5rem 1rem', background:'rgba(34,197,94,0.1)', border:'0.5px solid rgba(34,197,94,0.3)', borderRadius:'var(--radius-md)', fontSize:'0.875rem', fontWeight:600, color:'#4ADE80' }}>
                ✓ Draft Complete
              </div>
            )}

            {draft.status === 'setup' && (
              <div style={{ padding:'0.5rem 1rem', background:'rgba(251,191,36,0.1)', border:'0.5px solid rgba(251,191,36,0.3)', borderRadius:'var(--radius-md)', fontSize:'0.875rem', color:'#FBBF24' }}>
                ⏳ Draft not started
              </div>
            )}

            {draft.status === 'paused' && (
              <div style={{ padding:'0.5rem 1rem', background:'rgba(156,163,175,0.1)', border:'0.5px solid rgba(156,163,175,0.3)', borderRadius:'var(--radius-md)', fontSize:'0.875rem', color:'#9CA3AF' }}>
                ⏸ Draft paused
              </div>
            )}

            {/* Picks progress bar */}
            <div style={{ flex:1, minWidth:120 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:4 }}>
                <span>Pick {Math.min(draft.current_pick - 1, totalPicks)} of {totalPicks}</span>
                <span>{picksLeft} remaining</span>
              </div>
              <div style={{ height:6, background:'var(--bg-tertiary)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', background:'var(--gold-500)', borderRadius:99, width: `${Math.min(100, ((draft.current_pick - 1) / totalPicks) * 100)}%`, transition:'width .5s' }} />
              </div>
            </div>

            {/* Commissioner controls */}
            {isCommish && !isComplete && (
              <div style={{ display:'flex', gap:6 }}>
                {draft.status === 'setup' && (
                  <button onClick={() => controlDraft('start')} style={{ padding:'0.5rem 1rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'0.875rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                    ▶ Start Draft
                  </button>
                )}
                {draft.status === 'active' && (
                  <button onClick={() => controlDraft('pause')} style={{ padding:'0.5rem 0.875rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.875rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                    ⏸ Pause
                  </button>
                )}
                {draft.status === 'paused' && (
                  <button onClick={() => controlDraft('start')} style={{ padding:'0.5rem 0.875rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'0.875rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                    ▶ Resume
                  </button>
                )}
              </div>
            )}

            {/* Pending trades badge */}
            {trades.filter(t => t.status === 'pending' && t.receiving_roster_id === myRosterId).length > 0 && (
              <button onClick={() => setTab('trades')} style={{ padding:'0.5rem 0.875rem', borderRadius:'var(--radius-md)', background:'rgba(239,68,68,0.15)', border:'0.5px solid rgba(239,68,68,0.4)', color:'#F87171', fontSize:'0.8125rem', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                🔄 {trades.filter(t => t.status === 'pending' && t.receiving_roster_id === myRosterId).length} trade offer{trades.filter(t=>t.status==='pending'&&t.receiving_roster_id===myRosterId).length!==1?'s':''}
              </button>
            )}
          </div>

          {/* Error bar */}
          {error && (
            <div style={{ padding:'0.5rem 1.5rem', background:'rgba(239,68,68,0.1)', color:'#F87171', fontSize:'0.8125rem', borderTop:'0.5px solid rgba(239,68,68,0.2)' }}>
              {error} <button onClick={() => setError('')} style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', marginLeft:8 }}>✕</button>
            </div>
          )}
        </div>

        {/* ── MAIN LAYOUT ── */}
        <div style={{ maxWidth:1400, margin:'0 auto', padding:'1rem 1.5rem', display:'grid', gridTemplateColumns:'1fr 320px', gap:'1rem', alignItems:'start' }}>

          {/* ── LEFT: Main content ── */}
          <div>
            {/* Tab bar */}
            <div style={{ display:'flex', gap:0, border:'0.5px solid var(--border-default)', borderRadius:'var(--radius-md)', overflow:'hidden', marginBottom:'1rem', width:'fit-content' }}>
              {[['board','📋 Draft board'],['pool','🎯 Player pool'],['rosters','👥 Rosters'],['trades','🔄 Trades']].map(([id,label]) => (
                <button key={id} onClick={() => setTab(id)} style={{ padding:'0.5rem 1rem', background: activeTab===id ? 'var(--bg-secondary)':'transparent', color: activeTab===id ? 'var(--text-primary)':'var(--text-muted)', border:'none', borderRight: id!=='trades' ? '0.5px solid var(--border-default)':'none', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:'0.875rem', fontWeight: activeTab===id ? 600:400 }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── DRAFT BOARD ── */}
            {activeTab === 'board' && (
              <div>
                {/* Round headers */}
                {Array.from({ length: draft.rounds }, (_, r) => r + 1).map(round => (
                  <div key={round} style={{ marginBottom:'1rem' }}>
                    <div style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.5rem', padding:'0.375rem 0.75rem', background:'var(--bg-tertiary)', borderRadius:'var(--radius-md)', display:'inline-block' }}>
                      Round {round}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(draft.num_teams, 6)}, 1fr)`, gap:6 }}>
                      {picks.filter(p => p.round === round).map(pick => {
                        const isCurrent = pick.overall === draft.current_pick && draft.status === 'active';
                        return (
                          <div key={pick.overall} style={{ padding:'0.625rem 0.75rem', background: isCurrent ? 'rgba(200,151,58,0.12)' : pick.is_picked ? 'var(--bg-secondary)' : 'var(--bg-tertiary)', border: `0.5px solid ${isCurrent ? 'var(--gold-500)' : pick.is_picked ? 'var(--border-subtle)' : 'var(--border-subtle)'}`, borderRadius:'var(--radius-md)', minHeight:72 }}>
                            <div style={{ fontSize:'0.65rem', color: isCurrent ? 'var(--gold-400)' : 'var(--text-muted)', marginBottom:4, fontWeight:600 }}>
                              {isCurrent ? '⭐ ON CLOCK' : `#${pick.overall}`} · {pick.owner_name?.split(' ')[0]}
                            </div>
                            {pick.is_picked ? (
                              <>
                                <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--text-primary)', lineHeight:1.3, marginBottom:3 }}>{pick.player_name}</div>
                                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                                  <PosTag pos={pick.player_position} small />
                                  {pick.player_class && <span style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>'{String(pick.player_class).slice(2)}</span>}
                                </div>
                              </>
                            ) : (
                              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontStyle:'italic' }}>
                                {isCurrent ? 'Selecting...' : pick.is_traded ? '🔄 Traded' : '—'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── PLAYER POOL ── */}
            {activeTab === 'pool' && (
              <div>
                {/* Filters */}
                <div style={{ display:'flex', gap:8, marginBottom:'0.875rem', flexWrap:'wrap', alignItems:'center' }}>
                  <input type="text" placeholder="Search players..." value={poolSearch} onChange={e => setSearch(e.target.value)}
                    style={{ padding:'0.5rem 0.875rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:'0.875rem', fontFamily:'var(--font-body)', outline:'none', minWidth:180 }} />
                  {['ALL','QB','RB','WR','TE','DL','LB','DB'].map(p => (
                    <button key={p} onClick={() => setPoolPos(p)} style={{ padding:'0.3rem 0.75rem', borderRadius:99, border: poolPos===p ? '0.5px solid var(--border-gold)':'0.5px solid var(--border-subtle)', background: poolPos===p ? 'rgba(200,151,58,0.1)':'transparent', color: poolPos===p ? 'var(--gold-400)':'var(--text-muted)', fontSize:'0.8125rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>{p}</button>
                  ))}
                  <select value={poolClass} onChange={e => setClass(e.target.value)} style={{ padding:'0.3rem 0.625rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:'0.8125rem', fontFamily:'var(--font-body)' }}>
                    <option value="ALL">All classes</option>
                    {(draft.devy_classes || []).map(c => <option key={c} value={c}>Class of {c}</option>)}
                    {draft.include_nfl_players && <option value="nfl">NFL Players</option>}
                  </select>
                  <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginLeft:'auto' }}>{filteredPool.length} available</span>
                </div>

                {/* Table header */}
                <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 60px 80px 80px 100px', padding:'0.5rem 0.75rem', borderBottom:'0.5px solid var(--border-default)', fontSize:'0.7rem', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                  <span>Rk</span><span>Player</span><span>Pos</span><span>Class</span><span>College</span><span style={{ textAlign:'right' }}>Action</span>
                </div>

                {filteredPool.slice(0, 100).map((p, i) => (
                  <div key={p.id} style={{ display:'grid', gridTemplateColumns:'32px 1fr 60px 80px 80px 100px', padding:'0.625rem 0.75rem', borderBottom:'0.5px solid var(--border-subtle)', alignItems:'center', transition:'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  >
                    <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)', fontWeight:600 }}>{p.recruiting_rank || i+1}</span>
                    <div>
                      <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)' }}>{p.name}</div>
                      <Stars n={p.recruiting_stars} />
                    </div>
                    <PosTag pos={p.position} />
                    <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{p.recruiting_class || (p.nfl_team ? 'NFL' : '—')}</span>
                    <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.college || p.nfl_team || '—'}</span>
                    <div style={{ textAlign:'right' }}>
                      {(isMyPick || isCommish) && draft.status === 'active' ? (
                        <button onClick={() => makePick(p)} disabled={picking}
                          style={{ padding:'0.3rem 0.875rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'0.8125rem', fontWeight:700, cursor: picking ? 'not-allowed':'pointer', fontFamily:'var(--font-body)', opacity: picking ? 0.6:1 }}>
                          Draft
                        </button>
                      ) : (
                        <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                          {draft.status !== 'active' ? '—' : 'Not your pick'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── ROSTERS ── */}
            {activeTab === 'rosters' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'1rem' }}>
                {teams.map(team => {
                  const drafted = teamPicks(team.roster_id);
                  const futurePicks = picks.filter(p => p.current_roster_id === team.roster_id && !p.is_picked);
                  return (
                    <div key={team.roster_id} style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'1rem' }}>
                      <div style={{ fontSize:'0.875rem', fontWeight:700, color:'var(--text-primary)', marginBottom:'0.75rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        {team.owner_name}
                        {team.roster_id === myRosterId && <span style={{ fontSize:'0.7rem', padding:'1px 6px', borderRadius:99, background:'rgba(200,151,58,0.15)', color:'var(--gold-400)' }}>you</span>}
                      </div>
                      {drafted.length === 0
                        ? <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', fontStyle:'italic' }}>No picks yet</div>
                        : drafted.map((pk, i) => (
                            <div key={pk.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'0.3rem 0', borderBottom:'0.5px solid var(--border-subtle)' }}>
                              <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', width:20 }}>{i+1}.</span>
                              <PosTag pos={pk.player_position} small />
                              <span style={{ fontSize:'0.8125rem', color:'var(--text-primary)', flex:1 }}>{pk.player_name}</span>
                              {pk.player_class && <span style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>{pk.player_class}</span>}
                            </div>
                          ))
                      }
                      {futurePicks.length > 0 && (
                        <div style={{ marginTop:'0.5rem', paddingTop:'0.5rem', borderTop:'0.5px solid var(--border-subtle)' }}>
                          <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Upcoming picks</div>
                          {futurePicks.slice(0, 5).map(p => (
                            <div key={p.id} style={{ fontSize:'0.75rem', color:'var(--text-muted)', padding:'1px 0' }}>
                              #{p.overall} · R{p.round}{p.is_traded ? ' 🔄':''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── TRADES ── */}
            {activeTab === 'trades' && (
              <div>
                {/* Pending offers for me */}
                {trades.filter(t => t.status === 'pending' && t.receiving_roster_id === myRosterId).map(trade => (
                  <div key={trade.id} style={{ background:'rgba(239,68,68,0.06)', border:'0.5px solid rgba(239,68,68,0.3)', borderRadius:'var(--radius-lg)', padding:'1rem', marginBottom:'0.875rem' }}>
                    <div style={{ fontSize:'0.875rem', fontWeight:600, color:'#F87171', marginBottom:'0.75rem' }}>
                      🔄 Trade offer from {trade.proposing_name}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'0.875rem' }}>
                      <div>
                        <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:4 }}>They give you:</div>
                        {trade.receiving_gives?.map((a, i) => (
                          <div key={i} style={{ fontSize:'0.8125rem', color:'var(--text-primary)', padding:'2px 0' }}>
                            {a.type === 'pick' ? `🎟 ${a.pick_label}` : `${a.player_name}`}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginBottom:4 }}>You give them:</div>
                        {trade.proposing_gives?.map((a, i) => (
                          <div key={i} style={{ fontSize:'0.8125rem', color:'var(--text-primary)', padding:'2px 0' }}>
                            {a.type === 'pick' ? `🎟 ${a.pick_label}` : `${a.player_name}`}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => respondTrade(trade.id, 'accept')} style={{ padding:'0.5rem 1rem', borderRadius:'var(--radius-md)', background:'rgba(34,197,94,0.15)', color:'#4ADE80', border:'0.5px solid rgba(34,197,94,0.3)', fontSize:'0.875rem', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)' }}>Accept</button>
                      <button onClick={() => respondTrade(trade.id, 'reject')} style={{ padding:'0.5rem 1rem', borderRadius:'var(--radius-md)', background:'transparent', color:'#F87171', border:'0.5px solid rgba(239,68,68,0.3)', fontSize:'0.875rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>Reject</button>
                    </div>
                  </div>
                ))}

                {/* Trade history */}
                <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)', marginBottom:'0.75rem' }}>Trade history</div>
                {trades.filter(t => t.status !== 'pending').length === 0 && (
                  <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>No completed trades yet.</div>
                )}
                {trades.filter(t => t.status !== 'pending').map(trade => (
                  <div key={trade.id} style={{ padding:'0.875rem', background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-md)', marginBottom:6, display:'flex', gap:'1rem', alignItems:'center' }}>
                    <span style={{ fontSize:'0.75rem', padding:'2px 8px', borderRadius:99, background: trade.status==='accepted' ? 'rgba(34,197,94,0.15)':'rgba(156,163,175,0.15)', color: trade.status==='accepted' ? '#4ADE80':'#9CA3AF' }}>
                      {trade.status}
                    </span>
                    <span style={{ fontSize:'0.875rem', color:'var(--text-secondary)' }}>
                      {trade.proposing_name} ⇄ {trade.receiving_name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── DRAFT COMPLETE: RECAP ── */}
            {isComplete && recap && activeTab === 'board' && (
              <div style={{ marginTop:'1.5rem', background:'rgba(200,151,58,0.06)', border:'0.5px solid var(--border-gold)', borderRadius:'var(--radius-lg)', padding:'1.5rem' }}>
                <h2 style={{ fontSize:'1.125rem', fontWeight:700, color:'var(--gold-400)', marginBottom:'1rem' }}>
                  ⚖ Draft Recap — Input these changes into Sleeper
                </h2>
                {teams.map(team => {
                  const drafted = recap.draftedByTeam[team.roster_id] || [];
                  if (!drafted.length) return null;
                  return (
                    <div key={team.roster_id} style={{ marginBottom:'1rem' }}>
                      <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>{team.owner_name}</div>
                      {drafted.map((pk, i) => (
                        <div key={pk.id} style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', padding:'2px 0', paddingLeft:12 }}>
                          → Add {pk.player_name} ({pk.player_position}{pk.player_class ? `, ${pk.player_class}` : ''})
                        </div>
                      ))}
                    </div>
                  );
                })}
                {recap.accepted.length > 0 && (
                  <>
                    <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)', marginBottom:6, marginTop:'1rem' }}>Draft Trades to process in Sleeper:</div>
                    {recap.accepted.map(trade => (
                      <div key={trade.id} style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', padding:'3px 0 3px 12px' }}>
                        → {trade.proposing_name} ⇄ {trade.receiving_name}: {[...trade.proposing_gives, ...trade.receiving_gives].map(a => a.pick_label || a.player_name).join(', ')}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem', position:'sticky', top:140 }}>

            {/* My team */}
            {myRosterId && (
              <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-gold)', borderRadius:'var(--radius-lg)', padding:'1rem' }}>
                <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--gold-400)', marginBottom:'0.75rem', textTransform:'uppercase', letterSpacing:'0.06em' }}>My roster</div>
                {myPicks.length === 0
                  ? <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', fontStyle:'italic' }}>No picks yet</div>
                  : myPicks.map((pk, i) => (
                      <div key={pk.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'0.3rem 0', borderBottom:'0.5px solid var(--border-subtle)' }}>
                        <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', width:18 }}>{i+1}.</span>
                        <PosTag pos={pk.player_position} small />
                        <span style={{ fontSize:'0.8125rem', color:'var(--text-primary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pk.player_name}</span>
                      </div>
                    ))
                }
                {myFuturePicks.length > 0 && (
                  <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'0.5px solid var(--border-subtle)' }}>
                    <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>My picks</div>
                    {myFuturePicks.map(p => (
                      <div key={p.id} style={{ fontSize:'0.75rem', color: p.overall === draft.current_pick ? 'var(--gold-400)' : 'var(--text-muted)', padding:'1px 0', fontWeight: p.overall === draft.current_pick ? 700:400 }}>
                        #{p.overall} · R{p.round}{p.is_traded ? ' 🔄':''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Propose trade */}
            {myRosterId && draft.status === 'active' && (
              <button onClick={() => setShowTrade(true)} style={{ width:'100%', padding:'0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.875rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                🔄 Propose trade
              </button>
            )}

            {/* Commissioner: pool settings */}
            {isCommish && draft.status === 'setup' && (
              <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'1rem' }}>
                <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--text-primary)', marginBottom:'0.75rem' }}>Pool settings</div>
                <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, fontSize:'0.875rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                  <input type="checkbox" checked={draft.include_devy} onChange={e => controlDraft('update_settings', { include_devy: e.target.checked })} />
                  Devy prospects
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.875rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                  <input type="checkbox" checked={draft.include_nfl_players} onChange={e => controlDraft('update_settings', { include_nfl_players: e.target.checked })} />
                  Include unrostered NFL players
                </label>
              </div>
            )}

            {/* Recent picks ticker */}
            <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'1rem' }}>
              <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--text-muted)', marginBottom:'0.75rem', textTransform:'uppercase', letterSpacing:'0.06em' }}>Recent picks</div>
              {picks.filter(p => p.is_picked).slice().reverse().slice(0, 8).map(pk => (
                <div key={pk.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'0.375rem 0', borderBottom:'0.5px solid var(--border-subtle)' }}>
                  <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', flexShrink:0, width:24 }}>#{pk.overall}</span>
                  <PosTag pos={pk.player_position} small />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.8125rem', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pk.player_name}</div>
                    <div style={{ fontSize:'0.65rem', color:'var(--text-muted)' }}>{pk.owner_name?.split(' ')[0]}</div>
                  </div>
                </div>
              ))}
              {picks.filter(p => p.is_picked).length === 0 && (
                <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', fontStyle:'italic' }}>No picks yet</div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── TRADE MODAL ── */}
      {showTradeModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-default)', borderRadius:'var(--radius-lg)', padding:'1.5rem', maxWidth:560, width:'100%', maxHeight:'80vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h2 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text-primary)' }}>Propose trade</h2>
              <button onClick={() => setShowTrade(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.25rem' }}>✕</button>
            </div>

            {/* Select opponent */}
            <div style={{ marginBottom:'1rem' }}>
              <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginBottom:6 }}>Trade with:</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {teams.filter(t => t.roster_id !== myRosterId).map(t => (
                  <button key={t.roster_id} onClick={() => setTradeTarget(t)}
                    style={{ padding:'0.375rem 0.875rem', borderRadius:'var(--radius-md)', border: tradeTarget?.roster_id===t.roster_id ? '0.5px solid var(--gold-500)':'0.5px solid var(--border-default)', background: tradeTarget?.roster_id===t.roster_id ? 'rgba(200,151,58,0.1)':'transparent', color: tradeTarget?.roster_id===t.roster_id ? 'var(--gold-400)':'var(--text-secondary)', fontSize:'0.8125rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                    {t.owner_name}
                  </button>
                ))}
              </div>
            </div>

            {tradeTarget && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
                  {/* I give */}
                  <div>
                    <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>You give:</div>
                    {myFuturePicks.map(pk => (
                      <label key={pk.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 0', fontSize:'0.8125rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                        <input type="checkbox" onChange={e => {
                          const asset = { type:'pick', pick_overall: pk.overall, pick_label: `Pick #${pk.overall} (R${pk.round})` };
                          setTradeGive(prev => e.target.checked ? [...prev, asset] : prev.filter(a => a.pick_overall !== pk.overall));
                        }} />
                        🎟 Pick #{pk.overall} · R{pk.round}
                      </label>
                    ))}
                    {myPicks.map(pk => (
                      <label key={pk.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 0', fontSize:'0.8125rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                        <input type="checkbox" onChange={e => {
                          const asset = { type:'player', player_id: pk.player_id, player_name: pk.player_name };
                          setTradeGive(prev => e.target.checked ? [...prev, asset] : prev.filter(a => a.player_id !== pk.player_id));
                        }} />
                        {pk.player_name}
                      </label>
                    ))}
                  </div>

                  {/* They give */}
                  <div>
                    <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--text-primary)', marginBottom:6 }}>They give:</div>
                    {picks.filter(p => p.current_roster_id === tradeTarget.roster_id && !p.is_picked).map(pk => (
                      <label key={pk.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 0', fontSize:'0.8125rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                        <input type="checkbox" onChange={e => {
                          const asset = { type:'pick', pick_overall: pk.overall, pick_label: `Pick #${pk.overall} (R${pk.round})` };
                          setTradeReceive(prev => e.target.checked ? [...prev, asset] : prev.filter(a => a.pick_overall !== pk.overall));
                        }} />
                        🎟 Pick #{pk.overall} · R{pk.round}
                      </label>
                    ))}
                    {picks.filter(p => p.current_roster_id === tradeTarget.roster_id && p.is_picked).map(pk => (
                      <label key={pk.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 0', fontSize:'0.8125rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                        <input type="checkbox" onChange={e => {
                          const asset = { type:'player', player_id: pk.player_id, player_name: pk.player_name };
                          setTradeReceive(prev => e.target.checked ? [...prev, asset] : prev.filter(a => a.player_id !== pk.player_id));
                        }} />
                        {pk.player_name}
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={proposeTrade} style={{ width:'100%', padding:'0.75rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'0.9375rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                  Send trade offer
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
