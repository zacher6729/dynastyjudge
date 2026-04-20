import Head from 'next/head';
import { useState, useEffect } from 'react';
import Nav from '../../components/Nav';
import Link from 'next/link';

const POS_COLORS = {
  QB: { bg: 'rgba(239,68,68,0.15)',  text: '#FCA5A5' },
  RB: { bg: 'rgba(34,197,94,0.15)', text: '#86EFAC' },
  WR: { bg: 'rgba(59,130,246,0.15)',text: '#93C5FD' },
  TE: { bg: 'rgba(251,191,36,0.15)',text: '#FDE68A' },
  K:  { bg: 'rgba(156,163,175,0.15)',text: '#D1D5DB' },
};

export default function PlayerLookup() {
  const [sleeperId, setSlId]       = useState('');
  const [search, setSearch]         = useState('');
  const [players, setPlayers]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const [selected, setSelected]     = useState(null);
  const [leagues, setLeagues]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(null);
  const [allPlayers, setAllPlayers] = useState(null); // Sleeper player map

  // Load Sleeper user ID and player map
  useEffect(() => {
    const id = localStorage.getItem('sleeper_user_id');
    if (id) setSlId(id);

    // Load player map from Sleeper (cached)
    const cached = sessionStorage.getItem('sleeper_players');
    if (cached) {
      setAllPlayers(JSON.parse(cached));
    } else {
      fetch('https://api.sleeper.app/v1/players/nfl')
        .then(r => r.json())
        .then(data => {
          sessionStorage.setItem('sleeper_players', JSON.stringify(data));
          setAllPlayers(data);
        });
    }
  }, []);

  // Search players from Sleeper player map
  function handleSearch(q) {
    setSearch(q);
    if (!allPlayers || q.length < 2) { setPlayers([]); return; }
    const lower = q.toLowerCase();
    const results = Object.entries(allPlayers)
      .filter(([, p]) => p.full_name?.toLowerCase().includes(lower) && p.active && ['QB','RB','WR','TE','K'].includes(p.position))
      .slice(0, 10)
      .map(([id, p]) => ({ id, ...p }));
    setPlayers(results);
  }

  async function selectPlayer(player) {
    setSelected(player);
    setSearch(player.full_name);
    setPlayers([]);
    if (!sleeperId) return;
    await findInLeagues(player.player_id || player.id, sleeperId);
  }

  async function findInLeagues(playerId, userId) {
    setLoading(true);
    setLeagues([]);
    try {
      // Get all leagues
      const leaguesRes = await fetch(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/2026`);
      const allLeagues = await leaguesRes.json();

      // Check each league's roster
      const results = await Promise.all(allLeagues.map(async league => {
        const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${league.league_id}/rosters`);
        const rosters = await rostersRes.json();
        const myRoster = rosters.find(r => r.owner_id === userId);
        if (!myRoster) return null;

        const isStarter = myRoster.starters?.includes(playerId);
        const isOnRoster = myRoster.players?.includes(playerId);
        if (!isOnRoster) return null;

        // Get matchup info
        let matchup = null;
        try {
          const matchupsRes = await fetch(`https://api.sleeper.app/v1/league/${league.league_id}/matchups/1`);
          const matchups = await matchupsRes.json();
          matchup = matchups.find(m => m.roster_id === myRoster.roster_id);
        } catch {}

        return {
          league_id:    league.league_id,
          league_name:  league.name,
          total_rosters: league.total_rosters,
          scoring:      league.scoring_settings?.rec === 1 ? 'PPR' : league.scoring_settings?.rec === 0.5 ? 'Half PPR' : 'Standard',
          roster_positions: league.roster_positions || [],
          is_starter:   isStarter,
          slot:         isStarter ? myRoster.starters.indexOf(playerId) : 'bench',
          starters:     myRoster.starters || [],
          wins:         myRoster.settings?.wins || 0,
          losses:       myRoster.settings?.losses || 0,
          matchup,
        };
      }));

      const found = results.filter(Boolean).sort((a, b) => (b.is_starter ? 1 : 0) - (a.is_starter ? 1 : 0));
      setLeagues(found);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function refreshLeague(leagueId, idx) {
    if (!selected || !sleeperId) return;
    setRefreshing(idx);
    try {
      const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
      const rosters = await rostersRes.json();
      const myRoster = rosters.find(r => r.owner_id === sleeperId);
      const playerId = selected.player_id || selected.id;
      const isStarter = myRoster?.starters?.includes(playerId);
      const isOnRoster = myRoster?.players?.includes(playerId);

      if (!isOnRoster) {
        // Player moved off roster — remove from list
        setLeagues(prev => prev.filter((_, i) => i !== idx));
      } else {
        setLeagues(prev => prev.map((l, i) => i === idx ? { ...l, is_starter: isStarter } : l));
      }
    } catch {}
    setRefreshing(null);
  }

  const starters = leagues.filter(l => l.is_starter);
  const bench    = leagues.filter(l => !l.is_starter);

  return (
    <>
      <Head>
        <title>Player → Leagues — DynastyJudge</title>
        <meta name="description" content="Find every Sleeper league where a player is on your roster. See if they're starting or on bench across all your leagues." />
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
              Search any player and instantly see every Sleeper league where they're on your roster — starter or bench — so you know exactly which lineups need updating.
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: '1.5rem' }}>

          {/* Sleeper connection warning */}
          {!sleeperId && (
            <div style={{ padding: '1rem 1.25rem', background: 'rgba(200,151,58,0.08)', border: '0.5px solid var(--border-gold)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Connect your Sleeper account to search across your actual leagues.</span>
              <Link href="/tools/connect-sleeper" className="btn btn-primary btn-sm">Connect Sleeper</Link>
            </div>
          )}

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 480, marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="Search player name..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              style={{ width: '100%', padding: '0.875rem 1.125rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', fontFamily: 'var(--font-body)', outline: 'none' }}
            />
            {players.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-md)', zIndex: 50, marginTop: 4, overflow: 'hidden' }}>
                {players.map(p => {
                  const pos = POS_COLORS[p.position] || { bg: 'rgba(156,163,175,0.15)', text: '#D1D5DB' };
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectPlayer(p)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '0.625rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '0.5px solid var(--border-subtle)', fontFamily: 'var(--font-body)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, background: pos.bg, color: pos.text }}>{p.position}</span>
                      <span style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', fontWeight: 500 }}>{p.full_name}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{p.team}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Scanning your leagues...
            </div>
          )}

          {/* Results */}
          {!loading && selected && leagues.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              {selected.full_name} is not on your roster in any 2026 league.
            </div>
          )}

          {!loading && leagues.length > 0 && (
            <>
              {/* Summary */}
              <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ padding: '0.875rem 1.25rem', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{leagues.length}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>total leagues</div>
                </div>
                <div style={{ padding: '0.875rem 1.25rem', background: starters.length > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)', border: `0.5px solid ${starters.length > 0 ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: starters.length > 0 ? '#F87171' : 'var(--text-primary)' }}>{starters.length}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>starting</div>
                </div>
                <div style={{ padding: '0.875rem 1.25rem', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{bench.length}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>on bench</div>
                </div>
              </div>

              {/* League table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 80px', padding: '0.5rem 1rem', borderBottom: '0.5px solid var(--border-default)', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <span>League</span>
                <span style={{ textAlign: 'center' }}>Status</span>
                <span style={{ textAlign: 'center' }}>Record</span>
                <span style={{ textAlign: 'center' }}>Format</span>
                <span style={{ textAlign: 'center' }}>Refresh</span>
              </div>

              {leagues.map((l, idx) => (
                <div
                  key={l.league_id}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 80px', padding: '0.875rem 1rem', borderBottom: '0.5px solid var(--border-subtle)', alignItems: 'center', transition: 'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>{l.league_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.total_rosters} teams</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
                      fontSize: '0.75rem', fontWeight: 600,
                      background: l.is_starter ? 'rgba(34,197,94,0.15)' : 'rgba(156,163,175,0.15)',
                      color:      l.is_starter ? '#4ADE80'              : '#9CA3AF',
                    }}>
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
                      style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
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
