import Head from 'next/head';
import { useState } from 'react';
import Link from 'next/link';
import Nav from '../components/Nav';

const TIERS = [
  {
    id:       'free',
    name:     'Free',
    price:    { monthly: 0, annual: 0 },
    tagline:  'Start here. Always free.',
    cta:      'Get started free',
    ctaHref:  '/rankings',
    featured: false,
    features: [
      'Top 25 dynasty rankings (1QB)',
      'Weekly Docket newsletter',
      'Community crowdsourced rankings',
      'Free trade calculator (generic)',
      '3 rulings per month',
      'Public Discord access',
    ],
    missing: [
      'Full 300+ player rankings',
      'SuperFlex & TE Premium formats',
      'Sleeper league integration',
      'Personalized trade calculator',
      'DevyJudge prospect database',
      'Live draft assistant',
    ],
  },
  {
    id:       'pro',
    name:     'Judge Pro',
    price:    { monthly: 9.99, annual: 79 },
    tagline:  'For the serious dynasty manager.',
    cta:      'Start Judge Pro',
    ctaHref:  'https://dynastyjudge.memberful.com/checkout?plan=pro',
    featured: false,
    features: [
      'Full 300+ player rankings — all formats',
      'Weekly rankings updates with trend grades',
      'Unlimited trade verdicts & rulings',
      'Sleeper league analyzer & dashboard',
      'Personalized trade calculator',
      'Start/sit optimizer (league-calibrated)',
      'FAAB bid advisor',
      'Player → leagues lookup tool',
      'Premium Discord community',
      'Early content access',
    ],
    missing: [
      'DevyJudge prospect database',
      'Live draft assistant',
      'Leaguemate tendency profiler',
      'Mock draft simulator',
    ],
  },
  {
    id:       'elite',
    name:     'Judge Elite',
    price:    { monthly: 12.99, annual: 99 },
    tagline:  'Every tool. Both platforms.',
    cta:      'Start Judge Elite',
    ctaHref:  'https://dynastyjudge.memberful.com/checkout?plan=elite',
    featured: true,
    badge:    'Best value',
    features: [
      'Everything in Judge Pro',
      'Full DevyJudge prospect database (500+ players)',
      'HS prospect profiles & highlight breakdowns',
      'College-to-NFL projection model',
      'Live draft assistant (Sleeper WebSocket)',
      'Leaguemate tendency profiler',
      'Mock draft simulator — your actual opponents',
      'Dynasty window analysis per team',
      'Trade finder — who will accept this?',
      'Community devy rankings (full data)',
      'Early devy board access',
      'Priority support',
    ],
    missing: [],
  },
];

const FAQS = [
  { q:'Can I cancel anytime?', a:'Yes. Cancel from your account dashboard at any time. No questions asked, no cancellation fees. Your access continues until the end of your billing period.' },
  { q:'What is Sleeper integration?', a:'Connect your Sleeper username and the Judge App reads your actual leagues — rosters, scoring settings, draft history, and leaguemate transaction patterns. Every tool is then calibrated to your specific leagues, not generic consensus.' },
  { q:'Does the annual plan auto-renew?', a:'Yes. Annual plans renew at the same rate after 12 months. You\'ll receive an email reminder 14 days before renewal so you can cancel if you choose.' },
  { q:'Is there a free trial?', a:'The free tier is permanent — use it as long as you want. Pro and Elite plans don\'t have a trial period, but if you\'re not satisfied within 7 days of your first payment, contact us and we\'ll refund it.' },
  { q:'What happens to my data if I cancel?', a:'Your account and any saved league connections remain accessible on the free tier. Nothing is deleted. If you resubscribe, everything picks up where you left off.' },
  { q:'Can I switch between Pro and Elite?', a:'Yes. Upgrade or downgrade anytime from your account settings. Upgrades take effect immediately. Downgrades take effect at the next billing cycle.' },
];

export default function Subscribe() {
  const [billing, setBilling] = useState('annual'); // monthly | annual

  return (
    <>
      <Head>
        <title>Subscribe — DynastyJudge</title>
        <meta name="description" content="Judge Elite unlocks every dynasty and devy tool across DynastyJudge and DevyJudge. Full rankings, Sleeper integration, live draft assistant, and more." />
      </Head>
      <Nav />

      <main>

        {/* ── Header ── */}
        <section style={{ padding:'4rem 0 3rem', borderBottom:'0.5px solid var(--border-subtle)', textAlign:'center' }}>
          <div className="container-sm">
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, marginBottom:12 }}>
              <div className="gold-bar" />
              <span className="label text-gold">Subscription plans</span>
              <div className="gold-bar" />
            </div>
            <h1 className="display-md" style={{ marginBottom:'1rem' }}>
              Manage your dynasty like a real GM.
            </h1>
            <p className="body-lg" style={{ color:'var(--text-secondary)', maxWidth:500, margin:'0 auto 2rem' }}>
              Every tool calibrated to your specific Sleeper leagues. Not generic. Not consensus. Yours.
            </p>

            {/* Billing toggle */}
            <div style={{ display:'inline-flex', gap:0, border:'0.5px solid var(--border-default)', borderRadius:'var(--radius-md)', overflow:'hidden', marginBottom:'0.75rem' }}>
              {['monthly','annual'].map(b => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  style={{
                    padding:'0.5rem 1.25rem',
                    background: billing === b ? 'var(--gold-500)' : 'transparent',
                    color:      billing === b ? 'var(--charcoal-900)' : 'var(--text-secondary)',
                    border:'none', cursor:'pointer',
                    fontFamily:'var(--font-body)', fontSize:'0.875rem', fontWeight: billing === b ? 700 : 400,
                  }}>
                  {b === 'monthly' ? 'Monthly' : 'Annual'}
                </button>
              ))}
            </div>
            {billing === 'annual' && (
              <p style={{ fontSize:'0.8125rem', color:'#4ADE80', fontWeight:600 }}>
                Save up to 36% with annual billing
              </p>
            )}
          </div>
        </section>

        {/* ── Pricing cards ── */}
        <section style={{ padding:'4rem 0' }}>
          <div className="container">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1.5rem', alignItems:'start' }}>
              {TIERS.map(tier => (
                <div
                  key={tier.id}
                  style={{
                    borderRadius:'var(--radius-lg)',
                    border: tier.featured ? '2px solid var(--gold-500)' : '0.5px solid var(--border-default)',
                    background: tier.featured ? 'rgba(200,151,58,0.05)' : 'var(--bg-secondary)',
                    overflow:'hidden',
                    position:'relative',
                  }}>

                  {/* Featured badge */}
                  {tier.badge && (
                    <div style={{
                      background:'var(--gold-500)',
                      color:'var(--charcoal-900)',
                      textAlign:'center',
                      padding:'0.375rem',
                      fontSize:'0.75rem',
                      fontWeight:700,
                      letterSpacing:'0.06em',
                      textTransform:'uppercase',
                    }}>
                      {tier.badge}
                    </div>
                  )}

                  <div style={{ padding:'2rem' }}>
                    {/* Tier name + price */}
                    <h2 style={{ fontSize:'1.25rem', fontWeight:700, marginBottom:4 }}>{tier.name}</h2>
                    <p style={{ fontSize:'0.875rem', color:'var(--text-muted)', marginBottom:'1.25rem' }}>{tier.tagline}</p>

                    <div style={{ marginBottom:'1.5rem' }}>
                      {tier.price.monthly === 0 ? (
                        <div style={{ fontSize:'2.5rem', fontWeight:700 }}>Free</div>
                      ) : (
                        <>
                          <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                            <span style={{ fontSize:'2.5rem', fontWeight:700 }}>
                              ${billing === 'annual'
                                  ? (tier.price.annual / 12).toFixed(2)
                                  : tier.price.monthly}
                            </span>
                            <span style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>/mo</span>
                          </div>
                          {billing === 'annual' && (
                            <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:2 }}>
                              Billed ${tier.price.annual}/yr · saves ${Math.round(tier.price.monthly * 12 - tier.price.annual)}/yr
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* CTA */}
                    <a
                      href={tier.ctaHref}
                      className={`btn ${tier.featured ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ width:'100%', marginBottom:'1.75rem', textAlign:'center', display:'block' }}>
                      {tier.cta}
                    </a>

                    {/* Features */}
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {tier.features.map(f => (
                        <div key={f} style={{ display:'flex', gap:10, alignItems:'flex-start', fontSize:'0.875rem' }}>
                          <span style={{ color:'#4ADE80', flexShrink:0, marginTop:1 }}>✓</span>
                          <span style={{ color:'var(--text-secondary)' }}>{f}</span>
                        </div>
                      ))}
                      {tier.missing.map(f => (
                        <div key={f} style={{ display:'flex', gap:10, alignItems:'flex-start', fontSize:'0.875rem', opacity:0.4 }}>
                          <span style={{ color:'var(--text-muted)', flexShrink:0, marginTop:1 }}>✗</span>
                          <span style={{ color:'var(--text-muted)', textDecoration:'line-through' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile note */}
            <p style={{ textAlign:'center', marginTop:'1.5rem', fontSize:'0.8125rem', color:'var(--text-muted)' }}>
              All plans include access on web and mobile. Sleeper integration requires a free Sleeper account.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ padding:'4rem 0', borderTop:'0.5px solid var(--border-subtle)' }}>
          <div className="container-sm">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'2rem' }}>
              <div className="gold-bar" />
              <span className="label text-gold">Frequently asked</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {FAQS.map((faq, i) => (
                <div key={i} style={{
                  padding:'1.25rem 0',
                  borderBottom: i < FAQS.length - 1 ? '0.5px solid var(--border-subtle)' : 'none',
                }}>
                  <h3 className="heading-sm" style={{ marginBottom:6 }}>{faq.q}</h3>
                  <p className="body-sm" style={{ color:'var(--text-secondary)' }}>{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section style={{ padding:'4rem 0', background:'var(--bg-secondary)', borderTop:'0.5px solid var(--border-subtle)', textAlign:'center' }}>
          <div className="container-sm">
            <h2 className="display-md" style={{ marginBottom:'1rem' }}>Still on the fence?</h2>
            <p style={{ color:'var(--text-secondary)', marginBottom:'1.5rem' }}>
              Start with the free newsletter. See what the verdict looks like every Monday before committing to anything.
            </p>
            <Link href="/newsletter" className="btn btn-ghost">Subscribe to The Docket — free</Link>
          </div>
        </section>

      </main>
    </>
  );
}
