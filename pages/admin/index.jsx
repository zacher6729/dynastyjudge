import Head from 'next/head';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../components/admin/AdminLayout';
import { supabase } from '../../lib/supabase';

export default function AdminHome() {
  const [stats, setStats] = useState({ users:0, players:0, boards:0, articles:0 });

  useEffect(() => {
    async function load() {
      const [users, players, boards, articles] = await Promise.all([
        supabase.from('profiles').select('id', { count:'exact', head:true }),
        supabase.from('players').select('id', { count:'exact', head:true }).eq('is_active', true),
        supabase.from('ranking_boards').select('id', { count:'exact', head:true }).eq('is_active', true),
        supabase.from('articles').select('id', { count:'exact', head:true }),
      ]);
      setStats({
        users:    users.count    || 0,
        players:  players.count  || 0,
        boards:   boards.count   || 0,
        articles: articles.count || 0,
      });
    }
    load();
  }, []);

  const STAT_CARDS = [
    { label:'Total members',    value: stats.users,    icon:'👥', href:'/admin/users',    color:'#185FA5' },
    { label:'Active players',   value: stats.players,  icon:'🏈', href:'/admin/players',  color:'#3B6D11' },
    { label:'Ranking boards',   value: stats.boards,   icon:'📋', href:'/admin/rankings', color:'#854F0B' },
    { label:'Articles',         value: stats.articles, icon:'✍', href:'/admin/content',  color:'#7C3AED' },
  ];

  const QUICK_ACTIONS = [
    { label:'Sync players from Sleeper', href:'/admin/players?action=sync',   icon:'🔄', desc:'Update player database from Sleeper API' },
    { label:'Publish editorial rankings', href:'/admin/rankings?format=1qb',  icon:'📋', desc:'Update your weekly dynasty rankings' },
    { label:'Write a ruling',            href:'/admin/content?action=new',    icon:'⚖',  desc:'New BUY / SELL / HOLD analysis' },
    { label:'Manage users',              href:'/admin/users',                 icon:'👥', desc:'View members, grant creator status' },
  ];

  return (
    <>
      <Head><title>Admin — DynastyJudge</title></Head>
      <AdminLayout title="Dashboard" activeHref="/admin">

        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:'2rem' }}>
          {STAT_CARDS.map(s => (
            <Link key={s.label} href={s.href} style={{ textDecoration:'none' }}>
              <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'1.25rem', cursor:'pointer', transition:'border-color .12s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = s.color}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
              >
                <div style={{ fontSize:'1.5rem', marginBottom:8 }}>{s.icon}</div>
                <div style={{ fontSize:'1.75rem', fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>{s.value.toLocaleString()}</div>
                <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{s.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <h2 style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-secondary)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.75rem' }}>
          Quick actions
        </h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:'2rem' }}>
          {QUICK_ACTIONS.map(a => (
            <Link key={a.label} href={a.href} style={{ textDecoration:'none' }}>
              <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'1rem 1.25rem', display:'flex', gap:12, alignItems:'flex-start', cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-gold)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
              >
                <span style={{ fontSize:'1.25rem', flexShrink:0 }}>{a.icon}</span>
                <div>
                  <div style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--text-primary)', marginBottom:3 }}>{a.label}</div>
                  <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)' }}>{a.desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Status */}
        <h2 style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-secondary)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.75rem' }}>
          System status
        </h2>
        <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'1rem 1.25rem' }}>
          {[
            { label:'Supabase database',    status:'connected', color:'#4ADE80' },
            { label:'Sleeper API',          status:'ready',     color:'#4ADE80' },
            { label:'Player sync',          status:'manual — run from Players page', color:'#FBBF24' },
            { label:'AI rankings job',      status:'not configured yet', color:'#94A3B8' },
            { label:'Consensus engine',     status:'active via DB trigger', color:'#4ADE80' },
          ].map((s,i,arr) => (
            <div key={s.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.625rem 0', borderBottom: i < arr.length-1 ? '0.5px solid var(--border-subtle)' : 'none' }}>
              <span style={{ fontSize:'0.875rem', color:'var(--text-secondary)' }}>{s.label}</span>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:s.color, display:'inline-block' }} />
                <span style={{ fontSize:'0.8125rem', color: s.color }}>{s.status}</span>
              </div>
            </div>
          ))}
        </div>

      </AdminLayout>
    </>
  );
}
