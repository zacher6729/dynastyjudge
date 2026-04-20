import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db     = createClient(url, svcKey);

  const { draft_id, overall } = req.body;
  if (!draft_id || !overall) return res.status(400).json({ success: false, error: 'Missing fields' });

  try {
    // Load draft and verify it's still on this pick
    const { data: draft } = await db.from('devy_drafts').select('*').eq('id', draft_id).single();
    if (!draft) throw new Error('Draft not found');
    if (draft.status !== 'active') return res.status(200).json({ success: false, reason: 'Draft not active' });
    if (draft.current_pick !== overall) return res.status(200).json({ success: false, reason: 'Pick already made' });

    // Get the current pick slot
    const { data: pickSlot } = await db
      .from('devy_picks').select('*').eq('draft_id', draft_id).eq('overall', overall).single();
    if (!pickSlot || pickSlot.is_picked) return res.status(200).json({ success: false, reason: 'Already picked' });

    // Get already drafted player IDs
    const { data: drafted } = await db
      .from('devy_picks').select('player_id').eq('draft_id', draft_id).eq('is_picked', true);
    const draftedIds = (drafted || []).map(p => p.player_id).filter(Boolean);

    // Build pool query matching draft settings
    let query = db.from('players').select('id, name, position, recruiting_rank, recruiting_class, is_devy').eq('is_active', true);

    if (draft.include_devy && !draft.include_nfl_players) {
      query = query.eq('is_devy', true);
      if (draft.devy_classes?.length) query = query.in('recruiting_class', draft.devy_classes.map(Number));
    } else if (!draft.include_devy && draft.include_nfl_players) {
      query = query.eq('is_devy', false);
    }

    if (draftedIds.length) query = query.not('id', 'in', `(${draftedIds.map(id => `'${id}'`).join(',')})`);

    const { data: available } = await query
      .order('recruiting_rank', { ascending: true, nullsFirst: false })
      .limit(1);

    if (!available?.length) throw new Error('No players available to auto-pick');

    const player = available[0];

    // Make the pick
    await db.from('devy_picks').update({
      player_id:       player.id,
      player_name:     player.name,
      player_position: player.position,
      player_class:    player.recruiting_class ? String(player.recruiting_class) : null,
      is_nfl_player:   !player.is_devy,
      is_picked:       true,
      picked_at:       new Date().toISOString(),
    }).eq('draft_id', draft_id).eq('overall', overall);

    // Advance draft
    const nextPick   = overall + 1;
    const totalPicks = draft.num_teams * draft.rounds;
    const isDone     = nextPick > totalPicks;

    await db.from('devy_drafts').update({
      current_pick: nextPick,
      status:       isDone ? 'complete' : 'active',
      completed_at: isDone ? new Date().toISOString() : null,
      updated_at:   new Date().toISOString(),
    }).eq('id', draft_id);

    return res.status(200).json({
      success: true,
      auto_picked: true,
      player_name: player.name,
      overall,
      is_complete: isDone,
    });
  } catch (err) {
    console.error('auto-pick error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
