import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

  const { format } = req.query;
  if (!format) {
    return res.status(400).json({ success: false, error: 'Missing format param' });
  }

  const db = createClient(url, svcKey);

  try {
    // Try to find existing editorial board for this format
    const { data: boards, error: findErr } = await db
      .from('ranking_boards')
      .select('*')
      .eq('type', 'editorial')
      .eq('format', format)
      .eq('is_active', true)
      .limit(1);

    if (findErr) throw new Error(`Find board failed: ${findErr.message}`);

    let board = boards?.[0] || null;

    // Create if it doesn't exist
    if (!board) {
      const { data: newBoard, error: createErr } = await db
        .from('ranking_boards')
        .insert({
          type:             'editorial',
          format,
          display_name:     `DynastyJudge Staff Rankings — ${format.toUpperCase()}`,
          in_consensus:     true,
          consensus_weight: 1.0,
          is_active:        true,
          is_public:        false,
        })
        .select()
        .single();

      if (createErr) throw new Error(`Create board failed: ${createErr.message}`);
      board = newBoard;
    }

    // Load entries for this board
    const { data: entries, error: entriesErr } = await db
      .from('ranking_entries')
      .select('*, player:players(id, name, position, nfl_team, age, injury_status)')
      .eq('board_id', board.id)
      .order('rank', { ascending: true });

    if (entriesErr) throw new Error(`Load entries failed: ${entriesErr.message}`);

    return res.status(200).json({
      success: true,
      board,
      entries: entries || [],
    });

  } catch (err) {
    console.error('get-editorial-board error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
