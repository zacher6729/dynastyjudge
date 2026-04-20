import Head from 'next/head';
import { useState, useEffect } from 'react';
import Nav from '../../components/Nav';
import Link from 'next/link';

const POS_COLORS = {
  QB: { bg:'rgba(239,68,68,0.15)',  text:'#FCA5A5' },
  RB: { bg:'rgba(34,197,94,0.15)', text:'#86EFAC' },
  WR: { bg:'rgba(59,130,246,0.15)',text:'#93C5FD' },
  TE: { bg:'rgba(251,191,36,0.15)',text:'#FDE68A' },
};

// Grade a roster based on age curve + position value
function gradeRoster(players, allPlayers) {
  if (!players?.length) return { grade: '—', score: 0, window: 'unknown' };

  const POSITION_WEIGHTS = { QB: 1.2, WR: 1.0, RB: 0.9, TE: 0.8 };
  const PEAK_AGES = { QB: 29, WR: 26, RB: 25, TE: 27 };

  let totalScore = 0;
  let counted = 0;

  players.forEach(pid => {
    const p = allPlayers?.[pid];
    if (!p || !p.position || !POSITION_WEIGHTS[p.position]) return;
    const age = p.age || 26;
    const peak = PEAK_AGES[p.position] || 26;
    const ageDiff = Math.abs(age - peak);
    const ageScore = Math.max(0, 100 - ageDiff * 8);
    const posWeight = POSITION_WEIGHTS[p.position] || 1;
    totalScore += ageScore * posWeight;
    counted++;
  });

  const score = counted > 0 ? totalScore / counted : 0;

  let grade, window;
  if (score >= 80) { grade = 'A'; window = 'Contend now'; }
  else if (score >= 68) { grade = 'B'; window = 'Contender'; }
  else if (score >= 55) { grade = 'C'; window = 'Transitioning'; }
  else if (score >= 40) { grade = 'D'; window = 'Rebuilding'; }
  else { grade = 'F'; window = 'Full rebuild'; }

  return { grade, score: Math.round(score), window };
}

const GRADE_COLORS = {
  A: '#4ADE80', B: '#86EFAC', C: '#FBBF24', D: '#FB923C', F: '#F87171', '—': '#6B7280'
};

export default function LeagueAnalyzer() {
  const [sleeperId, setSlId]     = useState('');
  const [leagues, setLeagues]    = useState([]);
  const [selected, setSelected]  = useState(null);
  const [teams, setTeams]        = useState([]);
  const [loading, setLoading]    = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [allPlayers, setAllPlayers]    = useState(null);
  const [activeTab, setTab]      = useState('power'); // power | grades | windows

  useEffect(() => {
    const id = localStorage.getItem('sleeper_user_id');
    if (id) {
      setSlId(id);
      loadLeagues(id);
    }
    const cached = sessionStorage.getItem('sleeper_players');
    if (cached) setAllPlayers(JSON.parse(cached));
    else {
      fetch('https://api.sleeper.app/v1/players/nfl')
        .then(r => r.json())
        .then(d => { sessionStorage.setItem('sleeper_players', JSON.stringify(d)); setAllPlayers(d); });
    }
  }, []);

  async function loadLeagues(userId) {
    setLoading(true);
    try {
      const res  = await fetch(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/2026`);
      const data = await res.json();
      setLeagues(data || []);
    } catch {}
    setLoading(false);
  }

  async function analyzeLeague(league) {
    setSelected(league);
    setLoadingTeams(true);
    setTeams([]);
    try {
      const [rostersRes, usersRes] = await Promise.all([
        fetch(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`),
        fetch(`https://api.sleeper.app/v1/league/${league.league_id}/users`),
      ]);
      const rosters = await rostersRes.json();
      const users   = await usersRes.json();
      const userMap = Object.fromEntries(users.map(u => [u.user_id, u]));

      const analyzedTeams = rosters.map(r => {
        const user    = userMap[r.owner_id] || {};
        const grade   = gradeRoster(r.players, allPlayers);
        const wins    = r.settings?.wins    || 0;
        const losses  = r.settings?.losses  || 0;
        const ptsFor  = r.settings?.fpts    || 0;
        const isMe    = r.owner_id === sleeperId;
        return { ...r, display_name: user.display_name || 'Unknown', avatar: user.avatar, wins, losses, ptsFor, isMe, ...grade };
      });

      // Sort by score for power rankings
      analyzedTeams.sort((a, b) => b.score - a.score);
      setTeams(analyzedTeams.map((t, i) => ({ ...t, powerRank: i + 1 })));
    } catch (err) { console.error(err); }
    setLoadingTeams(false);
  }

  return (
    <>
      <Head>
        <title>League Analyzer — DynastyJudge</title>
      </Head>
      <Nav />

      <main style={{ minHeight: '100vh', paddingBottom: '4rem' }}>
        <div style={{ borderBottom: '0.5px solid var(--border-subtle)', padding: '2.5rem 0 2rem' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div className="gold-bar" />
              <span className="label text-gold">Judge tools</span>
            </div>
            <h1 className="display-md" style={{ marginBottom: 8 }}>League analyzer</h1>
            <p className="body-md" style={{ color: 'var(--text-secondary)', maxWidth: 520 }}>
              Select a league to get power rankings, roster grades, and dynasty window analysis for every team.
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: '1.5rem' }}>

          {!sleeperId && (
            <div style={{ padding: '1rem 1.25rem', background: 'rgba(200,151,58,0.08)', border: '0.5px solid var(--border-gold)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Connect your Sleeper account to analyze your leagues.</span>
              <Link href="/tools/connect-sleeper" className="btn btn-primary btn-sm">Connect Sleeper</Link>
            </div>
          )}

          {loading && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading your leagues...</div>}

          {/* League selector */}
          {!loading && leagues.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Select a league to analyze</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {leagues.map(l => (
                  <button
                    key={l.league_id}
                    onClick={() => analyzeLeague(l)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: selected?.league_id === l.league_id ? 'rgba(200,151,58,0.08)' : 'var(--bg-secondary)', border: `0.5px solid ${selected?.league_id === l.league_id ? 'var(--gold-500)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left' }}>
                    <div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>{l.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.total_rosters} teams · Dynasty</div>
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--gold-400)' }}>Analyze →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Analysis results */}
          {loadingTeams && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Analyzing {selected?.name}...</div>}

          {!loadingTeams && teams.length > 0 && (
            <>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                {selected?.name}
              </h2>

              {/* Tab selector */}
              <div style={{ display: 'flex', gap: 0, border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1.25rem', width: 'fit-content' }}>
                {[['power','Power rankings'],['grades','Roster grades'],['windows','Dynasty windows']].map(([id, label]) => (
                  <button key={id} onClick={() => setTab(id)} style={{ padding: '0.5rem 1.125rem', background: activeTab === id ? 'var(--bg-secondary)' : 'transparent', color: activeTab === id ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', borderRight: id !== 'windows' ? '0.5px solid var(--border-default)' : 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: activeTab === id ? 600 : 400 }}>{label}</button>
                ))}
              </div>

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 80px 80px', padding: '0.5rem 1rem', borderBottom: '0.5px solid var(--border-default)', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <span>#</span>
                <span>Team</span>
                <span style={{ textAlign: 'center' }}>{activeTab === 'power' ? 'Record' : 'Grade'}</span>
                <span style={{ textAlign: 'center' }}>{activeTab === 'windows' ? 'Window' : 'Score'}</span>
                <span style={{ textAlign: 'center' }}>Status</span>
              </div>

              {teams.map((t, i) => (
                <div
                  key={t.roster_id}
                  style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 80px 80px', padding: '0.875rem 1rem', borderBottom: '0.5px solid var(--border-subtle)', alignItems: 'center', background: t.isMe ? 'rgba(200,151,58,0.04)' : 'transparent', transition: 'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = t.isMe ? 'rgba(200,151,58,0.08)' : 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = t.isMe ? 'rgba(200,151,58,0.04)' : 'transparent'}
                >
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: i < 3 ? 'var(--gold-400)' : 'var(--text-muted)' }}>
                    {activeTab === 'power' ? t.powerRank : i + 1}
                  </span>
                  <div>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>{t.display_name}</span>
                    {t.isMe && <span style={{ fontSize: '0.7rem', marginLeft: 8, padding: '1px 6px', borderRadius: 99, background: 'rgba(200,151,58,0.15)', color: 'var(--gold-400)' }}>you</span>}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    {activeTab === 'power'
                      ? <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.wins}–{t.losses}</span>
                      : <span style={{ fontSize: '1.125rem', fontWeight: 700, color: GRADE_COLORS[t.grade] || '#6B7280' }}>{t.grade}</span>
                    }
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    {activeTab === 'windows'
                      ? <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.window}</span>
                      : <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.score}</span>
                    }
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(156,163,175,0.15)', color: '#9CA3AF' }}>
                      {t.window}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}

        </div>
      </main>
    </>
  );
}
