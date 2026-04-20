import Head from 'next/head';
import { useState, useEffect } from 'react';
import Nav from '../../components/Nav';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

const POS_COLORS = {
  QB: { bg:'rgba(239,68,68,0.15)',  text:'#FCA5A5' },
  RB: { bg:'rgba(34,197,94,0.15)', text:'#86EFAC' },
  WR: { bg:'rgba(59,130,246,0.15)',text:'#93C5FD' },
  TE: { bg:'rgba(251,191,36,0.15)',text:'#FDE68A' },
  K:  { bg:'rgba(156,163,175,0.15)',text:'#D1D5DB' },
};

export default function DraftQueue() {
  const [queue, setQueue]         = useState([]); // ordered list of players
  const [source, setSource]       = useState('my-rankings'); // my-rankings | editorial | manual
  const [format, setFormat]       = useState('1qb');
  const [posFilter, setPos]       = useState('ALL');
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [allPlayers, setAllPlayers] = useState([]);
  const [copied, setCopied]       = useState(false);
  const [dragIdx, setDragIdx]     = useState(null);
  const [session, setSession]     = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { s } }) => setSession(s));
    // Load player list
    const cached = sessionStorage.getItem('sleeper_players');
    if (cached) {
      const map = JSON.parse(cached);
      const list = Object.entries(map)
        .filter(([, p]) => p.active && ['QB','RB','WR','TE','K'].includes(p.position) && p.team && p.full_name)
        .map(([id, p]) => ({ sleeper_id: id, name: p.full_name, position: p.position, nfl_team: p.team, age: p.age }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setAllPlayers(list);
    } else {
      fetch('https://api.sleeper.app/v1/players/nfl')
        .then(r => r.json())
        .then(map => {
          sessionStorage.setItem('sleeper_players', JSON.stringify(map));
          const list = Object.entries(map)
            .filter(([, p]) => p.active && ['QB','RB','WR','TE','K'].includes(p.position) && p.team && p.full_name)
            .map(([id, p]) => ({ sleeper_id: id, name: p.full_name, position: p.position, nfl_team: p.team, age: p.age }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setAllPlayers(list);
        });
    }
  }, []);

  // Load rankings from Supabase as starting queue
  async function loadFromRankings(type) {
    setLoading(true);
    try {
      let boardQuery = supabase
        .from('ranking_boards')
        .select('id')
        .eq('format', format)
        .eq('is_active', true);

      if (type === 'editorial') boardQuery = boardQuery.eq('type', 'editorial');
      else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { alert('Sign in to load your personal rankings.'); setLoading(false); return; }
        boardQuery = boardQuery.eq('type', 'community').eq('owner_id', session.user.id);
      }

      const { data: boards } = await boardQuery.limit(1);
      if (!boards?.length) {
        alert(`No ${type === 'editorial' ? 'editorial' : 'personal'} ${format} rankings found. Build them first in the Rankings section.`);
        setLoading(false);
        return;
      }

      const { data: entries } = await supabase
        .from('ranking_entries')
        .select('rank, tier, player:players(id, name, position, nfl_team, age)')
        .eq('board_id', boards[0].id)
        .order('rank', { ascending: true });

      setQueue((entries || []).map(e => ({
        id:       e.player?.id,
        name:     e.player?.name,
        position: e.player?.position,
        nfl_team: e.player?.nfl_team,
        age:      e.player?.age,
        tier:     e.tier,
        rank:     e.rank,
      })));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  // Filtered available players (not in queue)
  const queueIds    = new Set(queue.map(p => p.id || p.name));
  const available   = allPlayers.filter(p => {
    if (queueIds.has(p.sleeper_id) || queueIds.has(p.name)) return false;
    if (posFilter !== 'ALL' && p.position !== posFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function addToQueue(player) {
    setQueue(prev => [...prev, { ...player, id: player.sleeper_id }]);
  }

  function removeFromQueue(idx) {
    setQueue(prev => prev.filter((_, i) => i !== idx));
  }

  function moveUp(idx) {
    if (idx === 0) return;
    setQueue(prev => { const n = [...prev]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n; });
  }
  function moveDown(idx) {
    setQueue(prev => { if (idx >= prev.length - 1) return prev; const n = [...prev]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n; });
  }

  // Drag and drop
  function onDragStart(idx) { setDragIdx(idx); }
  function onDragOver(e, idx) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setQueue(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      setDragIdx(idx);
      return next;
    });
  }
  function onDragEnd() { setDragIdx(null); }

  // Export to Sleeper format
  function copyToSleeper() {
    const text = queue.map(p => p.name).join(', ');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  // Export as numbered list
  function copyNumbered() {
    const text = queue.map((p, i) => `${i+1}. ${p.name} (${p.position}, ${p.nfl_team})`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  const FORMATS = [
    { id:'1qb', label:'1QB' }, { id:'sf', label:'SF' }, { id:'teprem', label:'TE Prem' },
  ];

  const filteredQueue = posFilter !== 'ALL' ? queue.filter(p => p.position === posFilter) : queue;

  return (
    <>
      <Head>
        <title>Draft Queue Builder — DynastyJudge</title>
      </Head>
      <Nav />

      <main style={{ minHeight: '100vh', paddingBottom: '4rem' }}>
        <div style={{ borderBottom: '0.5px solid var(--border-subtle)', padding: '2.5rem 0 2rem' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div className="gold-bar" />
              <span className="label text-gold">Judge tools</span>
            </div>
            <h1 className="display-md" style={{ marginBottom: 8 }}>Draft queue builder</h1>
            <p className="body-md" style={{ color: 'var(--text-secondary)', maxWidth: 520 }}>
              Build your prioritized draft queue, reorder by drag-and-drop, and export in Sleeper-compatible format.
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>

            {/* ── LEFT: Queue ── */}
            <div>
              {/* Controls */}
              <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Format */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {FORMATS.map(f => (
                    <button key={f.id} onClick={() => setFormat(f.id)} style={{ padding: '0.375rem 0.875rem', borderRadius: 'var(--radius-md)', border: format === f.id ? '0.5px solid var(--gold-500)' : '0.5px solid var(--border-default)', background: format === f.id ? 'rgba(200,151,58,0.12)' : 'transparent', color: format === f.id ? 'var(--gold-400)' : 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: format === f.id ? 600 : 400, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{f.label}</button>
                  ))}
                </div>

                {/* Load from rankings */}
                <button onClick={() => loadFromRankings('editorial')} disabled={loading} style={{ padding: '0.375rem 0.875rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  {loading ? '...' : '📋 Load DJ rankings'}
                </button>
                <button onClick={() => loadFromRankings('personal')} disabled={loading} style={{ padding: '0.375rem 0.875rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  {loading ? '...' : '👤 Load my rankings'}
                </button>

                <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {queue.length} players in queue
                </span>
              </div>

              {/* Export buttons */}
              {queue.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={copyToSleeper} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--gold-500)', color: 'var(--charcoal-900)', border: 'none', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    {copied ? '✓ Copied!' : '📋 Copy for Sleeper'}
                  </button>
                  <button onClick={copyNumbered} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    Copy as numbered list
                  </button>
                  <button onClick={() => setQueue([])} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-subtle)', background: 'transparent', color: '#F87171', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    Clear queue
                  </button>
                </div>
              )}

              {/* Sleeper import instructions */}
              {copied && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(34,197,94,0.08)', border: '0.5px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.8125rem', color: '#4ADE80', lineHeight: 1.6 }}>
                  ✓ Copied! In the Sleeper app: Draft → Your queue → Import → Paste. Player names must match exactly.
                </div>
              )}

              {/* Queue table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '36px 40px 1fr 68px 80px 36px', padding: '0.5rem 0.75rem', borderBottom: '0.5px solid var(--border-default)', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <span></span><span>#</span><span>Player</span><span style={{textAlign:'center'}}>Pos</span><span style={{textAlign:'center'}}>Move</span><span></span>
              </div>

              {queue.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Your queue is empty. Load from rankings or add players from the panel on the right.
                </div>
              )}

              {queue.map((p, idx) => {
                const pos = POS_COLORS[p.position] || { bg:'rgba(156,163,175,0.15)', text:'#D1D5DB' };
                const isDragging = dragIdx === idx;
                return (
                  <div
                    key={p.id || p.name}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={e => onDragOver(e, idx)}
                    onDragEnd={onDragEnd}
                    style={{ display: 'grid', gridTemplateColumns: '36px 40px 1fr 68px 80px 36px', padding: '0.5rem 0.75rem', borderBottom: '0.5px solid var(--border-subtle)', alignItems: 'center', background: isDragging ? 'rgba(200,151,58,0.06)' : 'transparent', opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}
                    onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={e => { if (!isDragging) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ color: 'var(--text-muted)', userSelect: 'none' }}>⠿</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: idx < 5 ? 'var(--gold-400)' : 'var(--text-muted)' }}>{idx+1}</span>
                    <div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>{p.nfl_team}</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ display:'inline-block', padding:'1px 6px', borderRadius:4, fontSize:'0.7rem', fontWeight:700, background:pos.bg, color:pos.text }}>{p.position}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                      <button onClick={() => moveUp(idx)} style={{ width:24, height:24, borderRadius:4, border:'0.5px solid var(--border-subtle)', background:'transparent', color:'var(--text-muted)', cursor:'pointer', fontSize:'0.7rem' }}>▲</button>
                      <button onClick={() => moveDown(idx)} style={{ width:24, height:24, borderRadius:4, border:'0.5px solid var(--border-subtle)', background:'transparent', color:'var(--text-muted)', cursor:'pointer', fontSize:'0.7rem' }}>▼</button>
                    </div>
                    <button onClick={() => removeFromQueue(idx)} style={{ width:26, height:26, borderRadius:4, border:'0.5px solid var(--border-subtle)', background:'transparent', color:'#F87171', cursor:'pointer', fontSize:'0.8rem' }}>✕</button>
                  </div>
                );
              })}
            </div>

            {/* ── RIGHT: Add players panel ── */}
            <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1rem', position: 'sticky', top: '70px' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Add players</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {['ALL','QB','RB','WR','TE'].map(p => (
                  <button key={p} onClick={() => setPos(p)} style={{ padding:'0.25rem 0.625rem', borderRadius:99, border: posFilter === p ? '0.5px solid var(--border-gold)' : '0.5px solid var(--border-subtle)', background: posFilter === p ? 'rgba(200,151,58,0.1)' : 'transparent', color: posFilter === p ? 'var(--gold-400)' : 'var(--text-muted)', fontSize:'0.75rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>{p}</button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search players..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width:'100%', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.8125rem', fontFamily:'var(--font-body)', outline:'none', marginBottom:'0.75rem' }}
              />
              <div style={{ maxHeight:480, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                {available.slice(0, 80).map(p => {
                  const pos = POS_COLORS[p.position] || { bg:'rgba(156,163,175,0.15)', text:'#D1D5DB' };
                  return (
                    <button
                      key={p.sleeper_id}
                      onClick={() => addToQueue(p)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'0.5rem 0.75rem', background:'var(--bg-primary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-sm)', cursor:'pointer', fontFamily:'var(--font-body)', textAlign:'left', transition:'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                    >
                      <span style={{ display:'inline-block', padding:'1px 5px', borderRadius:4, fontSize:'0.65rem', fontWeight:700, background:pos.bg, color:pos.text, flexShrink:0 }}>{p.position}</span>
                      <span style={{ flex:1, fontSize:'0.8125rem', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                      <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', flexShrink:0 }}>{p.nfl_team}</span>
                      <span style={{ fontSize:'0.75rem', color:'var(--gold-400)', flexShrink:0 }}>+</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </main>
    </>
  );
}
