import Head from 'next/head';
import Link from 'next/link';
import Nav from '../../components/Nav';

// ── Mock article data (replace with CMS/DB later) ────────────────────────────
const ARTICLES = {
  'ceedee-lamb-buy-low-window': {
    title: "CeeDee Lamb: The buy window is closing",
    subtitle: "Three weeks of low volume obscured what the film shows clearly. This is the buy.",
    verdict: "BUY",
    player: "CeeDee Lamb",
    pos: "WR", team: "DAL", age: 25,
    dynastyRank: 2,
    date: "April 19, 2026",
    author: "The Judge",
    readTime: "4 min read",
    tags: ["Trade Analysis", "Wide Receiver", "Dallas Cowboys"],
    body: `
The past three weeks have created a false narrative around CeeDee Lamb. Three games with fewer than five targets, one clunker against a Tampa secondary that was gameplanning specifically to take him away, and suddenly the dynasty community has decided the era is over.

It isn't.

**What the film actually shows**

Pull up the last three weeks in All-22 and the story changes immediately. Lamb is running crisp routes on every snap. His release is still elite. The separation he's creating hasn't changed — what's changed is where the Cowboys are getting the ball out.

Dak Prescott is working through progressions faster this season, which means fewer shots downfield and more checkdowns. That's a scheme decision, not a Lamb decision. When the Cowboys are trailing — which happens to be when they actually need to throw the ball — Lamb is still the first read on over 60% of plays.

**The trade market is wrong**

Right now you can acquire Lamb for roughly WR6–8 value in most leagues. That's a historic discount for a player who has led the NFL in targets twice and is 25 years old. The managers selling are reacting to three weeks of data. You should be reacting to three years of data.

His age curve projects another four to five elite seasons minimum. His situation — locked in Dallas on a massive contract — means he's not going anywhere. The offensive coordinator who was struggling to get him the ball is now gone.

**The verdict**

If you can get Lamb for WR7–10 value, that trade will look absurd by Week 8. The buy window is open right now specifically because the surface-level stats are ugly. That's exactly when you move.

**Rating: BUY aggressively at current prices.**
    `,
    relatedArticles: [
      { slug: 'najee-harris-hold-sell', verdict: 'SELL', player: 'Najee Harris', pos: 'RB', excerpt: 'The usage is there but the efficiency tells a different story.' },
      { slug: 'bijan-robinson-hold', verdict: 'HOLD', player: 'Bijan Robinson', pos: 'RB', excerpt: 'The dynasty ceiling is elite — patience required.' },
    ],
  },
  'najee-harris-hold-sell': {
    title: "Najee Harris: The efficiency numbers are damning",
    subtitle: "Volume can mask a lot of problems. It can't mask this.",
    verdict: "SELL",
    player: "Najee Harris",
    pos: "RB", team: "PIT", age: 27,
    dynastyRank: 44,
    date: "April 17, 2026",
    author: "The Judge",
    readTime: "3 min read",
    tags: ["Trade Analysis", "Running Back", "Pittsburgh Steelers"],
    body: `
Najee Harris is going to get you 200-plus carries this season. He'll probably top 900 yards. He'll catch 40-something passes out of the backfield. And he will continue to be dramatically overvalued in dynasty leagues because managers are looking at volume and calling it production.

**The efficiency problem**

Harris ranks in the bottom 15% of running backs in yards after contact per attempt, broken tackle rate, and yards before contact. The Steelers' offensive line is better than it was two years ago, and Harris is still averaging 3.6 yards per carry. That number belongs to a committee back in a bad offense, not a lead back on a team trying to win playoff games.

**The age curve math**

At 27, with the carry volume Harris has absorbed in his career, the historical comps are not kind. The backs who've taken this many touches by this age typically decline faster than expected. His peak production window has likely already passed.

**The verdict**

Sell while managers are still buying the volume story. Get a young WR or a mid-first for him in most leagues. That trade gets better for you with every passing week.
    `,
    relatedArticles: [
      { slug: 'ceedee-lamb-buy-low-window', verdict: 'BUY', player: 'CeeDee Lamb', pos: 'WR', excerpt: 'The buy window is closing — grab him before the market corrects.' },
    ],
  },
};

const VERDICT_CONFIG = {
  BUY:   { label:'▲ BUY',   cls:'verdict-buy',  summary:'The court rules: acquire at current prices.' },
  SELL:  { label:'▼ SELL',  cls:'verdict-sell', summary:'The court rules: move this asset now.' },
  HOLD:  { label:'◆ HOLD',  cls:'verdict-hold', summary:'The court rules: hold and monitor.' },
  STASH: { label:'● STASH', cls:'verdict-stash',summary:'The court rules: low-cost add with upside.' },
};

const POS_COLORS = {
  QB:{ bg:'rgba(239,68,68,0.15)',text:'#FCA5A5' },
  RB:{ bg:'rgba(34,197,94,0.15)',text:'#86EFAC' },
  WR:{ bg:'rgba(59,130,246,0.15)',text:'#93C5FD' },
  TE:{ bg:'rgba(251,191,36,0.15)',text:'#FDE68A' },
};

export async function getStaticPaths() {
  return {
    paths: Object.keys(ARTICLES).map(slug => ({ params: { slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const article = ARTICLES[params.slug] || null;
  return { props: { article, slug: params.slug } };
}

export default function Article({ article }) {
  if (!article) return <div>Article not found</div>;

  const verdict = VERDICT_CONFIG[article.verdict] || VERDICT_CONFIG.HOLD;
  const pos = POS_COLORS[article.pos] || { bg:'rgba(156,163,175,0.15)', text:'#D1D5DB' };

  // Render markdown-lite body (bold, paragraphs)
  const renderBody = (text) => {
    return text.trim().split('\n\n').map((block, i) => {
      if (!block.trim()) return null;
      // Heading (starts with **)
      if (block.startsWith('**') && block.endsWith('**')) {
        return <h3 key={i} className="heading-md" style={{ marginTop:'2rem', marginBottom:'0.75rem' }}>{block.slice(2,-2)}</h3>;
      }
      // Inline bold
      const parts = block.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j}>{part.slice(2,-2)}</strong>;
        }
        return part;
      });
      return <p key={i} className="body-lg" style={{ color:'var(--text-secondary)', marginBottom:'1.25rem' }}>{parts}</p>;
    });
  };

  return (
    <>
      <Head>
        <title>{article.title} — DynastyJudge</title>
        <meta name="description" content={article.subtitle} />
      </Head>
      <Nav />

      <main>

        {/* ── Article header ── */}
        <div style={{ borderBottom:'0.5px solid var(--border-subtle)', padding:'3rem 0 2.5rem' }}>
          <div className="container-sm">
            {/* Breadcrumb */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'1.25rem', fontSize:'0.8125rem', color:'var(--text-muted)' }}>
              <Link href="/" style={{ color:'var(--text-muted)' }}>Home</Link>
              <span>/</span>
              <Link href="/analysis" style={{ color:'var(--text-muted)' }}>Rulings</Link>
              <span>/</span>
              <span style={{ color:'var(--text-secondary)' }}>{article.player}</span>
            </div>

            {/* Verdict + player info */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:'1.25rem', flexWrap:'wrap' }}>
              <span className={`verdict ${verdict.cls}`}>{verdict.label}</span>
              <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:'0.75rem', fontWeight:700, background:pos.bg, color:pos.text }}>{article.pos}</span>
              <span style={{ fontSize:'0.875rem', color:'var(--text-muted)' }}>{article.team} · Age {article.age} · Dynasty rank #{article.dynastyRank}</span>
            </div>

            <h1 className="display-md" style={{ marginBottom:'0.875rem' }}>{article.title}</h1>
            <p className="body-lg" style={{ color:'var(--text-secondary)', marginBottom:'1.5rem' }}>{article.subtitle}</p>

            {/* Meta */}
            <div style={{ display:'flex', alignItems:'center', gap:16, fontSize:'0.8125rem', color:'var(--text-muted)', flexWrap:'wrap' }}>
              <span>By {article.author}</span>
              <span>{article.date}</span>
              <span>{article.readTime}</span>
              <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
                {article.tags.map(t => (
                  <span key={t} style={{ padding:'2px 10px', borderRadius:99, border:'0.5px solid var(--border-subtle)', fontSize:'0.75rem' }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Article body ── */}
        <div style={{ padding:'3rem 0' }}>
          <div className="container-sm">

            {/* Verdict callout box */}
            <div style={{
              border:`0.5px solid var(--border-gold)`,
              borderLeft:`4px solid var(--gold-500)`,
              borderRadius:'0 var(--radius-md) var(--radius-md) 0',
              padding:'1rem 1.25rem',
              background:'rgba(200,151,58,0.06)',
              marginBottom:'2rem',
              display:'flex', alignItems:'center', gap:12,
            }}>
              <span style={{ fontSize:'1.25rem' }}>⚖</span>
              <div>
                <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--gold-400)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:2 }}>The ruling</div>
                <div style={{ fontSize:'0.9375rem', color:'var(--text-secondary)' }}>{verdict.summary}</div>
              </div>
            </div>

            {/* Body content */}
            <div>{renderBody(article.body)}</div>

            {/* Tags */}
            <div style={{ marginTop:'3rem', paddingTop:'1.5rem', borderTop:'0.5px solid var(--border-subtle)', display:'flex', gap:8, flexWrap:'wrap' }}>
              {article.tags.map(t => (
                <span key={t} style={{ padding:'4px 12px', borderRadius:99, border:'0.5px solid var(--border-default)', fontSize:'0.8125rem', color:'var(--text-muted)' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Paywall / subscribe CTA ── */}
        <div style={{ background:'var(--bg-secondary)', borderTop:'0.5px solid var(--border-subtle)', borderBottom:'0.5px solid var(--border-subtle)', padding:'3rem 0' }}>
          <div className="container-sm" style={{ textAlign:'center' }}>
            <div style={{ fontSize:'1.5rem', marginBottom:12 }}>⚖</div>
            <h3 className="heading-lg" style={{ marginBottom:8 }}>Get every ruling. Every week.</h3>
            <p style={{ color:'var(--text-secondary)', marginBottom:'1.5rem', fontSize:'0.9375rem' }}>
              Judge Elite delivers trade verdicts, rankings updates, devy prospects, and Sleeper-integrated tools — all in one subscription.
            </p>
            <div style={{ display:'flex', justifyContent:'center', gap:'0.75rem', flexWrap:'wrap' }}>
              <Link href="/subscribe" className="btn btn-primary">Start Judge Elite</Link>
              <Link href="/newsletter" className="btn btn-ghost">Free newsletter →</Link>
            </div>
          </div>
        </div>

        {/* ── Related rulings ── */}
        {article.relatedArticles?.length > 0 && (
          <div style={{ padding:'3rem 0' }}>
            <div className="container-sm">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1.5rem' }}>
                <div className="gold-bar" />
                <span className="label text-gold">More rulings</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {article.relatedArticles.map(r => {
                  const rv = VERDICT_CONFIG[r.verdict] || VERDICT_CONFIG.HOLD;
                  const rp = POS_COLORS[r.pos] || { bg:'rgba(156,163,175,0.15)', text:'#D1D5DB' };
                  return (
                    <Link key={r.slug} href={`/analysis/${r.slug}`} style={{ textDecoration:'none' }}>
                      <div className="card" style={{ padding:'1.25rem', display:'flex', alignItems:'center', gap:'1rem' }}>
                        <span className={`verdict ${rv.cls}`} style={{ flexShrink:0 }}>{rv.label}</span>
                        <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:4, fontSize:'0.7rem', fontWeight:700, background:rp.bg, color:rp.text, flexShrink:0 }}>{r.pos}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, marginBottom:2 }}>{r.player}</div>
                          <div style={{ fontSize:'0.875rem', color:'var(--text-muted)' }}>{r.excerpt}</div>
                        </div>
                        <span style={{ color:'var(--text-gold)', fontSize:'0.875rem', flexShrink:0 }}>Read →</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
