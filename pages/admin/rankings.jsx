import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { supabase } from '../../lib/supabase';

const FORMATS = [
  { id: '1qb',    label: '1QB'        },
  { id: 'sf',     label: 'SuperFlex'  },
  { id: 'teprem', label: 'TE Premium' },
  { id: 'devy',   label: 'Devy'       },
];

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE'];

const POS_COLORS = {
  QB: { bg: 'rgba(239,68,68,0.15)',  text: '#FCA5A5' },
  RB: { bg: 'rgba(34,197,94,0.15)', text: '#86EFAC' },
  WR: { bg: 'rgba(59,130,246,0.15)',text: '#93C5FD' },
  TE: { bg: 'rgba(251,191,36,0.15)',text: '#FDE68A' },
};

export default function AdminRankings() {
  const [format, setFormat]         = useState('1qb');
  const [board, setBoard]           = useState(null);
  const [entries, setEntries]       = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [posFilter, setPos]         = useState('ALL');
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [statusMsg, setStatusMsg]   = useState('');
  const [statusType, setStatusType] = useState('success');
  const [dirty, setDirty]           = useState(false);
  const [dragIdx, setDragIdx]       = useState(null);
  const [activeTab, setTab]         = useState('rankings');
  const [addSearch, setAddSearch]   = useState('');
  const [syncing, setSyncing]       = useState(false);

  function showStatus(msg, type = 'success', autoClear = true) {
    setStatusMsg(msg);
    setStatusType(type);
    if (autoClear) setTimeout(() => setStatusMsg(''), 4000);
  }

  // ── Load board via API route (service role, bypasses RLS) ────────────────────
  const loadBoard = useCallback(async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const res  = await fetch(`/api/admin/get-editorial-board?format=${format}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setBoard(data.board);
      setEntries(data.entries || []);
      setDirty(false);
    } catch (err) {
      showStatus(`Could not load board: ${err.message}`, 'error', false);
    }
    setLoading(false);
  }, [format]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // ── Load all players for the Add panel (read-only, anon key is fine) ─────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('players')
        .select('id, name, position, nfl_team, age, injury_status')
        .eq('is_active', true)
        .eq('is_devy', format === 'devy')
        .order('name')
        .limit(2000);
      setAllPlayers(data || []);
    }
    load();
  }, [format]);

  const rankedIds = new Set(entries.map(e => e.player?.id || e.player_id));

  const filteredEntries = entries.filter(e => {
    const p = e.player || {};
    if (posFilter !== 'ALL' && p.position !== posFilter) return false;
    if (search && !p.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const unrankedPlayers = allPlayers.filter(p => {
    if (rankedIds.has(p.id)) return false;
    if (addSearch && !p.name.toLowerCase().includes(addSearch.toLowerCase())) return false;
    return true;
  });

  // ── Edit helpers ─────────────────────────────────────────────────────────────
  function addPlayer(player) {
    setEntries(prev => [...prev, { player_id: player.id, player, rank: prev.length + 1, tier: null, note: '' }]);
    setDirty(true);
  }

  function removePlayer(realIdx) {
    setEntries(prev => prev.filter((_, i) => i !== realIdx).map((e, i) => ({ ...e, rank: i + 1 })));
    setDirty(true);
  }

  function movePlayer(realIdx, dir) {
    const target = realIdx + dir;
    if (target < 0 || target >= entries.length) return;
    setEntries(prev => {
      const next = [...prev];
      [next[realIdx], next[target]] = [next[target], next[realIdx]];
      return next.map((e, i) => ({ ...e, rank: i + 1 }));
    });
    setDirty(true);
  }

  function setRankByInput(realIdx, val) {
    const r = parseInt(val);
    if (isNaN(r) || r < 1 || r > entries.length) return;
    setEntries(prev => {
      const next = [...prev];
      const [moved] = next.splice(realIdx, 1);
      next.splice(r - 1, 0, moved);
      return next.map((e, i) => ({ ...e, rank: i + 1 }));
    });
    setDirty(true);
  }

  function updateField(realIdx, field, val) {
    setEntries(prev => prev.map((e, i) => i === realIdx ? { ...e, [field]: val } : e));
    setDirty(true);
  }

  // ── Drag ─────────────────────────────────────────────────────────────────────
  function onDragStart(idx) { setDragIdx(idx); }
  function onDragOver(e, idx) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setEntries(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      setDragIdx(idx);
      return next.map((e, i) => ({ ...e, rank: i + 1 }));
    });
  }
  function onDragEnd() { setDragIdx(null); setDirty(true); }

  // ── Save / Publish via API route ─────────────────────────────────────────────
  async function callSaveApi(publish) {
    if (!board?.id) throw new Error('No board loaded — try refreshing the page.');
    const payload = entries.map((e, i) => ({
      player_id: e.player?.id || e.player_id,
      rank:      i + 1,
      tier:      e.tier  || null,
      note:      e.note  || null,
    }));
    const res  = await fetch('/api/admin/save-rankings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ board_id: board.id, entries: payload, publish }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function handleSave() {
    if (!dirty) return;
    setSaving(true);
    try {
      await callSaveApi(false);
      setDirty(false);
      showStatus('✓ Draft saved — not yet public');
    } catch (err) {
      showStatus(`✗ Save failed: ${err.message}`, 'error', false);
    }
    setSaving(false);
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      await callSaveApi(true);
      setDirty(false);
      setBoard(prev => ({ ...prev, is_public: true, last_published_at: new Date().toISOString() }));
      showStatus('✓ Published live — rankings are now in the consensus');
    } catch (err) {
      showStatus(`✗ Publish failed: ${err.message}`, 'error', false);
    }
    setPublishing(false);
  }

  async function syncPlayers() {
    setSyncing(true);
    try {
      const res  = await fetch('/api/admin/sync-players', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const { data: players } = await supabase.from('players').select('id,name,position,nfl_team,age,injury_status').eq('is_active', true).order('name').limit(2000);
        setAllPlayers(players || []);
        showStatus(`✓ Synced ${data.count} players`);
      } else {
        showStatus(`✗ ${data.error}`, 'error', false);
      }
    } catch (e) {
      showStatus(`✗ ${e.message}`, 'error', false);
    }
    setSyncing(false);
  }

  const lastPublished = board?.last_published_at
    ? new Date(board.last_published_at).toLocaleString()
    : 'Never';

  return (
    <>
      <Head><title>Rankings — DynastyJudge Admin</title></Head>
      <AdminLayout title="Rankings manager" activeHref="/admin/rankings">

        {/* ── Top bar ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => { setFormat(f.id); setDirty(false); setStatusMsg(''); }} style={{ padding: '0.375rem 1rem', borderRadius: 'var(--radius-md)', border: format === f.id ? '0.5px solid var(--gold-500)' : '0.5px solid var(--border-default)', background: format === f.id ? 'rgba(200,151,58,0.12)' : 'transparent', color: format === f.id ? 'var(--gold-400)' : 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: format === f.id ? 600 : 400, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{f.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={syncPlayers} disabled={syncing} style={{ padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              {syncing ? '...' : '🔄 Sync players'}
            </button>
            <button onClick={handleSave} disabled={saving || !dirty} style={{ padding: '0.5rem 1.125rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: dirty ? 'var(--bg-secondary)' : 'transparent', color: dirty ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500, cursor: dirty && !saving ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-body)', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : '💾 Save draft'}
            </button>
            <button onClick={handlePublish} disabled={publishing} style={{ padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--gold-500)', color: 'var(--charcoal-900)', border: 'none', fontSize: '0.875rem', fontWeight: 700, cursor: publishing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: publishing ? 0.7 : 1 }}>
              {publishing ? 'Publishing...' : '🚀 Publish live'}
            </button>
          </div>
        </div>

        {/* Status banner */}
        {statusMsg && (
          <div style={{ marginBottom: '0.75rem', padding: '0.625rem 1rem', borderRadius: 'var(--radius-md)', background: statusType === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `0.5px solid ${statusType === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, color: statusType === 'error' ? '#F87171' : '#4ADE80', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', opacity: 0.7 }}>✕</button>
          </div>
        )}

        {/* Board meta */}
        {!loading && (
          <div style={{ display: 'flex', gap: 16, marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span>{entries.length} players ranked</span>
            <span>·</span>
            <span>Last published: {lastPublished}</span>
            <span>·</span>
            <span style={{ color: board?.is_public ? '#4ADE80' : 'var(--text-muted)' }}>
              {board?.is_public ? '● Live in consensus' : '○ Draft — not yet public'}
            </span>
            {dirty && <span style={{ color: '#FBBF24' }}>· Unsaved changes</span>}
          </div>
        )}

        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Loading rankings...
          </div>
        )}

        {!loading && (
          <>
            {/* Sub tabs */}
            <div style={{ display: 'flex', gap: 0, border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1rem', width: 'fit-content' }}>
              {[['rankings', '📋 Rankings editor'], [`add_players`, `+ Add players (${unrankedPlayers.length})`]].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{ padding: '0.5rem 1.125rem', background: activeTab === id ? 'var(--bg-secondary)' : 'transparent', color: activeTab === id ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', borderRight: id === 'rankings' ? '0.5px solid var(--border-default)' : 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: activeTab === id ? 600 : 400 }}>{label}</button>
              ))}
            </div>

            {/* ── Rankings editor ── */}
            {activeTab === 'rankings' && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {POSITIONS.map(p => (
                    <button key={p} onClick={() => setPos(p)} style={{ padding: '0.3rem 0.75rem', borderRadius: 99, border: posFilter === p ? '0.5px solid var(--border-gold)' : '0.5px solid var(--border-subtle)', background: posFilter === p ? 'rgba(200,151,58,0.1)' : 'transparent', color: posFilter === p ? 'var(--gold-400)' : 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{p}</button>
                  ))}
                  <input type="text" placeholder="Search ranked players..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'var(--font-body)', outline: 'none', maxWidth: 200 }} />
                  <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{filteredEntries.length} of {entries.length}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '32px 52px 1fr 68px 52px 100px 84px 32px', padding: '0.5rem 0.75rem', borderBottom: '0.5px solid var(--border-default)', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <span/><span>Rank</span><span>Player</span><span style={{textAlign:'center'}}>Pos</span><span style={{textAlign:'center'}}>Tier</span><span>Note</span><span style={{textAlign:'center'}}>Move</span><span/>
                </div>

                {entries.length === 0 && (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No players ranked yet. Switch to "Add players" to build your board.
                  </div>
                )}

                {filteredEntries.map(entry => {
                  const realIdx = entries.indexOf(entry);
                  const p = entry.player || {};
                  const pos = POS_COLORS[p.position] || { bg: 'rgba(156,163,175,0.15)', text: '#D1D5DB' };
                  const isDragging = dragIdx === realIdx;
                  return (
                    <div key={p.id || realIdx} draggable onDragStart={() => onDragStart(realIdx)} onDragOver={e => onDragOver(e, realIdx)} onDragEnd={onDragEnd}
                      style={{ display: 'grid', gridTemplateColumns: '32px 52px 1fr 68px 52px 100px 84px 32px', padding: '0.5rem 0.75rem', borderBottom: '0.5px solid var(--border-subtle)', alignItems: 'center', background: isDragging ? 'rgba(200,151,58,0.06)' : 'transparent', opacity: isDragging ? 0.5 : 1, cursor: 'grab', transition: 'background .1s' }}
                      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={e => { if (!isDragging) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ color: 'var(--text-muted)', userSelect: 'none' }}>⠿</span>
                      <input type="number" value={entry.rank} min={1} max={entries.length} onChange={e => setRankByInput(realIdx, e.target.value)} style={{ width: 40, padding: '2px 4px', background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 600, textAlign: 'center', fontFamily: 'var(--font-body)', outline: 'none' }} />
                      <div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>{p.nfl_team}</span>
                        {p.injury_status && <span style={{ fontSize: '0.7rem', color: '#F87171', marginLeft: 6 }}>{p.injury_status}</span>}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, background: pos.bg, color: pos.text }}>{p.position}</span>
                      </div>
                      <input type="number" min={1} max={10} placeholder="—" value={entry.tier || ''} onChange={e => updateField(realIdx, 'tier', parseInt(e.target.value) || null)} style={{ width: 44, padding: '2px 4px', background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center', fontFamily: 'var(--font-body)', outline: 'none' }} />
                      <input type="text" placeholder="Note..." value={entry.note || ''} onChange={e => updateField(realIdx, 'note', e.target.value)} style={{ width: '100%', padding: '2px 6px', background: 'var(--bg-tertiary)', border: '0.5px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
                      <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                        <button onClick={() => movePlayer(realIdx, -1)} style={{ width: 26, height: 26, borderRadius: 4, border: '0.5px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>▲</button>
                        <button onClick={() => movePlayer(realIdx, +1)} style={{ width: 26, height: 26, borderRadius: 4, border: '0.5px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>▼</button>
                      </div>
                      <button onClick={() => removePlayer(realIdx)} style={{ width: 28, height: 28, borderRadius: 4, border: '0.5px solid var(--border-subtle)', background: 'transparent', color: '#F87171', cursor: 'pointer', fontSize: '0.875rem' }}>✕</button>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Add players ── */}
            {activeTab === 'add_players' && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', alignItems: 'center' }}>
                  <input type="text" placeholder="Search players to add..." value={addSearch} onChange={e => setAddSearch(e.target.value)} style={{ flex: 1, maxWidth: 360, padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{unrankedPlayers.length} unranked</span>
                </div>
                {allPlayers.length === 0 && (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No players in database. Go to Admin → Players and run Sync from Sleeper first.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {unrankedPlayers.slice(0, 150).map(p => {
                    const pos = POS_COLORS[p.position] || { bg: 'rgba(156,163,175,0.15)', text: '#D1D5DB' };
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.625rem 0.875rem', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
                        <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, background: pos.bg, color: pos.text, flexShrink: 0 }}>{p.position}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.nfl_team}{p.age ? ` · ${p.age}` : ''}</div>
                        </div>
                        <button onClick={() => addPlayer(p)} style={{ padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(200,151,58,0.15)', color: 'var(--gold-400)', border: '0.5px solid var(--border-gold)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0 }}>+ Add</button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

      </AdminLayout>
    </>
  );
}
