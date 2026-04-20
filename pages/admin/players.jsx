import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { supabase } from '../../lib/supabase';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K'];

const POS_COLORS = {
  QB: { bg: 'rgba(239,68,68,0.15)',  text: '#FCA5A5' },
  RB: { bg: 'rgba(34,197,94,0.15)', text: '#86EFAC' },
  WR: { bg: 'rgba(59,130,246,0.15)',text: '#93C5FD' },
  TE: { bg: 'rgba(251,191,36,0.15)',text: '#FDE68A' },
  K:  { bg: 'rgba(156,163,175,0.15)',text: '#D1D5DB' },
};

const PER_PAGE = 50;

export default function AdminPlayers() {
  const [players, setPlayers] = useState([]);
  const [total, setTotal]     = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [search, setSearch]   = useState('');
  const [posFilter, setPos]   = useState('ALL');
  const [page, setPage]       = useState(0);

  const loadPlayers = useCallback(async () => {
    let q = supabase
      .from('players')
      .select('id,name,position,nfl_team,age,status,injury_status,updated_at', { count: 'exact' })
      .eq('is_active', true)
      .order('name')
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1);

    if (posFilter !== 'ALL') q = q.eq('position', posFilter);
    if (search) q = q.ilike('name', `%${search}%`);

    const { data, count, error } = await q;
    if (!error) {
      setPlayers(data || []);
      setTotal(count || 0);
    }
  }, [page, posFilter, search]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  async function syncFromSleeper() {
    setSyncing(true);
    setSyncMsg('Fetching from Sleeper...');
    try {
      const res  = await fetch('/api/admin/sync-players', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncMsg(`✓ Synced ${data.count} players successfully.`);
        setPage(0);
        setPos('ALL');
        setSearch('');
        setTimeout(() => loadPlayers(), 800);
      } else {
        setSyncMsg(`✗ ${data.error}`);
      }
    } catch (e) {
      setSyncMsg(`✗ ${e.message}`);
    }
    setSyncing(false);
  }

  return (
    <>
      <Head><title>Players — DynastyJudge Admin</title></Head>
      <AdminLayout title="Player database" activeHref="/admin/players">

        {/* Sync bar */}
        <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Sleeper player sync
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {total > 0
                ? `${total.toLocaleString()} active players in database.`
                : 'No players yet — click Sync to populate.'}
              {syncMsg && (
                <span style={{ marginLeft: 8, color: syncMsg.startsWith('✓') ? '#4ADE80' : '#F87171' }}>
                  {syncMsg}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={loadPlayers}
              style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Refresh
            </button>
            <button
              onClick={syncFromSleeper}
              disabled={syncing}
              style={{ padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)', background: syncing ? 'var(--bg-tertiary)' : 'var(--gold-500)', color: syncing ? 'var(--text-muted)' : 'var(--charcoal-900)', border: 'none', fontSize: '0.875rem', fontWeight: 700, cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)' }}>
              {syncing ? '⏳ Syncing...' : '🔄 Sync from Sleeper'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {POSITIONS.map(p => (
            <button
              key={p}
              onClick={() => { setPos(p); setPage(0); }}
              style={{ padding: '0.3rem 0.75rem', borderRadius: 99, border: posFilter === p ? '0.5px solid var(--border-gold)' : '0.5px solid var(--border-subtle)', background: posFilter === p ? 'rgba(200,151,58,0.1)' : 'transparent', color: posFilter === p ? 'var(--gold-400)' : 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              {p}
            </button>
          ))}
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            style={{ padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'var(--font-body)', outline: 'none', maxWidth: 220 }}
          />
          <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {total.toLocaleString()} players
          </span>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 64px 56px 130px 100px', padding: '0.5rem 0.875rem', borderBottom: '0.5px solid var(--border-default)', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span>Player</span>
          <span style={{ textAlign: 'center' }}>Pos</span>
          <span style={{ textAlign: 'center' }}>Team</span>
          <span style={{ textAlign: 'center' }}>Age</span>
          <span>Status</span>
          <span>Updated</span>
        </div>

        {/* Empty state */}
        {players.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {total === 0
              ? 'No players in database yet. Click "Sync from Sleeper" to populate.'
              : 'No players match your filter.'}
          </div>
        )}

        {/* Rows */}
        {players.map(p => {
          const pos = POS_COLORS[p.position] || { bg: 'rgba(156,163,175,0.15)', text: '#D1D5DB' };
          return (
            <div
              key={p.id}
              style={{ display: 'grid', gridTemplateColumns: '1fr 80px 64px 56px 130px 100px', padding: '0.625rem 0.875rem', borderBottom: '0.5px solid var(--border-subtle)', alignItems: 'center', transition: 'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, background: pos.bg, color: pos.text }}>{p.position}</span>
              </div>
              <span style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{p.nfl_team || '—'}</span>
              <span style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{p.age || '—'}</span>
              <div>
                {p.injury_status
                  ? <span style={{ fontSize: '0.75rem', color: '#F87171', fontWeight: 500 }}>{p.injury_status}</span>
                  : <span style={{ fontSize: '0.75rem', color: '#4ADE80' }}>{p.status || 'Active'}</span>
                }
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}
              </span>
            </div>
          );
        })}

        {/* Pagination */}
        {total > PER_PAGE && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.75rem 0' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'transparent', color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
              ← Previous
            </button>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Page {page + 1} of {Math.max(1, Math.ceil(total / PER_PAGE))}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * PER_PAGE >= total}
              style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'transparent', color: (page + 1) * PER_PAGE >= total ? 'var(--text-muted)' : 'var(--text-primary)', cursor: (page + 1) * PER_PAGE >= total ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
              Next →
            </button>
          </div>
        )}

      </AdminLayout>
    </>
  );
}
