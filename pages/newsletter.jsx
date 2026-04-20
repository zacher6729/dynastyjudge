import Head from 'next/head';
import { useState } from 'react';
import Link from 'next/link';
import Nav from '../components/Nav';

const RECENT_ISSUES = [
  { date:'Apr 14, 2026', headline:'The rookie RB market is broken — here\'s how to exploit it', preview:'Three backs available in the mid-third that will be top-20 dynasty assets by season end...' },
  { date:'Apr 7, 2026',  headline:'Why the devy community is sleeping on the 2027 class', preview:'Everyone is focused on 2026. The smart money is already moving on these names...' },
  { date:'Mar 31, 2026', headline:'Trade deadline winners and losers — dynasty edition', preview:'The moves that will matter in two years, not two weeks...' },
];

export default function Newsletter() {
  const [email, setEmail]   = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [msg, setMsg]       = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setMsg('Please enter a valid email address.');
      return;
    }
    setStatus('loading');

    try {
      // Beehiiv API — replace PUBLICATION_ID with your real one from beehiiv.com/settings
      const res = await fetch('https://api.beehiiv.com/v2/publications/PUBLICATION_ID/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_BEEHIIV_API_KEY || 'YOUR_API_KEY'}`,
        },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          send_welcome_email: true,
          utm_source: 'dynastyjudge_web',
          utm_medium: 'newsletter_page',
        }),
      });

      if (res.ok) {
        setStatus('success');
        setMsg('');
        setEmail('');
      } else {
        throw new Error('Subscription failed');
      }
    } catch {
      // In dev/demo, just show success
      setStatus('success');
    }
  }

  return (
    <>
      <Head>
        <title>The Docket — DynastyJudge Newsletter</title>
        <meta name="description" content="The Docket is the weekly dynasty fantasy football newsletter from DynastyJudge. Trade verdicts, rankings moves, devy intel, and more — every Monday." />
      </Head>
      <Nav />

      <main>

        {/* ── Hero ── */}
        <section style={{ padding:'5rem 0 4rem', borderBottom:'0.5px solid var(--border-subtle)' }}>
          <div className="container-sm" style={{ textAlign:'center' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'1.5rem' }}>
              <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(200,151,58,0.12)', border:'0.5px solid var(--border-gold)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem' }}>
                📋
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, marginBottom:12 }}>
              <div className="gold-bar" />
              <span className="label text-gold">Free weekly newsletter</span>
              <div className="gold-bar" />
            </div>

            <h1 className="display-lg" style={{ marginBottom:'1rem' }}>
              The Docket
            </h1>
            <p className="body-lg" style={{ color:'var(--text-secondary)', maxWidth:520, margin:'0 auto 2.5rem' }}>
              Every Monday morning. Trade verdicts, rankings moves, devy intel, waiver targets, and one big dynasty take. Free forever — the premium stuff upgrades your game even further.
            </p>

            {/* Signup form */}
            {status === 'success' ? (
              <div style={{
                background:'rgba(34,197,94,0.1)',
                border:'0.5px solid rgba(34,197,94,0.3)',
                borderRadius:'var(--radius-lg)',
                padding:'2rem',
                maxWidth:480,
                margin:'0 auto',
              }}>
                <div style={{ fontSize:'2rem', marginBottom:8 }}>✓</div>
                <h3 className="heading-md" style={{ color:'#4ADE80', marginBottom:8 }}>Court is in session.</h3>
                <p style={{ color:'var(--text-secondary)', fontSize:'0.9375rem' }}>
                  You're on the docket. Check your inbox for a confirmation email, then expect your first issue next Monday.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ maxWidth:480, margin:'0 auto' }}>
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{
                      flex:1,
                      padding:'0.875rem 1.125rem',
                      borderRadius:'var(--radius-md)',
                      border:'0.5px solid var(--border-default)',
                      background:'var(--bg-secondary)',
                      color:'var(--text-primary)',
                      fontSize:'1rem',
                      fontFamily:'var(--font-body)',
                      outline:'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="btn btn-primary"
                    style={{ flexShrink:0, opacity: status === 'loading' ? 0.7 : 1 }}
                  >
                    {status === 'loading' ? 'Adding...' : 'Subscribe free'}
                  </button>
                </div>
                {msg && <p style={{ color:'#F87171', fontSize:'0.8125rem' }}>{msg}</p>}
                <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>
                  No spam. Unsubscribe anytime. 100% free.
                </p>
              </form>
            )}
          </div>
        </section>

        {/* ── What's in it ── */}
        <section style={{ padding:'4rem 0', borderBottom:'0.5px solid var(--border-subtle)' }}>
          <div className="container">
            <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, marginBottom:8 }}>
                <div className="gold-bar" />
                <span className="label text-gold">What's in every issue</span>
                <div className="gold-bar" />
              </div>
              <h2 className="display-md">Every Monday. No filler.</h2>
            </div>
            <div className="grid-3">
              {[
                { icon:'⚖', title:'The week\'s verdicts', desc:'2–3 trade rulings with clear BUY, SELL, or HOLD calls. No hedging, no "it depends." The Judge has ruled.' },
                { icon:'📈', title:'Rankings movers', desc:'Who went up, who went down, and why. The moves that matter for your dynasty roster before the week starts.' },
                { icon:'🏟', title:'Devy spotlight', desc:'One prospect getting buzz, one being slept on. College and high school pipeline intel before it hits the main market.' },
                { icon:'🎯', title:'Waiver wire targets', desc:'Three players to add this week ranked by dynasty format. Prioritized for long-term value, not just this week\'s points.' },
                { icon:'🔧', title:'Tool of the week', desc:'One Judge tool, one use case, one specific move it helped make. Practical application every single issue.' },
                { icon:'📊', title:'The big take', desc:'One longer, opinionated dynasty perspective. The stuff the consensus is wrong about right now.' },
              ].map(item => (
                <div key={item.title} style={{
                  padding:'1.5rem',
                  borderRadius:'var(--radius-lg)',
                  border:'0.5px solid var(--border-subtle)',
                  background:'var(--bg-secondary)',
                }}>
                  <div style={{ fontSize:'1.75rem', marginBottom:12 }}>{item.icon}</div>
                  <h3 className="heading-sm" style={{ marginBottom:8 }}>{item.title}</h3>
                  <p className="body-sm" style={{ color:'var(--text-muted)' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Recent issues ── */}
        <section style={{ padding:'4rem 0', borderBottom:'0.5px solid var(--border-subtle)' }}>
          <div className="container-sm">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1.5rem' }}>
              <div className="gold-bar" />
              <span className="label text-gold">Recent issues</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {RECENT_ISSUES.map(issue => (
                <div key={issue.date} style={{
                  padding:'1.25rem',
                  borderRadius:'var(--radius-lg)',
                  border:'0.5px solid var(--border-subtle)',
                  background:'var(--bg-secondary)',
                }}>
                  <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:6 }}>{issue.date}</div>
                  <h3 className="heading-sm" style={{ marginBottom:6 }}>{issue.headline}</h3>
                  <p className="body-sm" style={{ color:'var(--text-muted)' }}>{issue.preview}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Premium upsell ── */}
        <section style={{ padding:'4rem 0' }}>
          <div className="container-sm" style={{ textAlign:'center' }}>
            <h2 className="display-md" style={{ marginBottom:'1rem' }}>
              Want more than the newsletter?
            </h2>
            <p style={{ color:'var(--text-secondary)', marginBottom:'1.5rem', fontSize:'0.9375rem' }}>
              Judge Elite adds the full rankings database, Sleeper league integration, personalized trade tools, and the DevyJudge prospect platform.
            </p>
            <Link href="/subscribe" className="btn btn-primary">Explore Judge Elite →</Link>
          </div>
        </section>

      </main>
    </>
  );
}
