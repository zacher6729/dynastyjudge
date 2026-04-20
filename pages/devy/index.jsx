import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Nav from '../../components/Nav';
import { supabase } from '../../lib/supabase';

export default function DevyHub() {
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    supabase.from('devy_drafts')
      .select('id, name, status, num_teams, rounds, created_at, league_name')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setDrafts(data || []));
  }, []);

  const STATUS_STYLES = {
    setup:    { color:'#FBBF24', label:'Setup'    },
    active:   { color:'#4ADE80', label:'Live'     },
    paused:   { color:'#9CA3AF', label:'Paused'   },
    complete: { color:'#60A5FA', label:'Complete' },
  };

  return (
    <>
      <Head>
        <title>DevyJudge — Dynasty Recruit & Prospect Hub</title>
        <meta name="description" content="Dynasty devy draft app, prospect rankings, and recruiting coverage. Run your devy draft live with trades and real-time picks." />
      </Head>
      <Nav />

      <main style={{ minHeight:'100vh', paddingBottom:'4rem' }}>
        <div style={{ borderBottom:'0.5px solid var(--border-subtle)', padding:'2.5rem 0 2rem' }}>
          <div className="container">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div className="gold-bar" />
              <span className="label text-gold">DevyJudge</span>
            </div>
            <h1 className="display-md" style={{ marginBottom:8 }}>
              Devy dynasty, fully ruled.
            </h1>
            <p className="body-md" style={{ color:'var(--text-secondary)', maxWidth:520, marginBottom:'1.5rem' }}>
              The only dynasty platform built for devy. Live draft rooms, prospect rankings, class-by-class analysis, and recruiting coverage — all connected to your Sleeper leagues.
            </p>
            <Link href="/devy/new-draft" className="btn btn-primary">
              🏛 Start a devy draft →
            </Link>
          </div>
        </div>

        <div className="container" style={{ paddingTop:'2rem' }}>
          <div className="grid-3" style={{ marginBottom:'2.5rem' }}>
            {[
              { href:'/devy/new-draft', icon:'🏛', label:'Draft room', desc:'Live snake or linear devy draft with real-time picks, trades, and a post-draft Sleeper recap.' },
              { href:'/devy/prospects', icon:'📋', label:'Prospect rankings', desc:'Class-by-class devy rankings sorted by position, composite score, and dynasty value.' },
              { href:'/rankings?format=devy', icon:'⚖', label:'Devy consensus', desc:'DynastyJudge consensus devy rankings — editorial, community, and creator weighted.' },
            ].map(t => (
              <Link key={t.href} href={t.href} style={{ textDecoration:'none' }}>
                <div className="card" style={{ padding:'1.5rem', height:'100%', display:'flex', flexDirection:'column', gap:'1rem' }}>
                  <span style={{ fontSize:'1.75rem' }}>{t.icon}</span>
                  <div>
                    <h2 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>{t.label}</h2>
                    <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', lineHeight:1.6 }}>{t.desc}</p>
                  </div>
                  <div style={{ marginTop:'auto', fontSize:'0.8125rem', color:'var(--text-gold)' }}>Open →</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Recent drafts */}
          {drafts.length > 0 && (
            <>
              <h2 style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)', marginBottom:'0.875rem' }}>Recent drafts</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {drafts.map(d => {
                  const s = STATUS_STYLES[d.status] || STATUS_STYLES.setup;
                  return (
                    <Link key={d.id} href={`/devy/draft/${d.id}`} style={{ textDecoration:'none' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'1rem 1.25rem', background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', transition:'border-color .12s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-gold)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor='var(--border-subtle)'}
                      >
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>{d.name}</div>
                          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{d.league_name} · {d.num_teams} teams · {d.rounds} rounds</div>
                        </div>
                        <span style={{ fontSize:'0.75rem', padding:'2px 10px', borderRadius:99, background:`${s.color}20`, color:s.color, fontWeight:600, border:`0.5px solid ${s.color}40` }}>
                          {d.status === 'active' ? '● ' : ''}{s.label}
                        </span>
                        <span style={{ color:'var(--gold-400)', fontSize:'0.875rem' }}>Enter →</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
