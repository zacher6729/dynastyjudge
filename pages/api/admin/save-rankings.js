import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !svcKey) {
    return res.status(500).json({
      success: false,
      error: 'Missing SUPABASE_SERVICE_ROLE_KEY environment variable.',
    });
  }

  const { board_id, entries, publish } = req.body;

  if (!board_id) {
    return res.status(400).json({ success: false, error: 'Missing board_id' });
  }

  const db = createClient(url, svcKey);

  try {
    // 1. Delete existing entries for this board
    const { error: delErr } = await db
      .from('ranking_entries')
      .delete()
      .eq('board_id', board_id);

    if (delErr) throw new Error(`Delete failed: ${delErr.message}`);

    // 2. Insert new entries
    if (entries && entries.length > 0) {
      const rows = entries.map((e, i) => ({
        board_id,
        player_id: e.player_id,
        rank:      e.rank ?? i + 1,
        tier:      e.tier  || null,
        note:      e.note  || null,
        updated_at: new Date().toISOString(),
      }));

      const { error: insErr } = await db
        .from('ranking_entries')
        .insert(rows);

      if (insErr) throw new Error(`Insert failed: ${insErr.message}`);
    }

    // 3. Update board metadata
    const boardUpdate = {
      player_count: entries?.length || 0,
      updated_at:   new Date().toISOString(),
    };

    if (publish) {
      boardUpdate.is_public         = true;
      boardUpdate.in_consensus      = true;
      boardUpdate.last_published_at = new Date().toISOString();
    }

    const { error: boardErr } = await db
      .from('ranking_boards')
      .update(boardUpdate)
      .eq('id', board_id);

    if (boardErr) throw new Error(`Board update failed: ${boardErr.message}`);

    return res.status(200).json({
      success: true,
      count: entries?.length || 0,
      published: !!publish,
    });

  } catch (err) {
    console.error('save-rankings error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
