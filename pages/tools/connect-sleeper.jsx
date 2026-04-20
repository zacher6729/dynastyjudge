import Head from 'next/head';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { useSleeper } from '../../hooks/useSleeper';

export default function ConnectSleeper() {
  const {
    sleeperId, sleeperUsername, isConnected,
    connecting, error, connect, disconnect, loadLeagues, leagues, loadingLeagues,
  } = useSleeper();

  const [input, setInput]     = useState('');
  const [success, setSuccess] = useState(false);

  // Load leagues when connected
  useEffect(() => {
    if (isConnected && !leagues.length) loadLeagues();
  }, [isConnected]);

  // Pre-fill input with current username
  useEffect(() => {
    if (sleeperUsername) setInput(sleeperUsername);
  }, [sleeperUsername]);

  async function handleConnect(e) {
    e.preventDefault();
    const result = await connect(input);
    if (result.success) {
      setSuccess(true);
      loadLeagues();
    }
  }

  async function handleDisconnect() {
    await disconnect();
    setInput('');
    setSuccess(false);
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
              Enter your Sleeper username to power all the Judge tools with your real league data.
              Read-only — we never write to your Sleeper account.
            </p>
          </div>
        </div>

        <div className="container-sm" style={{ paddingTop: '2rem' }}>

          {/* Currently connected */}
          {isConnected && (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.25rem' }}>✓</span>
                <div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#4ADE80' }}>
                    Connected as @{sleeperUsername}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {loadingLeagues ? 'Loading leagues...' : `${leagues.length} active leagues for 2026`}
                  </div>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '0.5px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Disconnect
              </button>
            </div>
          )}

          {/* Connect / switch account form */}
          <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '2rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              {isConnected ? 'Switch to a different account' : 'Connect your Sleeper account'}
            </h2>

            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Sleeper username
                </label>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="your_sleeper_username"
                  required
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '1rem', fontFamily: 'var(--font-body)', outline: 'none' }}
                />
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  Find your @username in the Sleeper app under your profile — not your display name.
                </p>
              </div>

              {error && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.3)', color: '#F87171', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}

              {(success && !error) && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(34,197,94,0.1)', border: '0.5px solid rgba(34,197,94,0.3)', color: '#4ADE80', fontSize: '0.875rem' }}>
                  ✓ Connected! Your Sleeper account is saved to your profile.
                </div>
              )}

              <button
                type="submit"
                disabled={connecting || !input.trim()}
                className="btn btn-primary"
                style={{ opacity: connecting || !input.trim() ? 0.7 : 1 }}>
                {connecting ? 'Connecting...' : isConnected ? 'Switch account' : 'Connect Sleeper'}
              </button>
            </form>
          </div>

          {/* League list */}
          {isConnected && leagues.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>
                Your leagues ({leagues.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem' }}>
                {leagues.map(l => (
                  <div key={l.league_id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1rem', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>{l.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {l.total_rosters} teams ·{' '}
                        {l.scoring_settings?.rec === 1 ? 'PPR' : l.scoring_settings?.rec === 0.5 ? 'Half PPR' : 'Standard'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(34,197,94,0.15)', color: '#4ADE80' }}>✓ Connected</span>
                  </div>
                ))}
              </div>

              {/* Tool links */}
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>
                Ready to use
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { href: '/tools/player-lookup',    icon: '🎯', label: 'Player → Leagues'  },
                  { href: '/tools/league-analyzer',  icon: '🔍', label: 'League analyzer'   },
                  { href: '/tools/draft-queue',      icon: '📋', label: 'Draft queue'       },
                  { href: '/tools/lineup-optimizer', icon: '📊', label: 'Lineup optimizer'  },
                ].map(t => (
                  <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
                    <div className="card" style={{ padding: '1rem', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: '1.25rem' }}>{t.icon}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</span>
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
