import Head from 'next/head';
import { useState } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';

// ── Mock rankings data (replace with DB/API later) ────────────────────────────
const RANKINGS = {
  '1qb': [
    { rank:1,  name:'Christian McCaffrey', pos:'RB', team:'SF',  age:27, trend:'up',   value:9950, tier:1 },
    { rank:2,  name:'CeeDee Lamb',         pos:'WR', team:'DAL', age:25, trend:'up',   value:9820, tier:1 },
    { rank:3,  name:'Ja\'Marr Chase',      pos:'WR', team:'CIN', age:25, trend:'hold', value:9700, tier:1 },
    { rank:4,  name:'Justin Jefferson',    pos:'WR', team:'MIN', age:26, trend:'hold', value:9600, tier:1 },
    { rank:5,  name:'Tyreek Hill',         pos:'WR', team:'MIA', age:32, trend:'down', value:9100, tier:2 },
    { rank:6,  name:'Bijan Robinson',      pos:'RB', team:'ATL', age:23, trend:'up',   value:9050, tier:2 },
    { rank:7,  name:'Amon-Ra St. Brown',   pos:'WR', team:'DET', age:25, trend:'up',   value:8900, tier:2 },
    { rank:8,  name:'Sam LaPorta',         pos:'TE', team:'DET', age:24, trend:'up',   value:8750, tier:2 },
    { rank:9,  name:'Breece Hall',         pos:'RB', team:'NYJ', age:24, trend:'hold', value:8600, tier:2 },
    { rank:10, name:'Drake London',        pos:'WR', team:'ATL', age:24, trend:'up',   value:8500, tier:2 },
    { rank:11, name:'Puka Nacua',          pos:'WR', team:'LAR', age:24, trend:'up',   value:8300, tier:3 },
    { rank:12, name:'Jaylen Waddle',       pos:'WR', team:'MIA', age:26, trend:'hold', value:8100, tier:3 },
    { rank:13, name:'Josh Allen',          pos:'QB', team:'BUF', age:29, trend:'hold', value:7950, tier:3 },
    { rank:14, name:'Lamar Jackson',       pos:'QB', team:'BAL', age:28, trend:'hold', value:7900, tier:3 },
    { rank:15, name:'Tony Pollard',        pos:'RB', team:'TEN', age:28, trend:'down', value:7400, tier:3 },
    { rank:16, name:'Garrett Wilson',      pos:'WR', team:'NYJ', age:25, trend:'up',   value:7300, tier:3 },
    { rank:17, name:'Isiah Pacheco',       pos:'RB', team:'KC',  age:26, trend:'hold', value:7200, tier:3 },
    { rank:18, name:'Jordan Addison',      pos:'WR', team:'MIN', age:23, trend:'up',   value:7100, tier:3 },
    { rank:19, name:'Tee Higgins',         pos:'WR', team:'CIN', age:26, trend:'hold', value:6950, tier:4 },
    { rank:20, name:'De\'Von Achane',      pos:'RB', team:'MIA', age:23, trend:'up',   value:6900, tier:4 },
    { rank:21, name:'George Kittle',       pos:'TE', team:'SF',  age:31, trend:'hold', value:6750, tier:4 },
    { rank:22, name:'Davante Adams',       pos:'WR', team:'LV',  age:32, trend:'down', value:6500, tier:4 },
    { rank:23, name:'Najee Harris',        pos:'RB', team:'PIT', age:27, trend:'down', value:6200, tier:4 },
    { rank:24, name:'Mark Andrews',        pos:'TE', team:'BAL', age:29, trend:'hold', value:6100, tier:4 },
    { rank:25, name:'Austin Ekeler',       pos:'RB', team:'LAC', age:29, trend:'down', value:5950, tier:4 },
  ],
  'sf': [],
  'teprem': [],
};

// Duplicate SF and TEP with slight value adjustments for demo
RANKINGS.sf     = RANKINGS['1qb'].map((p,i) => ({...p, rank: i+1, value: p.pos === 'QB' ? p.value + 800 : p.value})).sort((a,b) => b.value - a.value).map((p,i) => ({...p, rank: i+1}));
RANKINGS.teprem = RANKINGS['1qb'].map((p,i) => ({...p, rank: i+1, value: p.pos === 'TE' ? p.value + 600 : p.value})).sort((a,b) => b.value - a.value).map((p,i) => ({...p, rank: i+1}));

const TIERS = { 1:'Elite', 2:'Tier 1', 3:'Tier 2', 4:'Tier 3' };
const TIER_COLORS = { 1:'#C8973A', 2:'#4ADE80', 3:'#60A5FA', 4:'#A78BFA' };

const POS_COLORS = {
  QB: { bg:'rgba(239,68,68,0.15)',   text:'#FCA5A5' },
  RB: { bg:'rgba(34,197,94,0.15)',   text:'#86EFAC' },
  WR: { bg:'rgba(59,130,246,0.15)',  text:'#93C5FD' },
  TE: { bg:'rgba(251,191,36,0.15)',  text:'#FDE68A' },
};

const TREND_ICON = { up:'▲', down:'▼', hold:'◆' };
const TREND_COLOR = { up:'#4ADE80', down:'#F87171', hold:'#94A3B8' };

const FORMATS = [
  { id:'1qb',    label:'1QB',     desc:'Standard one-quarterback format' },
  { id:'sf',     label:'SuperFlex', desc:'2QB / SuperFlex leagues' },
  { id:'teprem', label:'TE Premium', desc:'TE premium scoring (1.5x or 2x)' },
];

const POS_FILTERS = ['ALL','QB','RB','WR','TE'];

export default function Rankings() {
  const [format, setFormat]   = useState('1qb');
  const [posFilter, setPos]   = useState('ALL');
  const [search, setSearch]   = useState('');
  const [showTiers, setTiers] = useState(true);

  const data = RANKINGS[format] || [];
  const filtered = data.filter(p => {
    if (posFilter !== 'ALL' && p.pos !== posFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by tier if showing tiers
  const grouped = {};
  if (showTiers) {
    filtered.forEach(p => {
      if (!grouped[p.tier]) grouped[p.tier] = [];
      grouped[p.tier].push(p);
    });
  }

  return (
    <>
      <Head>
        <title>Dynasty Rankings 2026 — DynastyJudge</title>
        <meta name="description" content="Dynasty fantasy football rankings for 2026. 1QB, SuperFlex, and TE Premium formats. Updated weekly by the DynastyJudge team." />
      </Head>
      <Nav />

      <main style={{ minHeight: '100vh', paddingBottom: '4rem' }}>

        {/* ── Page header ── */}
        <div style={{ borderBottom: '0.5px solid var(--border-subtle)', padding: '2.5rem 0 2rem' }}>
          <div className="container">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div className="gold-bar" />
              <span className="label text-gold">The Docket</span>
            </div>
            <h1 className="display-md" style={{ marginBottom:8 }}>Dynasty Rankings</h1>
            <p className="body-md" style={{ color:'var(--text-secondary)', maxWidth:540 }}>
              Updated weekly. Values reflect dynasty trade market, not redraft. Tiers set by the Judge panel.
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:12, fontSize:'0.8125rem', color:'var(--text-muted)' }}>
              <span>Last updated: April 19, 2026</span>
              <span style={{ width:4, height:4, borderRadius:'50%', background:'var(--charcoal-500)', display:'inline-block' }} />
              <span>25 players shown — <Link href="/subscribe" style={{ color:'var(--text-gold)' }}>Elite unlocks full 300+</Link></span>
            </div>
          </div>
        </div>

        <div className="container" style={{ paddingTop:'1.5rem' }}>

          {/* ── Format tabs ── */}
          <div style={{ display:'flex', gap:8, marginBottom:'1.25rem', flexWrap:'wrap' }}>
            {FORMATS.map(f => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                style={{
                  padding:'0.5rem 1.25rem',
                  borderRadius:'var(--radius-md)',
                  border: format === f.id ? '0.5px solid var(--gold-500)' : '0.5px solid var(--border-default)',
                  background: format === f.id ? 'rgba(200,151,58,0.12)' : 'transparent',
                  color: format === f.id ? 'var(--gold-400)' : 'var(--text-secondary)',
                  fontSize:'0.875rem', fontWeight: format === f.id ? 600 : 400,
                  cursor:'pointer', fontFamily:'var(--font-body)',
                }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* ── Controls row ── */}
          <div style={{ display:'flex', gap:10, marginBottom:'1.25rem', flexWrap:'wrap', alignItems:'center' }}>
            {/* Position filter */}
            <div style={{ display:'flex', gap:6 }}>
              {POS_FILTERS.map(p => (
                <button
                  key={p}
                  onClick={() => setPos(p)}
                  style={{
                    padding:'0.375rem 0.875rem',
                    borderRadius:99,
                    border: posFilter === p ? '0.5px solid var(--border-gold)' : '0.5px solid var(--border-subtle)',
                    background: posFilter === p ? 'rgba(200,151,58,0.1)' : 'transparent',
                    color: posFilter === p ? 'var(--gold-400)' : 'var(--text-muted)',
                    fontSize:'0.8125rem', fontWeight: posFilter === p ? 600 : 400,
                    cursor:'pointer', fontFamily:'var(--font-body)',
                  }}>
                  {p}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search player..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex:1, maxWidth:240,
                padding:'0.375rem 0.875rem',
                borderRadius:'var(--radius-md)',
                border:'0.5px solid var(--border-default)',
                background:'var(--bg-secondary)',
                color:'var(--text-primary)',
                fontSize:'0.875rem',
                fontFamily:'var(--font-body)',
                outline:'none',
              }}
            />

            {/* Tier toggle */}
            <button
              onClick={() => setTiers(!showTiers)}
              style={{
                padding:'0.375rem 0.875rem',
                borderRadius:99,
                border:'0.5px solid var(--border-subtle)',
                background: showTiers ? 'rgba(200,151,58,0.1)' : 'transparent',
                color: showTiers ? 'var(--gold-400)' : 'var(--text-muted)',
                fontSize:'0.8125rem',
                cursor:'pointer', fontFamily:'var(--font-body)',
              }}>
              {showTiers ? '◈ Tiers on' : '◈ Tiers off'}
            </button>

            <span style={{ marginLeft:'auto', fontSize:'0.8125rem', color:'var(--text-muted)' }}>
              {filtered.length} players
            </span>
          </div>

          {/* ── Table header ── */}
          <div style={{
            display:'grid',
            gridTemplateColumns:'52px 1fr 80px 60px 60px 80px 100px',
            gap:0,
            padding:'0.5rem 1rem',
            borderBottom:'0.5px solid var(--border-default)',
            fontSize:'0.75rem',
            fontWeight:600,
            color:'var(--text-muted)',
            letterSpacing:'0.06em',
            textTransform:'uppercase',
          }}>
            <span>Rank</span>
            <span>Player</span>
            <span style={{textAlign:'center'}}>Pos</span>
            <span style={{textAlign:'center'}}>Team</span>
            <span style={{textAlign:'center'}}>Age</span>
            <span style={{textAlign:'center'}}>Trend</span>
            <span style={{textAlign:'right'}}>Value</span>
          </div>

          {/* ── Rows ── */}
          {showTiers
            ? Object.entries(grouped).map(([tier, players]) => (
                <div key={tier}>
                  {/* Tier label */}
                  <div style={{
                    padding:'0.5rem 1rem',
                    marginTop:'0.5rem',
                    display:'flex', alignItems:'center', gap:10,
                    borderLeft:`3px solid ${TIER_COLORS[tier]}`,
                  }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:700, color: TIER_COLORS[tier], letterSpacing:'0.06em' }}>
                      {TIERS[tier]}
                    </span>
                    <div style={{ flex:1, height:'0.5px', background:'var(--border-subtle)' }} />
                  </div>
                  {players.map(p => <PlayerRow key={p.rank + p.name} player={p} />)}
                </div>
              ))
            : filtered.map(p => <PlayerRow key={p.rank + p.name} player={p} />)
          }

          {/* ── Paywall banner ── */}
          <div style={{
            marginTop:'1.5rem',
            border:'0.5px solid var(--border-gold)',
            borderRadius:'var(--radius-lg)',
            padding:'2rem',
            textAlign:'center',
            background:'rgba(200,151,58,0.05)',
          }}>
            <div style={{ fontSize:'1.5rem', marginBottom:8 }}>⚖</div>
            <h3 className="heading-lg" style={{ marginBottom:8 }}>275 more players in the full docket</h3>
            <p className="body-md" style={{ color:'var(--text-secondary)', maxWidth:480, margin:'0 auto 1.5rem' }}>
              Judge Elite unlocks the complete 300-player rankings across all formats, plus weekly updates, trade grades, and Sleeper league integration.
            </p>
            <Link href="/subscribe" className="btn btn-primary">Unlock Judge Elite — $12.99/mo</Link>
            <p style={{ marginTop:'0.75rem', fontSize:'0.8125rem', color:'var(--text-muted)' }}>Annual plan available at $99/yr · Cancel anytime</p>
          </div>

        </div>
      </main>
    </>
  );
}

function PlayerRow({ player: p }) {
  const pos = POS_COLORS[p.pos] || { bg:'rgba(156,163,175,0.15)', text:'#D1D5DB' };
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'52px 1fr 80px 60px 60px 80px 100px',
      gap:0,
      padding:'0.75rem 1rem',
      borderBottom:'0.5px solid var(--border-subtle)',
      alignItems:'center',
      transition:'background 0.1s',
      cursor:'pointer',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Rank */}
      <span style={{
        fontSize:'0.9375rem', fontWeight:600,
        color: p.rank <= 3 ? 'var(--gold-400)' : 'var(--text-muted)',
      }}>
        {p.rank}
      </span>

      {/* Name */}
      <div>
        <span style={{ fontSize:'0.9375rem', fontWeight:500, color:'var(--text-primary)' }}>
          {p.name}
        </span>
      </div>

      {/* Pos */}
      <div style={{ textAlign:'center' }}>
        <span style={{
          display:'inline-block',
          padding:'2px 8px',
          borderRadius:4,
          fontSize:'0.75rem',
          fontWeight:700,
          background: pos.bg,
          color: pos.text,
        }}>
          {p.pos}
        </span>
      </div>

      {/* Team */}
      <span style={{ textAlign:'center', fontSize:'0.875rem', color:'var(--text-secondary)' }}>
        {p.team}
      </span>

      {/* Age */}
      <span style={{ textAlign:'center', fontSize:'0.875rem', color:'var(--text-muted)' }}>
        {p.age}
      </span>

      {/* Trend */}
      <span style={{ textAlign:'center', fontSize:'0.875rem', color: TREND_COLOR[p.trend], fontWeight:600 }}>
        {TREND_ICON[p.trend]}
      </span>

      {/* Value */}
      <span style={{ textAlign:'right', fontSize:'0.875rem', fontWeight:600, color:'var(--text-secondary)', fontVariantNumeric:'tabular-nums' }}>
        {p.value.toLocaleString()}
      </span>
    </div>
  );
}
