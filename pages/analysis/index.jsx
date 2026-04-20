import Head from 'next/head';
import Link from 'next/link';
import Nav from '../../components/Nav';

const ALL_RULINGS = [
  {
    slug: 'ceedee-lamb-buy-low-window',
    verdict: 'BUY',
    player: 'CeeDee Lamb',
    pos: 'WR', team: 'DAL', age: 25,
    headline: 'The buy window is closing — grab him before the market corrects',
    excerpt: 'Three weeks of low volume obscured what the film shows clearly. Lamb is the unquestioned alpha and his target share is about to normalize.',
    date: 'Apr 19, 2026',
    tags: ['Trade Analysis', 'Wide Receiver'],
  },
  {
    slug: 'najee-harris-hold-sell',
    verdict: 'SELL',
    player: 'Najee Harris',
    pos: 'RB', team: 'PIT', age: 27,
    headline: 'The efficiency numbers are damning',
    excerpt: 'Volume can mask a lot of problems. At 27 with this carry load, the age curve math is not kind.',
    date: 'Apr 17, 2026',
    tags: ['Trade Analysis', 'Running Back'],
  },
  {
    slug: 'bijan-robinson-hold',
    verdict: 'HOLD',
    player: 'Bijan Robinson',
    pos: 'RB', team: 'ATL', age: 23,
    headline: 'The dynasty ceiling is elite — patience required for the floor',
    excerpt: 'Concerns about the Falcons offense are valid but overstated. His talent profile and age make him untouchable.',
    date: 'Apr 16, 2026',
    tags: ['Trade Analysis', 'Running Back'],
  },
];

const VERDICT_CONFIG = {
  BUY:  { label:'▲ BUY',  cls:'verdict-buy'  },
  SELL: { label:'▼ SELL', cls:'verdict-sell' },
  HOLD: { label:'◆ HOLD', cls:'verdict-hold' },
  STASH:{ label:'● STASH',cls:'verdict-stash'},
};

const POS_COLORS = {
  QB:{ bg:'rgba(239,68,68,0.15)',  text:'#FCA5A5' },
  RB:{ bg:'rgba(34,197,94,0.15)', text:'#86EFAC' },
  WR:{ bg:'rgba(59,130,246,0.15)',text:'#93C5FD' },
  TE:{ bg:'rgba(251,191,36,0.15)',text:'#FDE68A' },
};

export default function AnalysisIndex() {
  return (
    <>
      <Head>
        <title>Rulings — DynastyJudge</title>
        <meta name="description" content="Dynasty fantasy football trade verdicts and player analysis from DynastyJudge. BUY, SELL, and HOLD rulings updated weekly." />
      </Head>
      <Nav />

      <main style={{ minHeight:'100vh', paddingBottom:'4rem' }}>

        {/* ── Header ── */}
        <div style={{ borderBottom:'0.5px solid var(--border-subtle)', padding:'2.5rem 0 2rem' }}>
          <div className="container">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div className="gold-bar" />
              <span className="label text-gold">The court record</span>
            </div>
            <h1 className="display-md" style={{ marginBottom:8 }}>All Rulings</h1>
            <p className="body-md" style={{ color:'var(--text-secondary)', maxWidth:520 }}>
              Every trade verdict, player analysis, and dynasty take from the Judge panel. Updated multiple times per week.
            </p>
          </div>
        </div>

        {/* ── Filter row ── */}
        <div style={{ borderBottom:'0.5px solid var(--border-subtle)', background:'var(--bg-secondary)' }}>
          <div className="container" style={{ padding:'0.875rem 1.5rem', display:'flex', gap:8, flexWrap:'wrap' }}>
            {['All','BUY','SELL','HOLD','QB','RB','WR','TE'].map(f => (
              <button key={f} style={{
                padding:'0.375rem 0.875rem', borderRadius:99,
                border:'0.5px solid var(--border-subtle)',
                background:'transparent', color:'var(--text-muted)',
                fontSize:'0.8125rem', cursor:'pointer', fontFamily:'var(--font-body)',
              }}>
                {f}
              </button>
            ))}
            <span style={{ marginLeft:'auto', fontSize:'0.8125rem', color:'var(--text-muted)', alignSelf:'center' }}>
              {ALL_RULINGS.length} rulings
            </span>
          </div>
        </div>

        {/* ── Rulings list ── */}
        <div className="container" style={{ paddingTop:'1.5rem' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {ALL_RULINGS.map(r => {
              const v = VERDICT_CONFIG[r.verdict] || VERDICT_CONFIG.HOLD;
              const p = POS_COLORS[r.pos] || { bg:'rgba(156,163,175,0.15)', text:'#D1D5DB' };
              return (
                <Link key={r.slug} href={`/analysis/${r.slug}`} style={{ textDecoration:'none' }}>
                  <article className="card" style={{ padding:'1.5rem', display:'flex', gap:'1.5rem', alignItems:'flex-start' }}>

                    {/* Verdict column */}
                    <div style={{ flexShrink:0, paddingTop:2 }}>
                      <span className={`verdict ${v.cls}`}>{v.label}</span>
                    </div>

                    {/* Content */}
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                        <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:4, fontSize:'0.7rem', fontWeight:700, background:p.bg, color:p.text }}>{r.pos}</span>
                        <span style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)' }}>{r.player}</span>
                        <span style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{r.team} · Age {r.age}</span>
                        <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'var(--text-muted)' }}>{r.date}</span>
                      </div>
                      <h2 style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)', marginBottom:6, lineHeight:1.4 }}>
                        {r.headline}
                      </h2>
                      <p style={{ fontSize:'0.875rem', color:'var(--text-muted)', lineHeight:1.6, marginBottom:10 }}>
                        {r.excerpt}
                      </p>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {r.tags.map(t => (
                          <span key={t} style={{ padding:'2px 8px', borderRadius:99, border:'0.5px solid var(--border-subtle)', fontSize:'0.75rem', color:'var(--text-muted)' }}>{t}</span>
                        ))}
                      </div>
                    </div>

                    <span style={{ color:'var(--text-gold)', fontSize:'0.875rem', flexShrink:0, alignSelf:'center' }}>Read →</span>
                  </article>
                </Link>
              );
            })}
          </div>

          {/* Paywall */}
          <div style={{
            marginTop:'2rem',
            border:'0.5px solid var(--border-gold)',
            borderRadius:'var(--radius-lg)',
            padding:'2rem',
            textAlign:'center',
            background:'rgba(200,151,58,0.05)',
          }}>
            <h3 className="heading-lg" style={{ marginBottom:8 }}>Unlock unlimited rulings</h3>
            <p style={{ color:'var(--text-secondary)', maxWidth:440, margin:'0 auto 1.5rem', fontSize:'0.9375rem' }}>
              Judge Elite members get every ruling the moment it drops, plus the full rankings database and Sleeper tools.
            </p>
            <Link href="/subscribe" className="btn btn-primary">Start Judge Elite — $12.99/mo</Link>
          </div>
        </div>

      </main>
    </>
  );
}
