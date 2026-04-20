import { createClient } from '@supabase/supabase-js';

// Position value adjustments when copying between formats
// Positive = move up these many spots relative to their original rank
// Negative = move down
const FORMAT_ADJUSTMENTS = {
  // Going from 1QB → SuperFlex: QBs become much more valuable
  '1qb_to_sf': {
    QB: -40,  // QBs jump way up (lower rank number = better)
    RB: +8,
    WR: +5,
    TE: +3,
  },
  // Going from SF → 1QB: QBs drop significantly
  'sf_to_1qb': {
    QB: +40,
    RB: -8,
    WR: -5,
    TE: -3,
  },
  // Going from 1QB → TE Premium: TEs become more valuable
  '1qb_to_teprem': {
    QB: 0,
    RB: +3,
    WR: +2,
    TE: -20,  // TEs jump up
  },
  // Going from TE Premium → 1QB
  'teprem_to_1qb': {
    QB: 0,
    RB: -3,
    WR: -2,
    TE: +20,
  },
  // SF → TE Premium
  'sf_to_teprem': {
    QB: +35,
    RB: +4,
    WR: +2,
    TE: -15,
  },
  // TE Premium → SF
  'teprem_to_sf': {
    QB: -35,
    RB: -4,
    WR: -2,
    TE: +15,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svcKey) {
    return res.status(500).json({ success: false, error: 'Missing service role key' });
  }

  const { source_board_id, target_format, smart_adjust, owner_id, board_type } = req.body;

  if (!source_board_id || !target_format) {
    return res.status(400).json({ success: false, error: 'Missing source_board_id or target_format' });
  }

  const db = createClient(url, svcKey);

  try {
    // 1. Load source board
    const { data: sourceBoard, error: srcErr } = await db
      .from('ranking_boards')
      .select('*')
      .eq('id', source_board_id)
      .single();

    if (srcErr || !sourceBoard) throw new Error('Source board not found');
    if (sourceBoard.format === target_format) throw new Error('Source and target formats are the same');

    // 2. Load source entries
    const { data: sourceEntries, error: entErr } = await db
      .from('ranking_entries')
      .select('*, player:players(id, name, position)')
      .eq('board_id', source_board_id)
      .order('rank', { ascending: true });

    if (entErr) throw new Error(`Could not load entries: ${entErr.message}`);
    if (!sourceEntries?.length) throw new Error('Source board has no ranked players');

    // 3. Apply smart format adjustments if requested
    let adjustedEntries = sourceEntries.map(e => ({ ...e }));

    if (smart_adjust) {
      const adjustKey = `${sourceBoard.format}_to_${target_format}`;
      const adjustments = FORMAT_ADJUSTMENTS[adjustKey];

      if (adjustments) {
        // Add adjustment offset to each player's rank
        adjustedEntries = adjustedEntries.map(e => {
          const pos = e.player?.position;
          const adj = adjustments[pos] || 0;
          return { ...e, adjusted_rank: Math.max(1, e.rank + adj) };
        });

        // Re-sort by adjusted rank
        adjustedEntries.sort((a, b) => a.adjusted_rank - b.adjusted_rank);
      }

      // Re-number cleanly 1..N after sort
      adjustedEntries = adjustedEntries.map((e, i) => ({ ...e, rank: i + 1 }));
    }

    // 4. Check if a board already exists for target format + owner
    const boardQuery = db
      .from('ranking_boards')
      .select('id')
      .eq('format', target_format)
      .eq('type', sourceBoard.type)
      .eq('is_active', true);

    if (owner_id) boardQuery.eq('owner_id', owner_id);
    else boardQuery.is('owner_id', null); // editorial boards have no owner

    const { data: existingBoards } = await boardQuery.limit(1);
    const existingBoard = existingBoards?.[0];

    let targetBoardId;

    if (existingBoard) {
      // Use existing board (entries will be overwritten below)
      targetBoardId = existingBoard.id;
    } else {
      // Create new board for target format
      const newBoardData = {
        type:             sourceBoard.type,
        format:           target_format,
        display_name:     sourceBoard.display_name || 'My Rankings',
        in_consensus:     sourceBoard.type !== 'personal',
        consensus_weight: sourceBoard.consensus_weight || 1.0,
        is_active:        true,
        is_public:        false,
        owner_id:         owner_id || null,
      };

      const { data: newBoard, error: createErr } = await db
        .from('ranking_boards')
        .insert(newBoardData)
        .select()
        .single();

      if (createErr) throw new Error(`Could not create target board: ${createErr.message}`);
      targetBoardId = newBoard.id;
    }

    // 5. Delete existing entries on target board
    await db.from('ranking_entries').delete().eq('board_id', targetBoardId);

    // 6. Insert copied entries
    const rows = adjustedEntries.map((e, i) => ({
      board_id:   targetBoardId,
      player_id:  e.player?.id || e.player_id,
      rank:       i + 1,
      tier:       e.tier  || null,
      note:       e.note  || null,
      updated_at: new Date().toISOString(),
    }));

    const { error: insErr } = await db.from('ranking_entries').insert(rows);
    if (insErr) throw new Error(`Insert failed: ${insErr.message}`);

    return res.status(200).json({
      success: true,
      target_board_id: targetBoardId,
      count: rows.length,
      smart_adjusted: smart_adjust && !!FORMAT_ADJUSTMENTS[`${sourceBoard.format}_to_${target_format}`],
      message: `Copied ${rows.length} players to ${target_format} board${smart_adjust ? ' with smart adjustments' : ''}.`,
    });

  } catch (err) {
    console.error('copy-rankings error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
