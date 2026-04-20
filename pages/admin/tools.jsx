import Head from 'next/head';
import { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { supabase } from '../../lib/supabase';

const FORMATS = [
  { id: '1qb',    label: '1QB'        },
  { id: 'sf',     label: 'SuperFlex'  },
  { id: 'teprem', label: 'TE Premium' },
  { id: 'devy',   label: 'Devy'       },
];

const GRAD_YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

function StatusBox({ msg, type }) {
  if (!msg) return null;
  const isErr = type === 'error';
  return (
    <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: isErr ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `0.5px solid ${isErr ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, color: isErr ? '#F87171' : '#4ADE80', fontSize: '0.875rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
      {msg}
    </div>
  );
}

// ── Section card wrapper ─────────────────────────────────────────────────────
function Section({ title, desc, children }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{desc}</p>
      {children}
    </div>
  );
}

function inputStyle(extra = {}) {
  return { padding: '0.5rem 0.875rem', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'var(--font-body)', outline: 'none', ...extra };
}

function btnStyle(primary = false, disabled = false) {
  return {
    padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-md)',
    background: disabled ? 'var(--bg-tertiary)' : primary ? 'var(--gold-500)' : 'var(--bg-primary)',
    color: disabled ? 'var(--text-muted)' : primary ? 'var(--charcoal-900)' : 'var(--text-primary)',
    border: primary ? 'none' : '0.5px solid var(--border-default)',
    fontSize: '0.875rem', fontWeight: primary ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
    opacity: disabled ? 0.6 : 1,
  };
}

// ── 1. IMPORT FROM CSV ───────────────────────────────────────────────────────
function ImportFromCSV() {
  const [format, setFormat]     = useState('1qb');
  const [csvText, setCsv]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [preview, setPreview]   = useState(null);
  const [status, setStatus]     = useState({ msg: '', type: '' });
  const [boardType, setBoardType] = useState('editorial');

  async function handlePreview() {
    setLoading(true); setStatus({ msg: '', type: '' }); setPreview(null);
    try {
      const res  = await fetch('/api/admin/import-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'csv', format, csv_text: csvText, preview_only: true }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPreview(data);
    } catch (e) { setStatus({ msg: `✗ ${e.message}`, type: 'error' }); }
    setLoading(false);
  }

  async function handleImport() {
    setLoading(true); setStatus({ msg: '', type: '' });
    try {
      const res  = await fetch('/api/admin/import-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'csv', format, csv_text: csvText, board_type: boardType }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setStatus({ msg: `✓ ${data.message}${data.unmatched?.length ? ` Unmatched: ${data.unmatched.slice(0,5).join(', ')}...` : ''}`, type: 'success' });
      setPreview(null);
      setCsv('');
    } catch (e) { setStatus({ msg: `✗ ${e.message}`, type: 'error' }); }
    setLoading(false);
  }

  return (
    <Section
      title="Import rankings from CSV"
      desc="Paste rankings from KeepTradeCut, FantasyPros, Underdog, or any site that lets you export/copy data. Expected format: rank,player_name or player_name,rank — one player per line."
    >
      <div style={{ display: 'flex', gap: 10, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Format</label>
          <select value={format} onChange={e => setFormat(e.target.value)} style={inputStyle()}>
            {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Import as</label>
          <select value={boardType} onChange={e => setBoardType(e.target.value)} style={inputStyle()}>
            <option value="editorial">Editorial (DJ staff)</option>
            <option value="community">Community board</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          Paste CSV data
        </label>
        <textarea
          value={csvText}
          onChange={e => setCsv(e.target.value)}
          placeholder={`1,Christian McCaffrey\n2,CeeDee Lamb\n3,Ja'Marr Chase\n...`}
          rows={10}
          style={{ ...inputStyle({ width: '100%', resize: 'vertical', lineHeight: 1.5, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem' }) }}
        />
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.875rem', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Supported formats:</strong> rank,name · name,rank · name,team,pos,rank<br/>
        Players are matched to our database by name. Unmatched players are reported but don't block the import.
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handlePreview} disabled={!csvText.trim() || loading} style={btnStyle(false, !csvText.trim() || loading)}>
          {loading ? 'Processing...' : 'Preview matches'}
        </button>
        {preview && (
          <button onClick={handleImport} disabled={loading} style={btnStyle(true, loading)}>
            Import {preview.matched_count} players →
          </button>
        )}
      </div>

      {preview && (
        <div style={{ marginTop: '0.875rem', padding: '0.875rem', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
            Preview: {preview.matched_count} matched · {preview.unmatched_count} unmatched of {preview.total_imported} total
          </div>
          {preview.matched?.slice(0, 8).map((m, i) => (
            <div key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', padding: '2px 0' }}>
              #{m.rank} {m.name} <span style={{ color: 'var(--text-muted)' }}>({m.pos})</span> <span style={{ color: '#4ADE80' }}>✓</span>
            </div>
          ))}
          {preview.unmatched?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: '0.8125rem', color: '#F87171' }}>
              Could not match: {preview.unmatched.slice(0, 5).join(', ')}{preview.unmatched.length > 5 ? ` +${preview.unmatched.length - 5} more` : ''}
            </div>
          )}
        </div>
      )}

      <StatusBox msg={status.msg} type={status.type} />
    </Section>
  );
}

// ── 2. COPY BETWEEN FORMATS ──────────────────────────────────────────────────
function CopyFormat() {
  const [sourceFormat, setSrc]     = useState('1qb');
  const [targetFormat, setTgt]     = useState('sf');
  const [smartAdjust, setSmart]    = useState(true);
  const [loading, setLoading]      = useState(false);
  const [status, setStatus]        = useState({ msg: '', type: '' });
  const [boardType, setBoardType]  = useState('editorial');

  async function handleCopy() {
    if (sourceFormat === targetFormat) {
      setStatus({ msg: '✗ Source and target formats must be different.', type: 'error' });
      return;
    }
    setLoading(true); setStatus({ msg: '', type: '' });

    try {
      // First get the source board ID
      const { data: boards } = await supabase
        .from('ranking_boards')
        .select('id, format')
        .eq('type', boardType)
        .eq('format', sourceFormat)
        .eq('is_active', true)
        .limit(1);

      if (!boards?.length) throw new Error(`No ${boardType} ${sourceFormat} board found. Create and save one first.`);

      const res  = await fetch('/api/admin/copy-rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_board_id: boards[0].id,
          target_format:   targetFormat,
          smart_adjust:    smartAdjust,
          board_type:      boardType,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setStatus({
        msg: `✓ ${data.message} Go to Rankings Manager → ${targetFormat.toUpperCase()} to review and publish.`,
        type: 'success',
      });
    } catch (e) { setStatus({ msg: `✗ ${e.message}`, type: 'error' }); }
    setLoading(false);
  }

  return (
    <Section
      title="Copy rankings to another format"
      desc="Take your existing rankings board and create a version in a different format. Smart adjustment automatically shifts QB values for SuperFlex and TE values for TE Premium."
    >
      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Board type</label>
          <select value={boardType} onChange={e => setBoardType(e.target.value)} style={inputStyle()}>
            <option value="editorial">Editorial (DJ staff)</option>
            <option value="community">Community / personal</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Copy from</label>
          <select value={sourceFormat} onChange={e => setSrc(e.target.value)} style={inputStyle()}>
            {FORMATS.filter(f => f.id !== 'devy').map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div style={{ fontSize: '1.25rem', color: 'var(--text-muted)', alignSelf: 'flex-end', paddingBottom: 4 }}>→</div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Copy to</label>
          <select value={targetFormat} onChange={e => setTgt(e.target.value)} style={inputStyle()}>
            {FORMATS.filter(f => f.id !== 'devy' && f.id !== sourceFormat).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={smartAdjust} onChange={e => setSmart(e.target.checked)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
        Smart format adjustment
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          (shifts QBs up in SuperFlex, TEs up in TE Premium)
        </span>
      </label>

      {smartAdjust && sourceFormat !== targetFormat && (
        <div style={{ padding: '0.75rem', background: 'rgba(200,151,58,0.06)', border: '0.5px solid var(--border-gold)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--gold-400)' }}>Adjustments for {sourceFormat} → {targetFormat}:</strong><br/>
          {sourceFormat === '1qb' && targetFormat === 'sf' && 'QBs shift up ~40 spots · RBs down ~8 · WRs down ~5'}
          {sourceFormat === 'sf' && targetFormat === '1qb' && 'QBs shift down ~40 spots · RBs up ~8 · WRs up ~5'}
          {sourceFormat === '1qb' && targetFormat === 'teprem' && 'TEs shift up ~20 spots · RBs down ~3 · WRs down ~2'}
          {sourceFormat === 'teprem' && targetFormat === '1qb' && 'TEs shift down ~20 spots · RBs up ~3 · WRs up ~2'}
          {sourceFormat === 'sf' && targetFormat === 'teprem' && 'QBs down ~35 · TEs up ~15 · RBs down ~4'}
          {sourceFormat === 'teprem' && targetFormat === 'sf' && 'QBs up ~35 · TEs down ~15 · RBs up ~4'}
          <br/><span style={{ color: 'var(--text-muted)' }}>You can review and edit the result before publishing.</span>
        </div>
      )}

      <button onClick={handleCopy} disabled={loading || sourceFormat === targetFormat} style={btnStyle(true, loading || sourceFormat === targetFormat)}>
        {loading ? 'Copying...' : `Copy ${sourceFormat.toUpperCase()} → ${targetFormat.toUpperCase()}`}
      </button>

      <StatusBox msg={status.msg} type={status.type} />
    </Section>
  );
}

// ── 3. DEVY IMPORT FROM 247 ──────────────────────────────────────────────────
function DevyImport() {
  const [gradYear, setYear]       = useState(2026);
  const [csvText, setCsv]         = useState('');
  const [posFilter, setPos]       = useState('ALL');
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [preview, setPreview]     = useState(null);
  const [status, setStatus]       = useState({ msg: '', type: '' });

  async function handlePreview() {
    setLoading(true); setStatus({ msg: '', type: '' }); setPreview(null);
    try {
      const res  = await fetch('/api/admin/import-devy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_text: csvText, grad_year: gradYear, position_filter: posFilter, preview_only: true }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPreview(data);
    } catch (e) { setStatus({ msg: `✗ ${e.message}`, type: 'error' }); }
    setLoading(false);
  }

  async function handleImport() {
    setLoading(true); setStatus({ msg: '', type: '' });
    try {
      const res  = await fetch('/api/admin/import-devy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_text: csvText, grad_year: gradYear, position_filter: posFilter, overwrite_existing: overwrite }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setStatus({ msg: `✓ ${data.message}${data.errors?.length ? ` Errors: ${data.errors[0]}` : ''}`, type: 'success' });
      setPreview(null);
      setCsv('');
    } catch (e) { setStatus({ msg: `✗ ${e.message}`, type: 'error' }); }
    setLoading(false);
  }

  return (
    <Section
      title="Import devy prospects from 247Sports"
      desc="Paste prospect data from the 247Sports composite rankings page. Copy the table data, paste it here, and select the graduation year. Players are added to the devy database."
    >
      <div style={{ padding: '0.75rem', background: 'rgba(251,191,36,0.06)', border: '0.5px solid rgba(251,191,36,0.2)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <strong style={{ color: '#FBBF24' }}>How to get the data from 247Sports:</strong><br/>
        1. Go to 247sports.com/Season/[year]-Football/CompositeRecruitRankings<br/>
        2. Select the class year and position filter<br/>
        3. Copy the player table (Ctrl+A on the table, then Ctrl+C)<br/>
        4. Paste below — the parser handles most 247Sports table formats
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: '0.875rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Graduation year (class)</label>
          <select value={gradYear} onChange={e => setYear(parseInt(e.target.value))} style={inputStyle()}>
            {GRAD_YEARS.map(y => <option key={y} value={y}>Class of {y}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Filter by position</label>
          <select value={posFilter} onChange={e => setPos(e.target.value)} style={inputStyle()}>
            {['ALL', 'QB', 'RB', 'WR', 'TE', 'ATH', 'OL', 'DL', 'LB', 'DB'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Paste prospect data</label>
        <textarea
          value={csvText}
          onChange={e => setCsv(e.target.value)}
          placeholder={`rank,name,position,hometown,committed_college,stars,composite_score\n1,Bryce Underwood,QB,"Belleville, MI",LSU,5,0.9998\n2,Jeremiah Smith,WR,"Hollywood, FL",Ohio State,5,0.9997`}
          rows={10}
          style={{ ...inputStyle({ width: '100%', resize: 'vertical', lineHeight: 1.5, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem' }) }}
        />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: '0.875rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
        Overwrite existing prospects with same name + class
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handlePreview} disabled={!csvText.trim() || loading} style={btnStyle(false, !csvText.trim() || loading)}>
          {loading ? 'Processing...' : 'Preview import'}
        </button>
        {preview && (
          <button onClick={handleImport} disabled={loading} style={btnStyle(true, loading)}>
            Import {preview.total} prospects →
          </button>
        )}
      </div>

      {preview && (
        <div style={{ marginTop: '0.875rem', padding: '0.875rem', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
            Preview: {preview.total} prospects · Class of {preview.grad_year} · Positions: {preview.positions?.join(', ')}
          </div>
          {preview.sample?.map((p, i) => (
            <div key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', padding: '2px 0' }}>
              #{p.rank} {p.name} <span style={{ color: 'var(--text-muted)' }}>· {p.position} · {p.college || 'uncommitted'} · {'★'.repeat(p.recruiting_stars || 0)}</span>
            </div>
          ))}
        </div>
      )}

      <StatusBox msg={status.msg} type={status.type} />
    </Section>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminRankingTools() {
  const [activeSection, setSection] = useState('import');

  const SECTIONS = [
    { id: 'import', label: 'Import from CSV'    },
    { id: 'copy',   label: 'Copy between formats' },
    { id: 'devy',   label: 'Devy import (247Sports)' },
  ];

  return (
    <>
      <Head><title>Rankings Tools — DynastyJudge Admin</title></Head>
      <AdminLayout title="Rankings tools" activeHref="/admin/rankings">

        {/* Sub nav */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)',
              border: activeSection === s.id ? '0.5px solid var(--gold-500)' : '0.5px solid var(--border-default)',
              background: activeSection === s.id ? 'rgba(200,151,58,0.12)' : 'transparent',
              color: activeSection === s.id ? 'var(--gold-400)' : 'var(--text-secondary)',
              fontSize: '0.875rem', fontWeight: activeSection === s.id ? 600 : 400,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>{s.label}</button>
          ))}
        </div>

        {activeSection === 'import' && <ImportFromCSV />}
        {activeSection === 'copy'   && <CopyFormat />}
        {activeSection === 'devy'   && <DevyImport />}

      </AdminLayout>
    </>
  );
}
