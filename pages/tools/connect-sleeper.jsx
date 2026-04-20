import Head from 'next/head';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { supabase } from '../../lib/supabase';

export default function ConnectSleeper() {
  const [username, setUsername] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [connected, setConnected] = useState(null); // sleeper user data
  const [session, setSession]   = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        // Check if already connected
        supabase.from('profiles').select('username, display_name').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data?.username) setUsername(data.username);
          });
      }
    });
  }, []);

  async function handleConnect(e) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');

    try {
      // Verify the username exists on Sleeper
      const res = await fetch(`https://api.sleeper.app/v1/user/${username.trim()}`);
      if (!res.ok) throw new Error('Sleeper username not found. Check the spelling.');
      const sleeperUser = await res.json();
      if (!sleeperUser?.user_id) throw new Error('Could not find that Sleeper account.');

      // Fetch their leagues
      const leaguesRes = await fetch(`https://api.sleeper.app/v1/user/${sleeperUser.user_id}/leagues/nfl/2026`);
      const leagues    = await leaguesRes.json();

      setConnected({ ...sleeperUser, leagues: leagues || [] });

      // Save to profile if logged in
      if (session) {
        await supabase.from('profiles').update({
          username:     sleeperUser.username,
          display_name: sleeperUser.display_name || sleeperUser.username,
        }).eq('id', session.user.id);

        // Store sleeper_user_id in localStorage for tools to use
        localStorage.setItem('sleeper_user_id', sleeperUser.user_id);
        localStorage.setItem('sleeper_username', sleeperUser.username);
      } else {
        localStorage.setItem('sleeper_user_id', sleeperUser.user_id);
        localStorage.setItem('sleeper_username', sleeperUser.username);
      }

    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <>
      <Head>
        <title>Connect Sleeper — DynastyJudge</title>
      </Head>
      <Nav />

      <main style={{ minHeight: '100vh', paddingBottom: '4rem' }}>
        <div style={{ borderBottom: '0.5px solid var(--border-subtle)', padding: '2.5rem 0 2rem' }}>
          <div className="container-sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div className="gold-bar" />
              <span className="label text-gold">Sleeper integration</span>
            </div>
            <h1 className="display-md" style={{ marginBottom: 8 }}>Connect your Sleeper account</h1>
            <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
              Enter your Sleeper username to give the Judge tools access to your leagues, rosters, and matchups. Read-only — we never write to your Sleeper account.
            </p>
          </div>
        </div>

        <div className="container-sm" style={{ paddingTop: '2rem' }}>

          {!connected ? (
            <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '2rem' }}>
              <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Sleeper username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="your_sleeper_username"
                    required
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '1rem', fontFamily: 'var(--font-body)', outline: 'none' }}
                  />
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 6 }}>
                    Find your username in the Sleeper app under your profile. Not your display name — your @username.
                  </p>
                </div>

                {error && (
                  <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: '0.875rem' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !username.trim()}
                  className="btn btn-primary"
                  style={{ opacity: loading || !username.trim() ? 0.7 : 1 }}>
                  {loading ? 'Connecting...' : 'Connect Sleeper account'}
                </button>
              </form>

              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '0.5px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>What gets connected</h3>
                {[
                  'All your active Sleeper leagues for 2026',
                  'Your roster in each league',
                  'League scoring settings and formats',
                  'Current week matchups',
                  'Draft history (for the draft analyzer)',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    <span style={{ color: '#4ADE80', flexShrink: 0 }}>✓</span>
                    {item}
                  </div>
                ))}
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.875rem' }}>
                  The Sleeper API is read-only. We cannot make any changes to your leagues, rosters, or lineups.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* Success state */}
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem' }}>✓</span>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#4ADE80', marginBottom: 2 }}>
                    Connected as @{connected.username}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {connected.leagues.length} active leagues found for 2026
                  </div>
                </div>
              </div>

              {/* League list */}
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>
                Your leagues
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem' }}>
                {connected.leagues.slice(0, 10).map(league => (
                  <div key={league.league_id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1rem', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>{league.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {league.total_rosters} teams · {league.settings?.type === 2 ? 'Dynasty' : 'Redraft'} · {league.scoring_settings?.rec === 1 ? 'PPR' : league.scoring_settings?.rec === 0.5 ? 'Half PPR' : 'Standard'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(34,197,94,0.15)', color: '#4ADE80' }}>Connected</span>
                  </div>
                ))}
              </div>

              {/* Tools CTA */}
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>
                Start using your tools
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { href: '/tools/player-lookup',    icon: '🎯', label: 'Player → Leagues', desc: 'Find lineups that need updating' },
                  { href: '/tools/lineup-optimizer', icon: '📊', label: 'Lineup optimizer', desc: 'Best lineup in every league' },
                  { href: '/tools/league-analyzer',  icon: '🔍', label: 'League analyzer', desc: 'Full roster intel and grades' },
                  { href: '/tools/draft-analyzer',   icon: '🏛', label: 'Draft analyzer', desc: 'Pre-draft strategy report' },
                ].map(t => (
                  <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
                    <div className="card" style={{ padding: '1rem', display: 'flex', gap: 10 }}>
                      <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{t.icon}</span>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.desc}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
