import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Nav from '../../components/Nav';
import { useSleeper } from '../../hooks/useSleeper';

export default function DevyDraftSetup() {
  const router = useRouter();
  const { sleeperId, isConnected, loading: sleeperLoading } = useSleeper();

  const [leagues, setLeagues]           = useState([]);
  const [selected, setSelected]         = useState(null);
  const [rosters, setRosters]           = useState([]);
  const [userMap, setUserMap]           = useState({});
  const [draftOrder, setDraftOrder]     = useState([]);
  const [draftName, setDraftName]       = useState('');
  const [rounds, setRounds]             = useState(5);
  const [secsPerPick, setSecsPerPick]   = useState(90);
  const [snakeDraft, setSnake]          = useState(true);
  const [inclNFL, setInclNFL]           = useState(false);
  const [inclDevy, setInclDevy]         = useState(true);
  const [devyClasses, setDevyClasses]   = useState(['2027', '2028']);
  const [myRosterId, setMyRosterId]     = useState(null);
  const [loadingLeague, setLoadingLeague] = useState(false);
  const [creating, setCreating]         = useState(false);
  const [step, setStep]                 = useState(1);
  const [dragIdx, setDragIdx]           = useState(null);

  useEffect(() => {
    if (!sleeperId) return;
    fetch(`https://api.sleeper.app/v1/user/${sleeperId}/leagues/nfl/2026`)
      .then(r => r.json()).then(d => setLeagues(d || []));
  }, [sleeperId]);

  async function selectLeague(l) {
    setSelected(l);
    setDraftName(`${l.name} — Devy Draft`);
    setLoadingLeague(true);

    const [rostersRes, usersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${l.league_id}/rosters`).then(r => r.json()),
      fetch(`https://api.sleeper.app/v1/league/${l.league_id}/users`).then(r => r.json()),
    ]);

    const umap = Object.fromEntries(usersRes.map(u => [u.user_id, u]));
    setUserMap(umap);
    setRosters(rostersRes);

    // Find my roster
    const mine = rostersRes.find(r => r.owner_id === sleeperId);
    if (mine) setMyRosterId(mine.roster_id);

    // Build draft order from last season standings (worst record picks first = highest pick)
    const ordered = [...rostersRes].sort((a, b) => {
      const aWins = a.settings?.wins || 0;
      const bWins = b.settings?.wins || 0;
      const aLoss = a.settings?.losses || 0;
      const bLoss = b.settings?.losses || 0;
      // Worst record picks first (most losses, fewest wins)
      if (aWins !== bWins) return aWins - bWins;
      return bLoss - aLoss;
    });

    setDraftOrder(ordered.map(r => ({
      roster_id:      r.roster_id,
      owner_id:       r.owner_id,
      owner_name:     umap[r.owner_id]?.display_name || `Team ${r.roster_id}`,
      team_name:      umap[r.owner_id]?.metadata?.team_name || '',
      wins:           r.settings?.wins || 0,
      losses:         r.settings?.losses || 0,
      sleeper_user_id: r.owner_id,
    })));

    setLoadingLeague(false);
    setStep(2);
  }

  // Drag to reorder draft order
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

  function reverseOrder() {
    setDraftOrder(prev => [...prev].reverse());
  }

  async function createDraft() {
    if (!draftName || !draftOrder.length) return;
    setCreating(true);

    const res = await fetch('/api/devy/create-draft', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:               draftName,
        sleeper_league_id:  selected?.league_id,
        sleeper_league_name: selected?.name,
        rounds,
        seconds_per_pick:   secsPerPick,
        snake_draft:        snakeDraft,
        include_nfl_players: inclNFL,
        include_devy:       inclDevy,
        devy_classes:       devyClasses,
        draft_order:        draftOrder,
        num_teams:          draftOrder.length,
      }),
    });

    const data = await res.json();
    if (data.success) {
      // Store my roster ID so the draft room knows who I am
      localStorage.setItem(`devy_draft_${data.draft_id}_roster_id`, String(myRosterId));
      router.push(`/devy/draft/${data.draft_id}`);
    } else {
      alert(`Failed to create draft: ${data.error}`);
      setCreating(false);
    }
  }

  const CLASSES = ['2026','2027','2028','2029'];

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
              Import a Sleeper league, set your draft order based on last season's standings, configure your draft pool, and go live.
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

          {/* ── STEP 1: Select league ── */}
          {step === 1 && (
            <>
              {!isConnected && !sleeperLoading && (
                <div style={{ padding:'1.5rem', background:'rgba(200,151,58,0.08)', border:'0.5px solid var(--border-gold)', borderRadius:'var(--radius-lg)', textAlign:'center' }}>
                  <p style={{ color:'var(--text-secondary)', marginBottom:'1rem' }}>Connect your Sleeper account to import a league.</p>
                  <a href="/tools/connect-sleeper" className="btn btn-primary">Connect Sleeper</a>
                </div>
              )}
              {isConnected && (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ marginBottom:'0.5rem' }}>
                    <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginBottom:4 }}>Or create a standalone draft without a Sleeper league:</div>
                    <button onClick={() => { setSelected(null); setStep(2); setDraftOrder(Array.from({ length:12 }, (_, i) => ({ roster_id: i+1, owner_name:`Team ${i+1}`, wins:0, losses:0 }))); setDraftName('Devy Draft'); }}
                      style={{ padding:'0.625rem 1.25rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.875rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                      + Create standalone draft
                    </button>
                  </div>
                  {leagues.map(l => (
                    <button key={l.league_id} onClick={() => !loadingLeague && selectLeague(l)}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.25rem', background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', cursor: loadingLeague?'not-allowed':'pointer', fontFamily:'var(--font-body)', textAlign:'left', transition:'border-color .12s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-gold)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-subtle)'}
                    >
                      <div>
                        <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>{l.name}</div>
                        <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{l.total_rosters} teams</div>
                      </div>
                      <span style={{ color:'var(--gold-400)', fontSize:'0.875rem' }}>{loadingLeague ? 'Loading...' : 'Import →'}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── STEP 2: Draft order ── */}
          {step === 2 && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem', flexWrap:'wrap', gap:8 }}>
                <h2 style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)' }}>
                  Draft order
                  <span style={{ fontSize:'0.8125rem', fontWeight:400, color:'var(--text-muted)', marginLeft:8 }}>Drag to reorder — pick 1 is first</span>
                </h2>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={resetToStandings} style={{ padding:'0.375rem 0.875rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.8125rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                    ↺ Reset from standings
                  </button>
                  <button onClick={reverseOrder} style={{ padding:'0.375rem 0.875rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.8125rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                    ⇅ Reverse
                  </button>
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:'1.5rem' }}>
                {draftOrder.map((team, idx) => (
                  <div key={team.roster_id}
                    draggable onDragStart={() => onDragStart(idx)} onDragOver={e => onDragOver(e, idx)} onDragEnd={onDragEnd}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'0.75rem 1rem', background: team.roster_id === myRosterId ? 'rgba(200,151,58,0.06)' : 'var(--bg-secondary)', border: `0.5px solid ${team.roster_id === myRosterId ? 'var(--border-gold)' : 'var(--border-subtle)'}`, borderRadius:'var(--radius-md)', cursor:'grab', opacity: dragIdx === idx ? 0.5:1, transition:'background .1s' }}>
                    <span style={{ color:'var(--text-muted)', userSelect:'none', fontSize:'1rem' }}>⠿</span>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--bg-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8125rem', fontWeight:700, color: idx===0?'var(--gold-400)':'var(--text-muted)', flexShrink:0 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'0.9375rem', fontWeight:500, color:'var(--text-primary)' }}>
                        {team.owner_name}
                        {team.roster_id === myRosterId && <span style={{ fontSize:'0.7rem', marginLeft:8, padding:'1px 6px', borderRadius:99, background:'rgba(200,151,58,0.15)', color:'var(--gold-400)' }}>you</span>}
                      </div>
                      {(team.wins !== undefined) && (
                        <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{team.wins}–{team.losses} last season</div>
                      )}
                    </div>
                    {idx === 0 && <span style={{ fontSize:'0.75rem', color:'var(--gold-400)', fontWeight:600 }}>1st pick</span>}
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setStep(1)} style={{ padding:'0.75rem 1.5rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.9375rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>← Back</button>
                <button onClick={() => setStep(3)} style={{ padding:'0.75rem 1.5rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'0.9375rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>Next: Settings →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Settings & launch ── */}
          {step === 3 && (
            <div>
              <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'1.5rem', marginBottom:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
                <h2 style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)', marginBottom:0 }}>Draft settings</h2>

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
                    <input type="number" value={secsPerPick} min={30} max={600} step={30} onChange={e => setSecsPerPick(parseInt(e.target.value))}
                      style={{ width:'100%', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.875rem', fontFamily:'var(--font-body)', outline:'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)', display:'block', marginBottom:6 }}>Format</label>
                    <select value={snakeDraft ? 'snake':'linear'} onChange={e => setSnake(e.target.value === 'snake')}
                      style={{ width:'100%', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.875rem', fontFamily:'var(--font-body)' }}>
                      <option value="snake">Snake draft</option>
                      <option value="linear">Linear draft</option>
                    </select>
                  </div>
                </div>

                {/* Pool settings */}
                <div>
                  <label style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)', display:'block', marginBottom:'0.75rem' }}>Draft pool</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.875rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                      <input type="checkbox" checked={inclDevy} onChange={e => setInclDevy(e.target.checked)} style={{ width:16, height:16 }} />
                      Include devy prospects (high school / college)
                    </label>
                    {inclDevy && (
                      <div style={{ paddingLeft:24 }}>
                        <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginBottom:6 }}>Graduating classes to include:</div>
                        <div style={{ display:'flex', gap:8 }}>
                          {CLASSES.map(c => (
                            <label key={c} style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.875rem', color:'var(--text-secondary)', cursor:'pointer' }}>
                              <input type="checkbox" checked={devyClasses.includes(c)}
                                onChange={e => setDevyClasses(prev => e.target.checked ? [...prev, c] : prev.filter(x => x !== c))} />
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
                <strong style={{ color:'var(--text-primary)' }}>Draft summary:</strong><br/>
                {draftOrder.length} teams · {rounds} rounds · {rounds * draftOrder.length} total picks<br/>
                {snakeDraft ? 'Snake' : 'Linear'} draft · {secsPerPick}s per pick<br/>
                Pool: {[inclDevy && `Devy prospects (${devyClasses.join(', ')})`, inclNFL && 'Unrostered NFL players'].filter(Boolean).join(' + ') || 'None selected'}
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setStep(2)} style={{ padding:'0.75rem 1.5rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.9375rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>← Back</button>
                <button onClick={createDraft} disabled={creating || !draftName} style={{ flex:1, padding:'0.875rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'1rem', fontWeight:700, cursor: creating || !draftName ? 'not-allowed':'pointer', fontFamily:'var(--font-body)', opacity: creating ? 0.7:1 }}>
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
