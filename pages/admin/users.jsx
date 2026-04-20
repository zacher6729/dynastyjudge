import Head from 'next/head';
import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { supabase } from '../../lib/supabase';

const TIERS = ['free','pro','elite','creator','admin'];
const TIER_COLORS = {
  free:   { bg:'rgba(156,163,175,0.15)', text:'#9CA3AF' },
  pro:    { bg:'rgba(59,130,246,0.15)',  text:'#93C5FD' },
  elite:  { bg:'rgba(200,151,58,0.15)', text:'#E0AA48' },
  creator:{ bg:'rgba(139,92,246,0.15)', text:'#C4B5FD' },
  admin:  { bg:'rgba(239,68,68,0.15)',  text:'#FCA5A5' },
};

export default function AdminUsers() {
  const [users, setUsers]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState('');
  const [tierFilter, setTier] = useState('ALL');
  const [updating, setUpd]    = useState(null);

  useEffect(() => { loadUsers(); }, [search, tierFilter]);

  async function loadUsers() {
    let q = supabase
      .from('profiles')
      .select('id,username,display_name,tier,is_creator,rankings_count,created_at', { count:'exact' })
      .order('created_at', { ascending:false })
      .limit(100);
    if (tierFilter !== 'ALL') q = q.eq('tier', tierFilter);
    if (search) q = q.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
    const { data, count } = await q;
    setUsers(data || []);
    setTotal(count || 0);
  }

  async function updateTier(userId, tier) {
    setUpd(userId);
    await supabase.from('profiles').update({ tier }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier } : u));
    setUpd(null);
  }

  async function toggleCreator(userId, isCreator) {
    setUpd(userId);
    await supabase.from('profiles').update({ is_creator: !isCreator }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_creator: !isCreator } : u));
    setUpd(null);
  }

  return (
    <>
      <Head><title>Users Admin — DynastyJudge</title></Head>
      <AdminLayout title="User management" activeHref="/admin/users">

        {/* Stats row */}
        <div style={{ display:'flex', gap:10, marginBottom:'1.5rem', flexWrap:'wrap' }}>
          {['free','pro','elite','creator','admin'].map(t => {
            const count = users.filter(u => u.tier === t).length;
            const tc = TIER_COLORS[t];
            return (
              <div key={t} style={{ padding:'0.75rem 1.25rem', borderRadius:'var(--radius-md)', background: tc.bg, border:`0.5px solid ${tc.text}30` }}>
                <div style={{ fontSize:'1.25rem', fontWeight:700, color:tc.text }}>{count}</div>
                <div style={{ fontSize:'0.75rem', color:tc.text, textTransform:'capitalize' }}>{t}</div>
              </div>
            );
          })}
          <div style={{ padding:'0.75rem 1.25rem', borderRadius:'var(--radius-md)', background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)' }}>
            <div style={{ fontSize:'1.25rem', fontWeight:700, color:'var(--text-primary)' }}>{total}</div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Total shown</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:8, marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' }}>
          {['ALL',...TIERS].map(t => (
            <button key={t} onClick={() => setTier(t)} style={{
              padding:'0.3rem 0.75rem', borderRadius:99,
              border: tierFilter === t ? '0.5px solid var(--border-gold)' : '0.5px solid var(--border-subtle)',
              background: tierFilter === t ? 'rgba(200,151,58,0.1)' : 'transparent',
              color: tierFilter === t ? 'var(--gold-400)' : 'var(--text-muted)',
              fontSize:'0.8125rem', cursor:'pointer', fontFamily:'var(--font-body)',
              textTransform:'capitalize',
            }}>{t}</button>
          ))}
          <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding:'0.3rem 0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:'0.8125rem', fontFamily:'var(--font-body)', outline:'none', maxWidth:220 }} />
        </div>

        {/* Table header */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 80px 80px 120px 80px', gap:0, padding:'0.5rem 0.875rem', borderBottom:'0.5px solid var(--border-default)', fontSize:'0.7rem', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
          <span>User</span>
          <span style={{textAlign:'center'}}>Tier</span>
          <span style={{textAlign:'center'}}>Boards</span>
          <span style={{textAlign:'center'}}>Creator</span>
          <span>Change tier</span>
          <span>Joined</span>
        </div>

        {users.map(u => {
          const tc = TIER_COLORS[u.tier] || TIER_COLORS.free;
          return (
            <div key={u.id} style={{ display:'grid', gridTemplateColumns:'1fr 100px 80px 80px 120px 80px', gap:0, padding:'0.625rem 0.875rem', borderBottom:'0.5px solid var(--border-subtle)', alignItems:'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <div style={{ fontSize:'0.875rem', fontWeight:500, color:'var(--text-primary)' }}>{u.display_name || u.username}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>@{u.username}</div>
              </div>

              <div style={{textAlign:'center'}}>
                <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:99, fontSize:'0.7rem', fontWeight:600, background:tc.bg, color:tc.text }}>{u.tier}</span>
              </div>

              <span style={{ textAlign:'center', fontSize:'0.875rem', color:'var(--text-muted)' }}>{u.rankings_count || 0}</span>

              <div style={{textAlign:'center'}}>
                <button onClick={() => toggleCreator(u.id, u.is_creator)} disabled={updating === u.id} style={{
                  padding:'2px 8px', borderRadius:99, fontSize:'0.7rem', fontWeight:600,
                  background: u.is_creator ? 'rgba(139,92,246,0.15)' : 'var(--bg-tertiary)',
                  color: u.is_creator ? '#C4B5FD' : 'var(--text-muted)',
                  border: u.is_creator ? '0.5px solid rgba(139,92,246,0.3)' : '0.5px solid var(--border-subtle)',
                  cursor:'pointer', fontFamily:'var(--font-body)',
                }}>
                  {u.is_creator ? '✓ Creator' : 'Grant'}
                </button>
              </div>

              <select
                value={u.tier}
                onChange={e => updateTier(u.id, e.target.value)}
                disabled={updating === u.id}
                style={{ padding:'4px 8px', borderRadius:'var(--radius-sm)', border:'0.5px solid var(--border-default)', background:'var(--bg-tertiary)', color:'var(--text-secondary)', fontSize:'0.8125rem', fontFamily:'var(--font-body)', cursor:'pointer', outline:'none' }}
              >
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          );
        })}

      </AdminLayout>
    </>
  );
}
