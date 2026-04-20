import Head from 'next/head';
import { useState, useRef, useEffect } from 'react';
import Nav from '../../components/Nav';
import Link from 'next/link';
import { useSleeper, usePlayerSearch } from '../../hooks/useSleeper';

const POS_COLORS = {
  QB: { bg: 'rgba(239,68,68,0.15)',  text: '#FCA5A5' },
  RB: { bg: 'rgba(34,197,94,0.15)', text: '#86EFAC' },
  WR: { bg: 'rgba(59,130,246,0.15)',text: '#93C5FD' },
  TE: { bg: 'rgba(251,191,36,0.15)',text: '#FDE68A' },
  K:  { bg: 'rgba(156,163,175,0.15)',text: '#D1D5DB' },
};

export default function PlayerLookup() {
  const { sleeperId, sleeperUsername, isConnected } = useSleeper();
  const { results, loading: searching, search }     = usePlayerSearch({ limit: 12 });

  const [inputVal, setInputVal]   = useState('');
  const [selected, setSelected]   = useState(null);
  const [showDrop, setShowDrop]   = useState(false);
  const [leagues, setLeagues]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefresh]  = useState(null);
  const inputRef                  = useRef(null);
  const dropRef                   = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setShowDrop(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleInput(val) {
    setInputVal(val);
    search(val);
    setShowDrop(val.length >= 2);
    if (!val) { setSelected(null); setLeagues([]); }
  }

  async function selectPlayer(player) {
    setSelected(player);
    setInputVal(player.name);
    setShowDrop(false);
    setLeagues([]);
    if (sleeperId && player.sleeper_id) {
      await findInLeagues(player.sleeper_id, sleeperId);
    }
  }

  async function findInLeagues(sleeperPlayerId, userId) {
    setLoading(true);
    try {
      const leaguesRes = await fetch(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/2026`);
      const allLeagues = await leaguesRes.json();

      const results = await Promise.all(allLeagues.map(async league => {
        try {
          const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`);
          const rosters    = await rostersRes.json();
          const myRoster   = rosters.find(r => r.owner_id === userId);
          if (!myRoster) return null;

          const isOnRoster = myRoster.players?.includes(sleeperPlayerId);
          if (!isOnRoster) return null;

          const isStarter = myRoster.starters?.includes(sleeperPlayerId);

          return {
            league_id:     league.league_id,
            league_name:   league.name,
            total_rosters: league.total_rosters,
            scoring:       league.scoring_settings?.rec === 1 ? 'PPR'
                         : league.scoring_settings?.rec === 0.5 ? 'Half PPR' : 'Standard',
            is_starter:    isStarter,
            wins:          myRoster.settings?.wins   || 0,
            losses:        myRoster.settings?.losses || 0,
            roster_id:     myRoster.roster_id,
          };
        } catch { return null; }
      }));

      const found = results
        .filter(Boolean)
        .sort((a, b) => (b.is_starter ? 1 : 0) - (a.is_starter ? 1 : 0));

      setLeagues(found);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function refreshLeague(leagueId, idx) {
    if (!selected?.sleeper_id || !sleeperId) return;
    setRefresh(idx);
    try {
      const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
      const rosters    = await rostersRes.json();
      const myRoster   = rosters.find(r => r.owner_id === sleeperId);
      const isOnRoster = myRoster?.players?.includes(selected.sleeper_id);
      const isStarter  = myRoster?.starters?.includes(selected.sleeper_id);

      if (!isOnRoster) {
        setLeagues(prev => prev.filter((_, i) => i !== idx));
      } else {
        setLeagues(prev => prev.map((l, i) => i === idx ? { ...l, is_starter: isStarter } : l));
      }
    } catch {}
    setRefresh(null);
  }

  const starters = leagues.filter(l => l.is_starter);
  const bench    = leagues.filter(l => !l.is_starter);

  return (
    <>
      <Head>
        <title>Player → Leagues — DynastyJudge</title>
        <meta name="description" content="Find every Sleeper league where a player is on your roster." />
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
            <h1 className="display-md" style={{ marginBottom: 8 }}>Player → Leagues</h1>
            <p className="body-md" style={{ color: 'var(--text-secondary)', maxWidth: 520 }}>
              Search any player and see every league where they're on your roster — starter or bench.
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: '1.5rem' }}>

          {/* Sleeper connection warning */}
          {!isConnected && (
            <div style={{ padding: '1rem 1.25rem', background: 'rgba(200,151,58,0.08)', border: '0.5px solid var(--border-gold)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Connect your Sleeper account to search across your actual leagues.
              </span>
              <Link href="/tools/connect-sleeper" className="btn btn-primary btn-sm">Connect Sleeper</Link>
            </div>
          )}

          {isConnected && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#4ADE80' }}>●</span>
              Connected as @{sleeperUsername}
              <Link href="/tools/connect-sleeper" style={{ color: 'var(--text-muted)', marginLeft: 4 }}>Switch account</Link>
            </div>
          )}

          {/* Search input with autocomplete */}
          <div style={{ position: 'relative', maxWidth: 480, marginBottom: '1.5rem' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search player name..."
              value={inputVal}
              onChange={e => handleInput(e.target.value)}
              onFocus={() => inputVal.length >= 2 && setShowDrop(true)}
              style={{ width: '100%', padding: '0.875rem 1.125rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', fontFamily: 'var(--font-body)', outline: 'none' }}
            />

            {/* Loading indicator */}
            {searching && (
              <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Searching...
              </div>
            )}

            {/* Autocomplete dropdown */}
            {showDrop && results.length > 0 && (
              <div ref={dropRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-md)', zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                {results.map(p => {
                  const pos = POS_COLORS[p.position] || { bg: 'rgba(156,163,175,0.15)', text: '#D1D5DB' };
                  return (
                    <button
                      key={p.id}
                      onMouseDown={e => { e.preventDefault(); selectPlayer(p); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '0.625rem 1rem', background: 'none', border: 'none', borderBottom: '0.5px solid var(--border-subtle)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, background: pos.bg, color: pos.text, flexShrink: 0 }}>{p.position}</span>
                      <span style={{ flex: 1, fontSize: '0.9375rem', color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{p.nfl_team}</span>
                      {p.injury_status && <span style={{ fontSize: '0.7rem', color: '#F87171' }}>{p.injury_status}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* No results */}
            {showDrop && !searching && results.length === 0 && inputVal.length >= 2 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)', zIndex: 50 }}>
                No players found for "{inputVal}"
              </div>
            )}
          </div>

          {/* Loading leagues */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Scanning your {isConnected ? 'leagues' : 'Sleeper account'}...
            </div>
          )}

          {/* No results */}
          {!loading && selected && leagues.length === 0 && !loading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border-subtle)' }}>
              {isConnected
                ? `${selected.name} is not on your roster in any 2026 league.`
                : 'Connect your Sleeper account to see which leagues this player is in.'}
            </div>
          )}

          {/* Results */}
          {!loading && leagues.length > 0 && (
            <>
              {/* Summary pills */}
              <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ padding: '0.75rem 1.25rem', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{leagues.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>leagues</div>
                </div>
                <div style={{ padding: '0.75rem 1.25rem', background: starters.length ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)', border: `0.5px solid ${starters.length ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: starters.length ? '#F87171' : 'var(--text-primary)' }}>{starters.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>starting</div>
                </div>
                <div style={{ padding: '0.75rem 1.25rem', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{bench.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>bench</div>
                </div>
              </div>

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 80px 80px', padding: '0.5rem 1rem', borderBottom: '0.5px solid var(--border-default)', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <span>League</span>
                <span style={{ textAlign: 'center' }}>Status</span>
                <span style={{ textAlign: 'center' }}>Record</span>
                <span style={{ textAlign: 'center' }}>Format</span>
                <span style={{ textAlign: 'center' }}>Refresh</span>
              </div>

              {leagues.map((l, idx) => (
                <div
                  key={l.league_id}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 80px 80px', padding: '0.875rem 1rem', borderBottom: '0.5px solid var(--border-subtle)', alignItems: 'center', transition: 'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>{l.league_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.total_rosters} teams</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600, background: l.is_starter ? 'rgba(34,197,94,0.15)' : 'rgba(156,163,175,0.15)', color: l.is_starter ? '#4ADE80' : '#9CA3AF' }}>
                      {l.is_starter ? '▶ Starting' : '— Bench'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {l.wins}–{l.losses}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {l.scoring}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => refreshLeague(l.league_id, idx)}
                      disabled={refreshing === idx}
                      title="Refresh to check if lineup has been updated"
                      style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                      {refreshing === idx ? '...' : '↻'}
                    </button>
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
