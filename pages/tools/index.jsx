import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';

const TOOLS = [
  {
    href:    '/tools/player-lookup',
    icon:    '🎯',
    label:   'Player → Leagues',
    tagline: 'Find every lineup that needs an update',
    desc:    'Search any player and see every Sleeper league where they\'re on your roster — with slot, matchup, and scoring format. Know exactly which lineups to fix before kickoff.',
    tier:    'free',
    status:  'live',
  },
  {
    href:    '/tools/lineup-optimizer',
    icon:    '📊',
    label:   'Lineup optimizer',
    tagline: 'Start the right player in every league',
    desc:    'Connects to your Sleeper leagues and recommends your optimal lineup for each one, calibrated to that league\'s specific scoring settings. One decision engine for all your leagues.',
    tier:    'elite',
    status:  'live',
  },
  {
    href:    '/tools/trade-calculator',
    icon:    '⚖',
    label:   'Trade calculator',
    tagline: 'Know who\'s winning before you accept',
    desc:    'Dynasty trade values calibrated to your league format. Import an opponent\'s public rankings to see how they value the players in your trade offer.',
    tier:    'free',
    status:  'live',
  },
  {
    href:    '/tools/league-analyzer',
    icon:    '🔍',
    label:   'League analyzer',
    tagline: 'Full intel on every team in your league',
    desc:    'Connect your Sleeper league and get roster grades, power rankings, dynasty window analysis, schedule strength, and trade targets — for every team.',
    tier:    'elite',
    status:  'live',
  },
  {
    href:    '/tools/draft-analyzer',
    icon:    '🏛',
    label:   'Draft analyzer',
    tagline: 'Your optimal strategy before the draft starts',
    desc:    'Analyzes your league settings, format, leaguemate draft history, and your personal player rankings to recommend a round-by-round strategy before your draft starts.',
    tier:    'elite',
    status:  'live',
  },
  {
    href:    '/tools/draft-queue',
    icon:    '📋',
    label:   'Draft queue builder',
    tagline: 'Build your queue, copy to Sleeper',
    desc:    'Build a prioritized draft queue from your personal rankings. Auto-updates as players are drafted. One-click copy in Sleeper-compatible format.',
    tier:    'free',
    status:  'live',
  },
];

export default function ToolsHub() {
  return (
    <>
      <Head>
        <title>Judge Tools — DynastyJudge</title>
        <meta name="description" content="Dynasty fantasy football tools connected to your Sleeper leagues. Player lookup, lineup optimizer, trade calculator, league analyzer, and draft tools." />
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
            <h1 className="display-md" style={{ marginBottom: 8 }}>Your dynasty analytics department.</h1>
            <p className="body-md" style={{ color: 'var(--text-secondary)', maxWidth: 520 }}>
              Every tool connects to your actual Sleeper leagues — not generic consensus data. Connect your username and every recommendation is calibrated to your specific leagues, scoring settings, and leaguemates.
            </p>
          </div>
        </div>

        {/* Connect Sleeper CTA */}
        <div style={{ background: 'rgba(200,151,58,0.06)', borderBottom: '0.5px solid var(--border-gold)' }}>
          <div className="container" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.125rem' }}>🔗</span>
              <div>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>Connect your Sleeper account</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginLeft: 8 }}>to unlock personalized recommendations across all tools</span>
              </div>
            </div>
            <Link href="/tools/connect-sleeper" className="btn btn-primary btn-sm">
              Connect Sleeper →
            </Link>
          </div>
        </div>

        {/* Tools grid */}
        <div className="container" style={{ paddingTop: '2rem' }}>
          <div className="grid-3">
            {TOOLS.map(t => (
              <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>{t.icon}</span>
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                      background: t.tier === 'free' ? 'rgba(34,197,94,0.15)' : 'rgba(200,151,58,0.15)',
                      color:      t.tier === 'free' ? '#4ADE80'              : 'var(--gold-300)',
                    }}>
                      {t.tier === 'free' ? 'FREE' : 'ELITE'}
                    </span>
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{t.label}</h2>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--gold-400)', marginBottom: 8 }}>{t.tagline}</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{t.desc}</p>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '0.5px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-gold)' }}>
                    Open tool →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </main>
    </>
  );
}
