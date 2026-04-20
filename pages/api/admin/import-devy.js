import { createClient } from '@supabase/supabase-js';

/**
 * 247Sports Devy Import
 *
 * LEGAL NOTE: This endpoint accepts manual CSV data pasted by an admin
 * from 247Sports rather than scraping directly. This is the safe approach
 * until a data licensing agreement is in place.
 *
 * CSV format expected (from 247Sports composite rankings):
 * rank,name,position,hometown,committed_college,stars,composite_score
 *
 * Example:
 * 1,Bryce Underwood,QB,"Belleville, MI",LSU,5,0.9998
 * 2,Jeremiah Smith,WR,"Hollywood, FL",Ohio State,5,0.9997
 */

const VALID_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'ATH', 'OL', 'DL', 'LB', 'DB', 'K', 'P'];

// Map 247Sports positions to our schema positions
const POSITION_MAP = {
  'ATH': 'WR',   // Most devy ATH become WR/RB — admin can correct individually
  'APB': 'RB',   // All-purpose back
  'SDE': 'DL',
  'WDE': 'DL',
  'ILB': 'LB',
  'OLB': 'LB',
  'CB':  'DB',
  'S':   'DB',
  'FS':  'DB',
  'SS':  'DB',
  'OT':  'OL',
  'OG':  'OL',
  'C':   'OL',
  'OC':  'OL',
};

function normalizePosition(raw) {
  if (!raw) return null;
  const upper = raw.toUpperCase().trim();
  return POSITION_MAP[upper] || (VALID_POSITIONS.includes(upper) ? upper : 'ATH');
}

function parseDevyCSV(csvText, gradYear) {
  const lines = csvText.trim().split('\n').filter(l => l.trim());
  const results = [];

  // Auto-detect header row
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('rank') || firstLine.includes('name') || firstLine.includes('player');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  for (let i = 0; i < dataLines.length; i++) {
    const raw = dataLines[i];
    // Handle quoted fields with commas inside
    const cols = raw.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(c => c.trim().replace(/^"|"$/g, '')) || raw.split(',').map(c => c.trim());

    if (cols.length < 2) continue;

    // Flexible column detection
    let rank, name, position, hometown, college, stars, score;

    // Try rank,name,pos,... pattern
    if (!isNaN(parseInt(cols[0]))) {
      rank     = parseInt(cols[0]);
      name     = cols[1];
      position = cols[2] || null;
      hometown = cols[3] || null;
      college  = cols[4] || null;
      stars    = cols[5] ? parseInt(cols[5]) : null;
      score    = cols[6] ? parseFloat(cols[6]) : null;
    } else {
      // name,pos,... pattern with auto rank
      name     = cols[0];
      position = cols[1] || null;
      hometown = cols[2] || null;
      college  = cols[3] || null;
      stars    = cols[4] ? parseInt(cols[4]) : null;
      score    = cols[5] ? parseFloat(cols[5]) : null;
      rank     = i + 1;
    }

    if (!name || name.length < 2) continue;

    results.push({
      rank:              rank || (i + 1),
      name:              name.trim(),
      position:          normalizePosition(position),
      hometown:          hometown || null,
      college:           college || null,
      recruiting_stars:  (stars >= 1 && stars <= 5) ? stars : null,
      composite_score:   score,
      recruiting_class:  gradYear,
    });
  }

  return results.sort((a, b) => a.rank - b.rank);
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

  const { csv_text, grad_year, position_filter, preview_only, overwrite_existing } = req.body;

  if (!csv_text) return res.status(400).json({ success: false, error: 'No CSV text provided' });
  if (!grad_year || isNaN(parseInt(grad_year))) {
    return res.status(400).json({ success: false, error: 'Invalid grad_year' });
  }

  const year = parseInt(grad_year);
  if (year < 2024 || year > 2032) {
    return res.status(400).json({ success: false, error: 'grad_year must be between 2024 and 2032' });
  }

  const db = createClient(url, svcKey);

  try {
    // Parse the CSV
    const prospects = parseDevyCSV(csv_text, year);
    if (!prospects.length) {
      throw new Error('Could not parse any prospects from the CSV. Check format.');
    }

    // Apply position filter if specified
    const filtered = position_filter && position_filter !== 'ALL'
      ? prospects.filter(p => p.position === position_filter)
      : prospects;

    if (preview_only) {
      return res.status(200).json({
        success: true,
        preview: true,
        total: filtered.length,
        sample: filtered.slice(0, 10),
        grad_year: year,
        positions: [...new Set(filtered.map(p => p.position).filter(Boolean))],
      });
    }

    // Upsert prospects into players table
    const rows = filtered.map(p => ({
      // No sleeper_id for devy — use name + class as natural key
      name:             p.name,
      first_name:       p.name.split(' ')[0] || '',
      last_name:        p.name.split(' ').slice(1).join(' ') || '',
      position:         p.position,
      college:          p.college,
      is_active:        true,
      is_devy:          true,
      recruiting_class: p.recruiting_class,
      recruiting_rank:  p.rank,
      recruiting_stars: p.recruiting_stars,
      status:           'Prospect',
      updated_at:       new Date().toISOString(),
    }));

    // For devy players, use name + recruiting_class as the conflict key
    // We need to handle this carefully since there's no sleeper_id
    let inserted = 0;
    let updated  = 0;
    const errors = [];

    for (const row of rows) {
      // Check if player already exists
      const { data: existing } = await db
        .from('players')
        .select('id')
        .eq('name', row.name)
        .eq('recruiting_class', row.recruiting_class)
        .eq('is_devy', true)
        .limit(1);

      if (existing?.[0]) {
        if (overwrite_existing) {
          const { error } = await db
            .from('players')
            .update(row)
            .eq('id', existing[0].id);
          if (error) errors.push(`Update ${row.name}: ${error.message}`);
          else updated++;
        }
        // Skip if not overwriting
      } else {
        const { error } = await db.from('players').insert(row);
        if (error) errors.push(`Insert ${row.name}: ${error.message}`);
        else inserted++;
      }
    }

    return res.status(200).json({
      success: true,
      grad_year: year,
      total_parsed:    filtered.length,
      inserted,
      updated,
      skipped:         filtered.length - inserted - updated - errors.length,
      errors:          errors.slice(0, 10),
      message: `Imported ${inserted} new prospects, updated ${updated} for class of ${year}.`,
    });

  } catch (err) {
    console.error('import-devy error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
