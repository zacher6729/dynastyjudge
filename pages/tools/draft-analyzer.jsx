import Head from 'next/head';
import { useState, useEffect } from 'react';
import Nav from '../../components/Nav';
import Link from 'next/link';
import { useSleeper } from '../../hooks/useSleeper';

const POS_COLORS = {
  QB: { bg: 'rgba(239,68,68,0.15)',  text: '#FCA5A5' },
  RB: { bg: 'rgba(34,197,94,0.15)', text: '#86EFAC' },
  WR: { bg: 'rgba(59,130,246,0.15)',text: '#93C5FD' },
  TE: { bg: 'rgba(251,191,36,0.15)',text: '#FDE68A' },
};

// ── Analyze leaguemate tendencies from draft history ──────────────────────────
function analyzeTendencies(picks, allManagers) {
  const profiles = {};
  allManagers.forEach(m => {
    profiles[m.roster_id] = {
      display_name: m.display_name,
      pos_counts: { QB: 0, RB: 0, WR: 0, TE: 0 },
      qb_rounds: [],
      total_picks: 0,
      rb_heavy: false,
      early_qb: false,
    };
  });

  picks.forEach(pick => {
    const p = profiles[pick.roster_id];
    if (!p) return;
    const pos = pick.metadata?.position;
    if (pos && profiles[pick.roster_id].pos_counts[pos] !== undefined) {
      p.pos_counts[pos]++;
    }
    if (pos === 'QB') p.qb_rounds.push(pick.round);
    p.total_picks++;
  });

  Object.values(profiles).forEach(p => {
    if (!p.total_picks) return;
    p.rb_heavy   = (p.pos_counts.RB / p.total_picks) > 0.35;
    p.early_qb   = p.qb_rounds.some(r => r <= 5);
    p.avg_qb_rnd = p.qb_rounds.length
      ? (p.qb_rounds.reduce((a,b) => a+b, 0) / p.qb_rounds.length).toFixed(1)
      : null;
    p.top_pos    = Object.entries(p.pos_counts).sort(([,a],[,b]) => b-a)[0]?.[0];
  });

  return profiles;
}

// ── Generate strategy recommendations ────────────────────────────────────────
function generateStrategy(league, tendencies, myRosterId, format) {
  const isSF     = format === 'sf';
  const isTEPrem = format === 'teprem';
  const myPick   = Object.values(tendencies).find(t => t.my_roster);
  const numTeams = league.total_rosters || 12;

  const earlyQBCount = Object.values(tendencies).filter(t => t.early_qb).length;
  const rbHeavyCount = Object.values(tendencies).filter(t => t.rb_heavy).length;

  const rounds = [];

  if (isSF) {
    rounds.push({
      rounds: '1–2',
      priority: 'Elite QB or WR1/RB1',
      note: earlyQBCount >= 4
        ? `${earlyQBCount} leaguemates historically take QBs early — grab your QB by round 2 or you may be shut out.`
        : 'SF leagues reward early QB investment. Target top-5 QB if available, otherwise elite WR/RB.',
      targets: ['Lamar Jackson', 'Josh Allen', 'Jalen Hurts', 'CeeDee Lamb', 'Justin Jefferson'],
      avoid: [],
    });
    rounds.push({
      rounds: '3–5',
      priority: 'Second QB + WR/RB depth',
      note: 'Lock in your QB2 here. Two strong QBs in SF is table stakes for contention.',
      targets: [],
      avoid: [],
    });
  } else {
    rounds.push({
      rounds: '1–2',
      priority: 'Elite WR or RB',
      note: rbHeavyCount >= 4
        ? `${rbHeavyCount} leaguemates are RB-heavy drafters — WRs may fall slightly. Capitalize on WR value in rounds 1–2.`
        : 'Target elite dynasty assets with age and upside. Best player available at your pick.',
      targets: ['CeeDee Lamb', 'Justin Jefferson', 'Christian McCaffrey', 'Ja\'Marr Chase', 'Bijan Robinson'],
      avoid: ['Aging RBs 28+', 'Volume-dependent WR2s'],
    });
    rounds.push({
      rounds: '3–5',
      priority: 'QB + positional needs',
      note: earlyQBCount < 3
        ? 'Most leaguemates historically wait on QB — you can too. Grab value at RB/WR first.'
        : `${earlyQBCount} leaguemates take QB early. Consider grabbing yours by round 4.`,
      targets: [],
      avoid: [],
    });
  }

  rounds.push({
    rounds: '6–9',
    priority: isTEPrem ? 'Premium TE + upside RBs' : 'TE + upside WRs',
    note: isTEPrem
      ? 'TE Premium leagues make elite TEs worth top-5 overall value. If you missed early, grab the best available here.'
      : 'Tier 2 WRs and handcuffs to volume RBs. Target age-curve winners.',
    targets: [],
    avoid: [],
  });

  rounds.push({
    rounds: '10–15',
    priority: 'Lottery tickets & devy stashes',
    note: 'Target young players with path to starting roles. Age 22–24 with upside. Draft for the future.',
    targets: [],
    avoid: ['30+ year old starters with no backup value'],
  });

  return {
    summary: isSF
      ? `SuperFlex league with ${numTeams} teams. QB scarcity is real — ${earlyQBCount} of your leaguemates historically draft QBs in the first 5 rounds. Your strategy should prioritize getting two QBs before round 6.`
      : `Standard 1QB league with ${numTeams} teams. ${rbHeavyCount} leaguemates are RB-heavy drafters historically. WR value may be available longer than ADP suggests.`,
    rounds,
    watchout: Object.entries(tendencies)
      .filter(([, t]) => t.early_qb || t.rb_heavy)
      .map(([, t]) => ({
        name: t.display_name,
        note: [t.early_qb && 'takes QB early', t.rb_heavy && 'RB-heavy drafter'].filter(Boolean).join(', '),
      })),
  };
}

export default function DraftAnalyzer() {
  const { sleeperId, sleeperUsername, isConnected, loading: sleeperLoading } = useSleeper();

  const [leagues, setLeagues]       = useState([]);
  const [selected, setSelected]     = useState(null);
  const [format, setFormat]         = useState('1qb');
  const [loading, setLoading]       = useState(false);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [analysis, setAnalysis]     = useState(null);
  const [tendencies, setTendencies] = useState(null);
  const [managers, setManagers]     = useState([]);
  const [step, setStep]             = useState(1); // 1=select league, 2=confirm format, 3=results

  // Load leagues on connect
  useEffect(() => {
    if (!sleeperId) return;
    setLoadingLeagues(true);
    fetch(`https://api.sleeper.app/v1/user/${sleeperId}/leagues/nfl/2026`)
      .then(r => r.json())
      .then(data => { setLeagues(data || []); setLoadingLeagues(false); })
      .catch(() => setLoadingLeagues(false));
  }, [sleeperId]);

  async function analyzeLeague(league) {
    setSelected(league);
    // Auto-detect format from league settings
    const positions = league.roster_positions || [];
    const hasSF     = positions.includes('SUPER_FLEX');
    const hasTEPrem = (league.scoring_settings?.bonus_rec_te || 0) >= 0.5;
    setFormat(hasSF ? 'sf' : hasTEPrem ? 'teprem' : '1qb');
    setStep(2);
  }

  async function runAnalysis() {
    if (!selected || !sleeperId) return;
    setLoading(true);
    setAnalysis(null);
    setTendencies(null);

    try {
      // Get rosters + users
      const [rostersRes, usersRes, draftsRes] = await Promise.all([
        fetch(`https://api.sleeper.app/v1/league/${selected.league_id}/rosters`),
        fetch(`https://api.sleeper.app/v1/league/${selected.league_id}/users`),
        fetch(`https://api.sleeper.app/v1/league/${selected.league_id}/drafts`),
      ]);

      const rosters = await rostersRes.json();
      const users   = await usersRes.json();
      const drafts  = await draftsRes.json();
      const userMap = Object.fromEntries(users.map(u => [u.user_id, u]));

      // Build manager list
      const mgrs = rosters.map(r => ({
        roster_id:    r.roster_id,
        owner_id:     r.owner_id,
        display_name: userMap[r.owner_id]?.display_name || 'Unknown',
        is_me:        r.owner_id === sleeperId,
        my_roster:    r.owner_id === sleeperId,
        wins:         r.settings?.wins   || 0,
        losses:       r.settings?.losses || 0,
      }));
      setManagers(mgrs);

      // Get draft history for tendency analysis
      let allPicks = [];
      for (const draft of (drafts || []).slice(0, 3)) { // last 3 drafts
        try {
          const picksRes = await fetch(`https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`);
          const picks    = await picksRes.json();
          allPicks = allPicks.concat(picks || []);
        } catch {}
      }

      const tend = analyzeTendencies(allPicks, mgrs);
      setTendencies(tend);

      const strat = generateStrategy(selected, tend, sleeperId, format);
      setAnalysis(strat);
      setStep(3);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  const FORMATS = [
    { id: '1qb',    label: '1QB',        desc: 'One starting quarterback' },
    { id: 'sf',     label: 'SuperFlex',  desc: 'Two QBs / flex QB spot'  },
    { id: 'teprem', label: 'TE Premium', desc: 'Bonus points for TE'     },
  ];

  return (
    <>
      <Head>
        <title>Draft Analyzer — DynastyJudge</title>
        <meta name="description" content="Pre-draft strategy report based on your league settings, format, and leaguemate draft history." />
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
            <h1 className="display-md" style={{ marginBottom: 8 }}>Draft analyzer</h1>
            <p className="body-md" style={{ color: 'var(--text-secondary)', maxWidth: 560 }}>
              Analyzes your league's format, scoring, and your leaguemates' historical draft tendencies to generate a round-by-round strategy before your draft starts.
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: '1.5rem', maxWidth: 860 }}>

          {/* Not connected */}
          {!sleeperLoading && !isConnected && (
            <div style={{ padding: '1rem 1.25rem', background: 'rgba(200,151,58,0.08)', border: '0.5px solid var(--border-gold)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Connect Sleeper to analyze your actual leagues and leaguemates.</span>
              <Link href="/tools/connect-sleeper" className="btn btn-primary btn-sm">Connect Sleeper</Link>
            </div>
          )}

          {/* Step indicator */}
          {isConnected && (
            <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', borderBottom: '0.5px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              {[
                [1, 'Select league'],
                [2, 'Confirm format'],
                [3, 'Your brief'],
              ].map(([n, label]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24, cursor: n < step ? 'pointer' : 'default' }}
                  onClick={() => n < step && setStep(n)}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, background: step >= n ? 'var(--gold-500)' : 'var(--bg-secondary)', color: step >= n ? 'var(--charcoal-900)' : 'var(--text-muted)', border: `0.5px solid ${step >= n ? 'var(--gold-500)' : 'var(--border-default)'}` }}>
                    {step > n ? '✓' : n}
                  </div>
                  <span style={{ fontSize: '0.875rem', color: step >= n ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: step === n ? 600 : 400 }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 1: Select league ── */}
          {isConnected && step === 1 && (
            <>
              {loadingLeagues && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading your leagues...</div>}
              {!loadingLeagues && leagues.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No active leagues found for 2026.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {leagues.map(l => (
                  <button
                    key={l.league_id}
                    onClick={() => analyzeLeague(l)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left', transition: 'border-color .12s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-gold)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                  >
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{l.name}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {l.total_rosters} teams ·{' '}
                        {l.roster_positions?.includes('SUPER_FLEX') ? 'SuperFlex' : '1QB'} ·{' '}
                        {l.scoring_settings?.rec === 1 ? 'PPR' : l.scoring_settings?.rec === 0.5 ? 'Half PPR' : 'Standard'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--gold-400)', flexShrink: 0 }}>Analyze →</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── STEP 2: Confirm format ── */}
          {isConnected && step === 2 && selected && (
            <div>
              <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{selected.name}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{selected.total_rosters} teams · Draft analyzer will pull the last 3 drafts from this league</div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>
                  Confirm scoring format
                  <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>Auto-detected from league settings — adjust if needed</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {FORMATS.map(f => (
                    <button key={f.id} onClick={() => setFormat(f.id)} style={{ padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', border: format === f.id ? '1.5px solid var(--gold-500)' : '0.5px solid var(--border-default)', background: format === f.id ? 'rgba(200,151,58,0.1)' : 'var(--bg-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left' }}>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: format === f.id ? 'var(--gold-400)' : 'var(--text-primary)' }}>{f.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={runAnalysis}
                disabled={loading}
                className="btn btn-primary"
                style={{ opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Analyzing leaguemates...' : '🏛 Generate my draft brief →'}
              </button>

              {loading && (
                <div style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  Pulling draft history from the last 3 seasons...<br/>
                  Profiling {selected.total_rosters} leaguemates...<br/>
                  Generating your strategy...
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Results ── */}
          {isConnected && step === 3 && analysis && (
            <div>
              {/* Summary */}
              <div style={{ background: 'rgba(200,151,58,0.06)', border: '0.5px solid var(--border-gold)', borderLeft: '4px solid var(--gold-500)', borderRadius: '0 var(--radius-lg) var(--radius-lg) 0', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: '1rem' }}>⚖</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gold-400)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>The Brief — {selected.name}</span>
                </div>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{analysis.summary}</p>
              </div>

              {/* Round strategy */}
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>Round-by-round strategy</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '2rem' }}>
                {analysis.rounds.map((r, i) => (
                  <div key={i} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', display: 'grid', gridTemplateColumns: '80px 1fr', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(200,151,58,0.1)', border: '0.5px solid var(--border-gold)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>Rounds</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gold-400)' }}>{r.rounds}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{r.priority}</div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: r.targets?.length ? 8 : 0 }}>{r.note}</p>
                      {r.targets?.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 4 }}>Targets:</span>
                          {r.targets.map(t => (
                            <span key={t} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(34,197,94,0.12)', color: '#4ADE80', border: '0.5px solid rgba(34,197,94,0.25)' }}>{t}</span>
                          ))}
                        </div>
                      )}
                      {r.avoid?.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 4 }}>Avoid:</span>
                          {r.avoid.map(a => (
                            <span key={a} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '0.5px solid rgba(239,68,68,0.2)' }}>{a}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Leaguemate watchlist */}
              {analysis.watchout?.length > 0 && (
                <>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>
                    Leaguemate tendencies to watch
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: '2rem' }}>
                    {analysis.watchout.map((w, i) => (
                      <div key={i} style={{ padding: '0.875rem 1rem', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠</span>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{w.name}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>{w.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Manager profiles */}
              {tendencies && (
                <>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>
                    All manager profiles
                  </h2>
                  <div style={{ border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px', padding: '0.5rem 1rem', background: 'var(--bg-secondary)', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      <span>Manager</span>
                      <span style={{ textAlign: 'center' }}>Top pos</span>
                      <span style={{ textAlign: 'center' }}>Avg QB rd</span>
                      <span style={{ textAlign: 'center' }}>RB heavy</span>
                      <span style={{ textAlign: 'center' }}>Early QB</span>
                    </div>
                    {managers.map(m => {
                      const t = tendencies[m.roster_id] || {};
                      const pos = POS_COLORS[t.top_pos] || { bg: 'rgba(156,163,175,0.15)', text: '#D1D5DB' };
                      return (
                        <div key={m.roster_id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px', padding: '0.75rem 1rem', borderTop: '0.5px solid var(--border-subtle)', alignItems: 'center', background: m.is_me ? 'rgba(200,151,58,0.04)' : 'transparent' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>{m.display_name}</span>
                            {m.is_me && <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 99, background: 'rgba(200,151,58,0.15)', color: 'var(--gold-400)' }}>you</span>}
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            {t.top_pos
                              ? <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, background: pos.bg, color: pos.text }}>{t.top_pos}</span>
                              : <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>—</span>}
                          </div>
                          <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {t.avg_qb_rnd || '—'}
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '0.8125rem', color: t.rb_heavy ? '#F87171' : 'var(--text-muted)' }}>
                              {t.rb_heavy ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '0.8125rem', color: t.early_qb ? '#FBBF24' : 'var(--text-muted)' }}>
                              {t.early_qb ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => { setStep(1); setAnalysis(null); setSelected(null); }} className="btn btn-ghost">
                  Analyze another league
                </button>
                <Link href="/tools/draft-queue" className="btn btn-primary">
                  Build draft queue from this brief →
                </Link>
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
