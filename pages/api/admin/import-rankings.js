import { createClient } from '@supabase/supabase-js';

// ── Supported import sources ───────────────────────────────────────────────────
const SOURCES = {
  ktc: {
    name: 'KeepTradeCut',
    url: 'https://keeptradecut.com/dynasty-rankings?format=2', // 0=std, 1=2qb, 2=ppr
    type: 'scrape',
  },
  fantasypros: {
    name: 'FantasyPros',
    url: 'https://www.fantasypros.com/nfl/rankings/dynasty-overall.php',
    type: 'scrape',
  },
  csv: {
    name: 'CSV paste',
    type: 'csv',
  },
};

// ── Name normalization for fuzzy matching ─────────────────────────────────────
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Parse CSV format: rank,name OR name,rank OR name,team,pos,rank ────────────
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n').filter(l => l.trim());
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    if (cols.length < 2) continue;

    let rank, name, pos, team;

    // Try to detect column order
    // Pattern: rank,name,...
    if (!isNaN(parseInt(cols[0])) && isNaN(parseInt(cols[1]))) {
      rank = parseInt(cols[0]);
      name = cols[1];
      pos  = cols[2] || null;
      team = cols[3] || null;
    }
    // Pattern: name,rank,...
    else if (isNaN(parseInt(cols[0])) && !isNaN(parseInt(cols[1]))) {
      name = cols[0];
      rank = parseInt(cols[1]);
      pos  = cols[2] || null;
      team = cols[3] || null;
    }
    // Pattern: name,team,pos,rank
    else if (isNaN(parseInt(cols[0])) && cols.length >= 4) {
      name = cols[0];
      team = cols[1];
      pos  = cols[2];
      rank = parseInt(cols[3]);
    }
    else {
      continue; // skip unrecognizable lines
    }

    if (name && !isNaN(rank)) {
      results.push({ rank, name: name.trim(), pos, team });
    }
  }

  return results.sort((a, b) => a.rank - b.rank);
}

// ── Match imported names to our player DB ─────────────────────────────────────
async function matchPlayers(importedPlayers, db, format) {
  // Load all active players from DB
  const { data: dbPlayers } = await db
    .from('players')
    .select('id, name, position, nfl_team, sleeper_id')
    .eq('is_active', true);

  if (!dbPlayers) return [];

  // Build lookup maps
  const byNormalizedName = new Map();
  const byLastName       = new Map();

  for (const p of dbPlayers) {
    const norm = normalizeName(p.name);
    byNormalizedName.set(norm, p);

    const parts = norm.split(' ');
    const last  = parts[parts.length - 1];
    if (!byLastName.has(last)) byLastName.set(last, []);
    byLastName.get(last).push(p);
  }

  const matched   = [];
  const unmatched = [];

  for (const imp of importedPlayers) {
    const normImp = normalizeName(imp.name);

    // Exact match
    let player = byNormalizedName.get(normImp);

    // Try last name + position match
    if (!player && imp.pos) {
      const parts    = normImp.split(' ');
      const lastName = parts[parts.length - 1];
      const candidates = byLastName.get(lastName) || [];
      const posMatch = candidates.filter(c =>
        c.position?.toUpperCase() === imp.pos?.toUpperCase()
      );
      if (posMatch.length === 1) player = posMatch[0];
    }

    // Try partial name match (first + last)
    if (!player) {
      const impParts = normImp.split(' ');
      if (impParts.length >= 2) {
        const first = impParts[0];
        const last  = impParts[impParts.length - 1];
        const candidates = byLastName.get(last) || [];
        const nameMatch = candidates.find(c => {
          const cParts = normalizeName(c.name).split(' ');
          return cParts[0] === first;
        });
        if (nameMatch) player = nameMatch;
      }
    }

    if (player) {
      matched.push({ player_id: player.id, rank: imp.rank, name: player.name, pos: player.position });
    } else {
      unmatched.push(imp.name);
    }
  }

  return { matched, unmatched };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svcKey) {
    return res.status(500).json({ success: false, error: 'Missing service role key' });
  }

  const { source, format, csv_text, board_id, owner_id, board_type, preview_only } = req.body;

  if (!format) return res.status(400).json({ success: false, error: 'Missing format' });
  if (!source) return res.status(400).json({ success: false, error: 'Missing source' });

  const db = createClient(url, svcKey);

  try {
    let importedPlayers = [];

    // ── Parse input based on source ──────────────────────────────────────────
    if (source === 'csv') {
      if (!csv_text) throw new Error('No CSV text provided');
      importedPlayers = parseCSV(csv_text);
      if (!importedPlayers.length) throw new Error('Could not parse any players from CSV. Expected format: rank,player_name or player_name,rank');
    } else {
      throw new Error(`Source "${source}" not yet supported. Use CSV import for now.`);
    }

    // ── Match to our player DB ───────────────────────────────────────────────
    const { matched, unmatched } = await matchPlayers(importedPlayers, db, format);

    if (!matched.length) {
      throw new Error('No players could be matched to our database. Check that player names are spelled correctly.');
    }

    // If preview only, return the match results without saving
    if (preview_only) {
      return res.status(200).json({
        success: true,
        preview: true,
        matched_count:   matched.length,
        unmatched_count: unmatched.length,
        matched:   matched.slice(0, 20),   // first 20 for preview
        unmatched: unmatched.slice(0, 20), // first 20 unmatched
        total_imported: importedPlayers.length,
      });
    }

    // ── Get or create target board ────────────────────────────────────────────
    let targetBoardId = board_id;

    if (!targetBoardId) {
      // Find existing board for this owner + format
      const query = db
        .from('ranking_boards')
        .select('id')
        .eq('format', format)
        .eq('type', board_type || 'community')
        .eq('is_active', true);

      if (owner_id) query.eq('owner_id', owner_id);

      const { data: existing } = await query.limit(1);

      if (existing?.[0]) {
        targetBoardId = existing[0].id;
      } else {
        // Create new board
        const { data: newBoard, error: createErr } = await db
          .from('ranking_boards')
          .insert({
            type:             board_type || 'community',
            format,
            display_name:     'My Rankings',
            owner_id:         owner_id || null,
            in_consensus:     true,
            is_active:        true,
            is_public:        false,
          })
          .select()
          .single();

        if (createErr) throw new Error(`Could not create board: ${createErr.message}`);
        targetBoardId = newBoard.id;
      }
    }

    // ── Delete existing + insert matched entries ───────────────────────────────
    await db.from('ranking_entries').delete().eq('board_id', targetBoardId);

    const rows = matched.map((m, i) => ({
      board_id:   targetBoardId,
      player_id:  m.player_id,
      rank:       i + 1,
      updated_at: new Date().toISOString(),
    }));

    const { error: insErr } = await db.from('ranking_entries').insert(rows);
    if (insErr) throw new Error(`Insert failed: ${insErr.message}`);

    // Update board player count
    await db.from('ranking_boards')
      .update({ player_count: rows.length, updated_at: new Date().toISOString() })
      .eq('id', targetBoardId);

    return res.status(200).json({
      success: true,
      board_id:        targetBoardId,
      matched_count:   matched.length,
      unmatched_count: unmatched.length,
      unmatched,
      message: `Imported ${matched.length} players. ${unmatched.length} could not be matched.`,
    });

  } catch (err) {
    console.error('import-rankings error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
