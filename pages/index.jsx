import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';

// ─── Mock data (replace with real API calls later) ────────────────────────────
const LATEST_RULINGS = [
  {
    slug: 'ceedee-lamb-buy-low-window',
    verdict: 'BUY',
    player: 'CeeDee Lamb',
    pos: 'WR', team: 'DAL',
    headline: 'The buy window is closing — grab him before the market corrects',
    age: '25', dynasty_rank: 3,
    excerpt: 'Three weeks of low volume obscured what the film shows clearly. Lamb is the unquestioned alpha and his target share is about to normalize.',
    date: 'Apr 18, 2026',
  },
  {
    slug: 'najee-harris-hold-sell',
    verdict: 'SELL',
    player: 'Najee Harris',
    pos: 'RB', team: 'PIT',
    headline: 'The usage is there but the efficiency tells a different story',
    age: '27', dynasty_rank: 44,
    excerpt: 'Age curve and declining YPC make Najee a sell at current prices. His value won\'t be higher than it is right now.',
    date: 'Apr 17, 2026',
  },
  {
    slug: 'bijan-robinson-hold',
    verdict: 'HOLD',
    player: 'Bijan Robinson',
    pos: 'RB', team: 'ATL',
    headline: 'The dynasty ceiling is elite — patience required for the floor',
    age: '23', dynasty_rank: 8,
    excerpt: 'Concerns about the Falcons\' offense are valid but overstated. Bijan\'s talent profile and age make him untouchable in dynasty.',
    date: 'Apr 16, 2026',
  },
];

const DEVY_PROSPECTS = [
  { name: 'Jeremiah Smith', pos: 'WR', school: 'Ohio State', year: 'Fr', rating: '5★', devyRank: 1 },
  { name: 'Tavien St. Clair', pos: 'QB', school: 'Ohio State', year: 'Fr', rating: '5★', devyRank: 2 },
  { name: 'Dylan Raiola', pos: 'QB', school: 'Nebraska', year: 'So', rating: '5★', devyRank: 5 },
  { name: 'TJ Moore', pos: 'WR', school: 'Clemson', year: 'Fr', rating: '5★', devyRank: 3 },
];

const TOOLS = [
  { href: '/tools/trade-calculator', icon: '⚖', label: 'Trade calculator', desc: 'Dynasty values, calibrated to your league', free: true },
  { href: '/tools/rankings',         icon: '📋', label: 'Dynasty rankings', desc: '1QB · SF · TE Prem — updated weekly', free: true },
  { href: '/tools/startup-analyzer', icon: '🏛', label: 'Draft analyzer', desc: 'Strategy built around your leaguemates', free: false },
  { href: '/tools/league-analyzer',  icon: '🔍', label: 'League analyzer', desc: 'Connect Sleeper — full roster intel', free: false },
  { href: '/tools/lineup-optimizer', icon: '📊', label: 'Lineup optimizer', desc: 'Per-league start/sit recommendations', free: false },
  { href: '/tools/player-lookup',    icon: '🎯', label: 'Player → leagues', desc: 'See every lineup that needs an update', free: false },
];

const STATS = [
  { value: '53M', label: 'Fantasy players in the US' },
  { value: '#1', label: 'Dedicated devy intelligence platform' },
  { value: '500+', label: 'Prospect profiles tracked' },
  { value: '4M+', label: 'Active Sleeper leagues we can analyze' },
];

// ─── Verdict badge ────────────────────────────────────────────────────────────
function VerdictBadge({ verdict }) {
  const map = {
    BUY:   { cls: 'verdict-buy',  label: '▲ BUY'  },
    SELL:  { cls: 'verdict-sell', label: '▼ SELL' },
    HOLD:  { cls: 'verdict-hold', label: '◆ HOLD' },
    STASH: { cls: 'verdict-stash',label: '● STASH'},
  };
  const v = map[verdict] || map.HOLD;
  return <span className={`verdict ${v.cls}`}>{v.label}</span>;
}

// ─── Home page ────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <>
      <Head>
        <title>DynastyJudge — Dynasty Fantasy Football Intelligence</title>
        <meta name="description" content="The verdict on dynasty fantasy football. Rankings, trade analysis, devy prospects, and Sleeper-integrated tools for serious dynasty managers." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Nav />

      <main>
        {/* ── HERO ── */}
        <section style={{
          padding: '5rem 0 4rem',
          borderBottom: '0.5px solid var(--border-subtle)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Background grid texture */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.03,
            backgroundImage: 'repeating-linear-gradient(0deg, var(--gold-500) 0, var(--gold-500) 1px, transparent 1px, transparent 60px), repeating-linear-gradient(90deg, var(--gold-500) 0, var(--gold-500) 1px, transparent 1px, transparent 60px)',
            pointerEvents: 'none',
          }} />

          <div className="container" style={{ position: 'relative' }}>
            <div style={{ maxWidth: 760 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
                <div className="gold-bar" />
                <span className="label text-gold">Court is in session</span>
              </div>

              <h1 className="display-xl" style={{ marginBottom: '1.5rem' }}>
                The verdict on<br />
                <span style={{ color: 'var(--gold-400)' }}>dynasty football.</span>
              </h1>

              <p className="body-lg" style={{ color: 'var(--text-secondary)', maxWidth: 580, marginBottom: '2.5rem' }}>
                Rankings, trade rulings, devy intelligence, and Sleeper-integrated tools
                built for managers who treat dynasty like a real GM job.
              </p>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Link href="/subscribe" className="btn btn-primary">
                  Start Judge Elite — $12.99/mo
                </Link>
                <Link href="/rankings" className="btn btn-ghost">
                  Free rankings →
                </Link>
              </div>

              <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Free tier available. Cancel anytime. Includes DevyJudge access.
              </p>
            </div>
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <section style={{
          borderBottom: '0.5px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
        }}>
          <div className="container">
            <div className="grid-4" style={{ padding: '2rem 0' }}>
              {STATS.map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <div className="display-md text-gold">{s.value}</div>
                  <div className="body-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LATEST RULINGS ── */}
        <section style={{ padding: '4rem 0' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div className="gold-bar" />
                  <span className="label text-gold">Latest rulings</span>
                </div>
                <h2 className="display-md">The court has spoken.</h2>
              </div>
              <Link href="/analysis" className="btn btn-ghost btn-sm hide-mobile">
                All rulings →
              </Link>
            </div>

            <div className="grid-3">
              {LATEST_RULINGS.map(r => (
                <Link href={`/analysis/${r.slug}`} key={r.slug} style={{ textDecoration: 'none' }}>
                  <article className="card" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <VerdictBadge verdict={r.verdict} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.date}</span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span className={`pos pos-${r.pos.toLowerCase()}`}>{r.pos}</span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.team} · Age {r.age}</span>
                      </div>
                      <h3 className="heading-md" style={{ color: 'var(--text-primary)', marginBottom: 6 }}>
                        {r.player}
                      </h3>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {r.headline}
                      </p>
                      <p className="body-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        {r.excerpt}
                      </p>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '0.5px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-gold)' }}>
                      Read the ruling →
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── TOOLS GRID ── */}
        <section style={{ padding: '4rem 0', background: 'var(--bg-secondary)', borderTop: '0.5px solid var(--border-subtle)', borderBottom: '0.5px solid var(--border-subtle)' }}>
          <div className="container">
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div className="gold-bar" />
                <span className="label text-gold">Judge tools</span>
              </div>
              <h2 className="display-md">Your dynasty analytics department.</h2>
              <p className="body-md" style={{ color: 'var(--text-secondary)', marginTop: 8, maxWidth: 540 }}>
                Every tool is calibrated to your specific Sleeper leagues — not generic consensus.
              </p>
            </div>

            <div className="grid-3">
              {TOOLS.map(t => (
                <Link href={t.href} key={t.href} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>{t.icon}</span>
                      {t.free
                        ? <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(34,197,94,0.15)', color: '#4ADE80', fontWeight: 600 }}>FREE</span>
                        : <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(200,151,58,0.15)', color: 'var(--gold-300)', fontWeight: 600 }}>ELITE</span>
                      }
                    </div>
                    <div>
                      <h3 className="heading-sm" style={{ marginBottom: 4 }}>{t.label}</h3>
                      <p className="body-sm" style={{ color: 'var(--text-muted)' }}>{t.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── DEVY SECTION ── */}
        <section style={{ padding: '4rem 0' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div className="gold-bar" />
                  <span className="label text-gold">DevyJudge</span>
                </div>
                <h2 className="display-md" style={{ marginBottom: '1rem' }}>
                  Track them from<br />
                  <span className="text-gold">high school to the NFL.</span>
                </h2>
                <p className="body-md" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  The only platform built specifically for devy dynasty. Prospect profiles, highlight analysis, college-to-NFL projections, and community-driven rankings — from freshman year to draft night.
                </p>
                <Link href="/devy" className="btn btn-ghost">
                  Explore DevyJudge →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {DEVY_PROSPECTS.map((p, i) => (
                  <Link href={`/devy/prospects/${p.name.toLowerCase().replace(/\s+/g,'-')}`} key={p.name} style={{ textDecoration: 'none' }}>
                    <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--bg-tertiary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-gold)',
                        flexShrink: 0,
                      }}>
                        #{p.devyRank}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {p.school} · {p.year} · {p.rating}
                        </div>
                      </div>
                      <span className={`pos pos-${p.pos.toLowerCase()}`}>{p.pos}</span>
                    </div>
                  </Link>
                ))}
                <Link href="/devy/rankings" style={{ textAlign: 'center', paddingTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-gold)' }}>
                  Full devy rankings →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── SUBSCRIPTION CTA ── */}
        <section style={{
          padding: '5rem 0',
          background: 'var(--bg-secondary)',
          borderTop: '0.5px solid var(--border-subtle)',
          textAlign: 'center',
        }}>
          <div className="container-sm">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(200,151,58,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.75rem',
              }}>⚖</div>
            </div>
            <h2 className="display-md" style={{ marginBottom: '1rem' }}>
              Ready to manage your<br />dynasty like a real GM?
            </h2>
            <p className="body-lg" style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Judge Elite unlocks every tool across DynastyJudge and DevyJudge,<br />
              plus the full Sleeper-integrated Judge App.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
              <Link href="/subscribe" className="btn btn-primary">Judge Elite — $12.99/mo</Link>
              <Link href="/subscribe#annual" className="btn btn-ghost">Annual plan — $99/yr (save 36%)</Link>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {['All tools unlocked', 'DevyJudge included', 'Sleeper integration', 'Cancel anytime'].map(f => (
                <span key={f} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#4ADE80' }}>✓</span> {f}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{
          padding: '3rem 0 2rem',
          borderTop: '0.5px solid var(--border-subtle)',
        }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '3rem', marginBottom: '3rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>⚖</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700 }}>
                    Dynasty<span style={{ color: 'var(--gold-400)' }}>Judge</span>
                  </span>
                </div>
                <p className="body-sm" style={{ color: 'var(--text-muted)', maxWidth: 260, marginBottom: '1rem' }}>
                  The verdict on dynasty fantasy football. Court is always in session.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {['Twitter/X', 'YouTube', 'TikTok', 'Discord'].map(s => (
                    <Link key={s} href={`/${s.toLowerCase().replace('/','')}`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{s}</Link>
                  ))}
                </div>
              </div>
              {[
                { heading: 'Content', links: ['Latest rulings', 'Rankings', 'Podcast', 'Newsletter'] },
                { heading: 'Tools', links: ['Trade calculator', 'Draft analyzer', 'League analyzer', 'Lineup optimizer'] },
                { heading: 'Company', links: ['About', 'DevyJudge', 'Subscribe', 'Contact'] },
              ].map(col => (
                <div key={col.heading}>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.875rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{col.heading}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {col.links.map(l => (
                      <Link key={l} href="#" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{l}</Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '0.5px solid var(--border-subtle)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                © 2026 DynastyJudge. All rights reserved.
              </p>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                {['Privacy', 'Terms', 'DMCA'].map(l => (
                  <Link key={l} href="#" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{l}</Link>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
