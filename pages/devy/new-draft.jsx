import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Nav from '../../components/Nav';
import { useSleeper } from '../../hooks/useSleeper';
import { supabase } from '../../lib/supabase';

export default function DevyDraftSetup() {
  const router = useRouter();
  const { sleeperId, isConnected, loading: sleeperLoading } = useSleeper();

  const [leagues, setLeagues]         = useState([]);
  const [selected, setSelected]       = useState(null);
  const [draftOrder, setDraftOrder]   = useState([]);
  const [draftName, setDraftName]     = useState('');
  const [rounds, setRounds]           = useState(5);
  const [secsPerPick, setSecs]        = useState(90);
  const [snakeDraft, setSnake]        = useState(true);
  const [inclNFL, setInclNFL]         = useState(false);
  const [inclDevy, setInclDevy]       = useState(true);
  const [devyClasses, setClasses]     = useState(['2027', '2028']);
  const [myRosterId, setMyRosterId]   = useState(null);
  const [commishName, setCommishName] = useState('');
  const [loading, setLoading]         = useState(false);
  const [creating, setCreating]       = useState(false);
  const [step, setStep]               = useState(1);
  const [dragIdx, setDragIdx]         = useState(null);
  const [editingTeam, setEditingTeam] = useState(null); // roster_id being edited
  const [numTeams, setNumTeams]       = useState(12);

  const CLASSES = ['2025','2026','2027','2028','2029'];

  // Load leagues
  useEffect(() => {
    if (!sleeperId) return;
    fetch(`https://api.sleeper.app/v1/user/${sleeperId}/leagues/nfl/2026`)
      .then(r => r.json()).then(d => setLeagues(d || []));
  }, [sleeperId]);

  // Load profile for commish name
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data } = await supabase.from('profiles').select('display_name, username').eq('id', session.user.id).single();
      setCommishName(data?.display_name || data?.username || 'Commissioner');
    });
  }, []);

  // ── Import Sleeper league ────────────────────────────────────────────────────
  async function selectLeague(l) {
    setSelected(l);
    setDraftName(`${l.name} — Devy Draft`);
    setLoading(true);

    // Detect format for display
    const hasSF = l.roster_positions?.includes('SUPER_FLEX');

    // Fetch rosters, users, AND the previous season's league to get last year's record
    const [rostersRes, usersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${l.league_id}/rosters`).then(r => r.json()),
      fetch(`https://api.sleeper.app/v1/league/${l.league_id}/users`).then(r => r.json()),
    ]);

    const umap = Object.fromEntries(usersRes.map(u => [u.user_id, u]));

    // Try to get last season's records from the previous_league_id
    let prevRecords = {}; // roster_id -> { wins, losses, rank }
    if (l.previous_league_id) {
      try {
        const [prevRosters, prevWinners] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${l.previous_league_id}/rosters`).then(r => r.json()),
          fetch(`https://api.sleeper.app/v1/league/${l.previous_league_id}/winners_bracket`).then(r => r.json()).catch(() => []),
        ]);

        // Sort prev rosters by wins desc to determine finish
        const sorted = [...(prevRosters || [])].sort((a, b) => {
          const aw = a.settings?.wins || 0;
          const bw = b.settings?.wins || 0;
          const afpts = a.settings?.fpts || 0;
          const bfpts = b.settings?.fpts || 0;
          return bw - aw || bfpts - afpts;
        });

        // Match prev rosters to current rosters by owner_id
        sorted.forEach((pr, idx) => {
          // Find the current roster with same owner
          const currRoster = rostersRes.find(r => r.owner_id === pr.owner_id);
          if (currRoster) {
            prevRecords[currRoster.roster_id] = {
              wins:   pr.settings?.wins   || 0,
              losses: pr.settings?.losses || 0,
              rank:   idx + 1, // 1 = best record
            };
          }
        });
      } catch (e) {
        console.warn('Could not load previous season records:', e);
      }
    }

    // Fall back to current season records if no prev league
    if (!Object.keys(prevRecords).length) {
      rostersRes.forEach(r => {
        prevRecords[r.roster_id] = {
          wins:   r.settings?.wins   || 0,
          losses: r.settings?.losses || 0,
          rank:   0,
        };
      });
    }

    // Find my roster and set commish
    const mine = rostersRes.find(r => r.owner_id === sleeperId);
    if (mine) setMyRosterId(mine.roster_id);

    // Sort: worst record picks first (highest pick number = worst finish)
    const ordered = [...rostersRes].sort((a, b) => {
      const aRec = prevRecords[a.roster_id] || { wins:0, losses:0, rank:99 };
      const bRec = prevRecords[b.roster_id] || { wins:0, losses:0, rank:99 };
      // Worst record (fewest wins) picks first
      if (aRec.wins !== bRec.wins) return aRec.wins - bRec.wins;
      return bRec.losses - aRec.losses;
    });

    setDraftOrder(ordered.map(r => ({
      roster_id:        r.roster_id,
      owner_id:         r.owner_id,
      owner_name:       umap[r.owner_id]?.display_name || `Team ${r.roster_id}`,
      team_name:        umap[r.owner_id]?.metadata?.team_name || umap[r.owner_id]?.display_name || `Team ${r.roster_id}`,
      wins:             prevRecords[r.roster_id]?.wins   ?? 0,
      losses:           prevRecords[r.roster_id]?.losses ?? 0,
      last_year_rank:   prevRecords[r.roster_id]?.rank   ?? 0,
      sleeper_user_id:  r.owner_id,
      is_me:            r.owner_id === sleeperId,
    })));

    setLoading(false);
    setStep(2);
  }

  // ── Standalone draft ─────────────────────────────────────────────────────────
  async function createStandalone() {
    const { data: { session } } = await supabase.auth.getSession();
    const myName = commishName || 'Commissioner';

    // Build teams — commissioner is automatically team 1
    const teams = Array.from({ length: numTeams }, (_, i) => ({
      roster_id:  i + 1,
      owner_name: i === 0 ? myName : `Team ${i + 1}`,
      team_name:  i === 0 ? myName : `Team ${i + 1}`,
      wins: 0, losses: 0,
      is_me: i === 0,
      is_commish: i === 0,
    }));

    setMyRosterId(1);
    setSelected(null);
    setDraftName('Devy Draft');
    setDraftOrder(teams);
    setStep(2);
  }

  // ── Draft order UI helpers ────────────────────────────────────────────────────
  function onDragStart(idx) { setDragIdx(idx); }
  function onDragOver(e, idx) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setDraftOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      setDragIdx(idx);
      return next;
    });
  }
  function onDragEnd() { setDragIdx(null); }

  function resetToStandings() {
    setDraftOrder(prev => [...prev].sort((a, b) => {
      if (a.wins !== b.wins) return a.wins - b.wins;
      return b.losses - a.losses;
    }));
  }

  function updateTeamName(rosterId, name) {
    setDraftOrder(prev => prev.map(t => t.roster_id === rosterId ? { ...t, owner_name: name, team_name: name } : t));
  }

  // ── Create draft ─────────────────────────────────────────────────────────────
  async function createDraft() {
    if (!draftName || !draftOrder.length) return;
    setCreating(true);

    const { data: { session } } = await supabase.auth.getSession();
    const { data: profile } = session
      ? await supabase.from('profiles').select('id, display_name, username').eq('id', session.user.id).single()
      : { data: null };

    // For standalone drafts, make sure commissioner slot is marked
    const finalOrder = draftOrder.map((t, i) => ({
      ...t,
      is_commish: t.is_me || (i === 0 && !selected),
    }));

    const res = await fetch('/api/devy/create-draft', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:                draftName,
        sleeper_league_id:   selected?.league_id || null,
        sleeper_league_name: selected?.name || null,
        rounds,
        seconds_per_pick:    secsPerPick,
        snake_draft:         snakeDraft,
        include_nfl_players: inclNFL,
        include_devy:        inclDevy,
        devy_classes:        devyClasses,
        draft_order:         finalOrder,
        num_teams:           finalOrder.length,
        commissioner_id:     session?.user?.id || null,
        commissioner_name:   profile?.display_name || profile?.username || null,
      }),
    });

    const data = await res.json();
    if (data.success) {
      const mySlot = finalOrder.find(t => t.is_me || t.is_commish);
      if (mySlot) {
        localStorage.setItem(`devy_draft_${data.draft_id}_roster_id`, String(mySlot.roster_id));
      }
      router.push(`/devy/draft/${data.draft_id}`);
    } else {
      alert(`Failed to create draft: ${data.error}`);
      setCreating(false);
    }
  }

  return (
    <>
      <Head><title>New Devy Draft — DynastyJudge</title></Head>
      <Nav />

      <main style={{ minHeight:'100vh', paddingBottom:'4rem' }}>
        <div style={{ borderBottom:'0.5px solid var(--border-subtle)', padding:'2.5rem 0 2rem' }}>
          <div className="container">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div className="gold-bar" />
              <span className="label text-gold">DevyJudge</span>
            </div>
            <h1 className="display-md" style={{ marginBottom:8 }}>New Devy Draft</h1>
            <p className="body-md" style={{ color:'var(--text-secondary)', maxWidth:520 }}>
              Import a Sleeper league or create a standalone draft. Draft order is set from last season's final standings.
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop:'1.5rem', maxWidth:860 }}>

          {/* Step indicator */}
          <div style={{ display:'flex', gap:0, marginBottom:'1.5rem', borderBottom:'0.5px solid var(--border-subtle)', paddingBottom:'1rem' }}>
            {[[1,'Import league'],[2,'Draft order'],[3,'Settings & launch']].map(([n,label]) => (
              <div key={n} onClick={() => n < step && setStep(n)}
                style={{ display:'flex', alignItems:'center', gap:6, marginRight:24, cursor: n<step?'pointer':'default' }}>
                <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, background: step>=n?'var(--gold-500)':'var(--bg-secondary)', color: step>=n?'var(--charcoal-900)':'var(--text-muted)', border:`0.5px solid ${step>=n?'var(--gold-500)':'var(--border-default)'}` }}>
                  {step>n?'✓':n}
                </div>
                <span style={{ fontSize:'0.875rem', color: step>=n?'var(--text-primary)':'var(--text-muted)', fontWeight: step===n?600:400 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {/* Standalone */}
              <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'1.25rem', marginBottom:'1rem' }}>
                <h2 style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--text-primary)', marginBottom:'0.75rem' }}>Standalone draft</h2>
                <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginBottom:'0.875rem' }}>
                  Create a draft without connecting a Sleeper league. You'll be assigned as commissioner and team 1. Invite others by username or link.
                </p>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  <div>
                    <label style={{ fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:3 }}>Number of teams</label>
                    <select value={numTeams} onChange={e => setNumTeams(parseInt(e.target.value))}
                      style={{ padding:'0.5rem 0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.875rem', fontFamily:'var(--font-body)' }}>
                      {[8,10,12,14,16].map(n => <option key={n} value={n}>{n} teams</option>)}
                    </select>
                  </div>
                  <button onClick={createStandalone}
                    style={{ marginTop:18, padding:'0.625rem 1.25rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'0.875rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                    + Create standalone draft
                  </button>
                </div>
              </div>

              {/* Import from Sleeper */}
              {!isConnected && !sleeperLoading && (
                <div style={{ padding:'1.5rem', background:'rgba(200,151,58,0.06)', border:'0.5px solid var(--border-gold)', borderRadius:'var(--radius-lg)', textAlign:'center' }}>
                  <p style={{ color:'var(--text-secondary)', marginBottom:'1rem' }}>Connect Sleeper to import a league with rosters and standings.</p>
                  <a href="/tools/connect-sleeper" className="btn btn-primary">Connect Sleeper</a>
                </div>
              )}
              {isConnected && leagues.length > 0 && (
                <div>
                  <h2 style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--text-primary)', marginBottom:'0.75rem' }}>Import from Sleeper</h2>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {leagues.map(l => (
                      <button key={l.league_id} onClick={() => !loading && selectLeague(l)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.25rem', background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', cursor: loading?'not-allowed':'pointer', fontFamily:'var(--font-body)', textAlign:'left', transition:'border-color .12s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-gold)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-subtle)'}
                      >
                        <div>
                          <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>{l.name}</div>
                          <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>
                            {l.total_rosters} teams ·{' '}
                            {l.roster_positions?.includes('SUPER_FLEX') ? 'SuperFlex' : '1QB'} ·{' '}
                            {l.previous_league_id ? 'Last season record available' : 'New league'}
                          </div>
                        </div>
                        <span style={{ color:'var(--gold-400)', fontSize:'0.875rem' }}>{loading ? 'Loading...' : 'Import →'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── STEP 2: Draft order ── */}
          {step === 2 && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem', flexWrap:'wrap', gap:8 }}>
                <div>
                  <h2 style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>Draft order</h2>
                  <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>
                    Drag to reorder · Pick 1 is at the top · {selected ? 'Sorted by last season record (worst first)' : 'You are auto-assigned to pick 1'}
                  </p>
                </div>
                {selected && (
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={resetToStandings} style={{ padding:'0.375rem 0.875rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.8125rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                      ↺ Reset from standings
                    </button>
                    <button onClick={() => setDraftOrder(p => [...p].reverse())} style={{ padding:'0.375rem 0.875rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.8125rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                      ⇅ Reverse
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:'1.5rem' }}>
                {draftOrder.map((team, idx) => (
                  <div key={team.roster_id}
                    draggable={editingTeam !== team.roster_id}
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={e => onDragOver(e, idx)}
                    onDragEnd={onDragEnd}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'0.75rem 1rem', background: team.is_me ? 'rgba(200,151,58,0.06)' : 'var(--bg-secondary)', border:`0.5px solid ${team.is_me ? 'var(--border-gold)' : 'var(--border-subtle)'}`, borderRadius:'var(--radius-md)', cursor: editingTeam === team.roster_id ? 'default' : 'grab', opacity: dragIdx === idx ? 0.5 : 1 }}>

                    <span style={{ color:'var(--text-muted)', userSelect:'none' }}>⠿</span>

                    {/* Pick number badge */}
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--bg-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8125rem', fontWeight:700, color: idx===0?'var(--gold-400)':'var(--text-muted)', flexShrink:0 }}>
                      {idx + 1}
                    </div>

                    {/* Team name — editable */}
                    <div style={{ flex:1, minWidth:0 }}>
                      {editingTeam === team.roster_id ? (
                        <input
                          autoFocus
                          type="text"
                          value={team.owner_name}
                          onChange={e => updateTeamName(team.roster_id, e.target.value)}
                          onBlur={() => setEditingTeam(null)}
                          onKeyDown={e => e.key === 'Enter' && setEditingTeam(null)}
                          style={{ fontSize:'0.9375rem', fontWeight:500, color:'var(--text-primary)', background:'transparent', border:'none', borderBottom:'1px solid var(--gold-400)', outline:'none', fontFamily:'var(--font-body)', width:'100%' }}
                        />
                      ) : (
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:'0.9375rem', fontWeight:500, color:'var(--text-primary)' }}>{team.owner_name}</span>
                          {team.is_me && <span style={{ fontSize:'0.7rem', padding:'1px 6px', borderRadius:99, background:'rgba(200,151,58,0.15)', color:'var(--gold-400)' }}>you</span>}
                          {team.is_commish && <span style={{ fontSize:'0.7rem', padding:'1px 6px', borderRadius:99, background:'rgba(251,191,36,0.15)', color:'#FBBF24' }}>⚖ commish</span>}
                        </div>
                      )}
                      {selected && team.wins !== undefined && (
                        <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:1 }}>
                          Last season: {team.wins}–{team.losses}
                          {team.last_year_rank ? ` · Finished #${team.last_year_rank}` : ''}
                        </div>
                      )}
                    </div>

                    {/* Edit name button (for standalone, all teams editable; for Sleeper, show hint) */}
                    {editingTeam !== team.roster_id && (
                      <button onClick={() => setEditingTeam(team.roster_id)}
                        style={{ padding:'2px 8px', borderRadius:4, border:'0.5px solid var(--border-subtle)', background:'transparent', color:'var(--text-muted)', fontSize:'0.75rem', cursor:'pointer', fontFamily:'var(--font-body)', flexShrink:0 }}>
                        ✏
                      </button>
                    )}

                    {idx === 0 && <span style={{ fontSize:'0.75rem', color:'var(--gold-400)', fontWeight:600, flexShrink:0 }}>1st pick</span>}
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setStep(1)} style={{ padding:'0.75rem 1.5rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.9375rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>← Back</button>
                <button onClick={() => setStep(3)} style={{ padding:'0.75rem 1.5rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'0.9375rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>Next: Settings →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Settings ── */}
          {step === 3 && (
            <div>
              <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'1.5rem', marginBottom:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
                <h2 style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)' }}>Draft settings</h2>

                <div>
                  <label style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)', display:'block', marginBottom:6 }}>Draft name</label>
                  <input type="text" value={draftName} onChange={e => setDraftName(e.target.value)}
                    style={{ width:'100%', padding:'0.625rem 0.875rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.9375rem', fontFamily:'var(--font-body)', outline:'none' }} />
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>
                  <div>
                    <label style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)', display:'block', marginBottom:6 }}>Rounds</label>
                    <input type="number" value={rounds} min={1} max={20} onChange={e => setRounds(parseInt(e.target.value))}
                      style={{ width:'100%', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.875rem', fontFamily:'var(--font-body)', outline:'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)', display:'block', marginBottom:6 }}>Seconds per pick</label>
                    <input type="number" value={secsPerPick} min={30} max={600} step={30} onChange={e => setSecs(parseInt(e.target.value))}
                      style={{ width:'100%', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.875rem', fontFamily:'var(--font-body)', outline:'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)', display:'block', marginBottom:6 }}>Format</label>
                    <select value={snakeDraft?'snake':'linear'} onChange={e => setSnake(e.target.value==='snake')}
                      style={{ width:'100%', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.875rem', fontFamily:'var(--font-body)' }}>
                      <option value="snake">Snake draft</option>
                      <option value="linear">Linear draft</option>
                    </select>
                  </div>
                </div>

                {/* Pool */}
                <div>
                  <label style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)', display:'block', marginBottom:'0.75rem' }}>Draft pool</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.875rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                      <input type="checkbox" checked={inclDevy} onChange={e => setInclDevy(e.target.checked)} style={{ width:16, height:16 }} />
                      Devy prospects (high school / college)
                    </label>
                    {inclDevy && (
                      <div style={{ paddingLeft:24 }}>
                        <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginBottom:6 }}>Graduating classes:</div>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                          {CLASSES.map(c => (
                            <label key={c} style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.875rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                              <input type="checkbox" checked={devyClasses.includes(c)}
                                onChange={e => setClasses(prev => e.target.checked ? [...prev,c] : prev.filter(x=>x!==c))} />
                              {c}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.875rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                      <input type="checkbox" checked={inclNFL} onChange={e => setInclNFL(e.target.checked)} style={{ width:16, height:16 }} />
                      Include unrostered NFL players
                    </label>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div style={{ padding:'1rem 1.25rem', background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-md)', marginBottom:'1.5rem', fontSize:'0.875rem', color:'var(--text-secondary)', lineHeight:1.8 }}>
                <strong style={{ color:'var(--text-primary)' }}>Summary:</strong><br/>
                {draftOrder.length} teams · {rounds} rounds · {rounds * draftOrder.length} total picks<br/>
                {snakeDraft ? 'Snake' : 'Linear'} · {secsPerPick}s per pick<br/>
                Pool: {[inclDevy && `Devy (${devyClasses.join(', ')})`, inclNFL && 'Unrostered NFL'].filter(Boolean).join(' + ') || 'None selected'}
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setStep(2)} style={{ padding:'0.75rem 1.5rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.9375rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>← Back</button>
                <button onClick={createDraft} disabled={creating || !draftName} style={{ flex:1, padding:'0.875rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'1rem', fontWeight:700, cursor: creating||!draftName?'not-allowed':'pointer', fontFamily:'var(--font-body)', opacity: creating?0.7:1 }}>
                  {creating ? 'Creating draft room...' : '🏛 Create draft room →'}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
