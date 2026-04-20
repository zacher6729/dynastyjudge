import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db     = createClient(url, svcKey);

  const { draft_id, overall, player_id, roster_id } = req.body;
  if (!draft_id || !overall || !player_id) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    // Verify draft is active
    const { data: draft } = await db
      .from('devy_drafts').select('*').eq('id', draft_id).single();

    if (!draft) throw new Error('Draft not found');
    if (draft.status !== 'active') throw new Error('Draft is not active');
    if (draft.current_pick !== overall) throw new Error(`Not pick #${overall}. Current pick is #${draft.current_pick}`);

    // Verify the pick slot belongs to this roster
    const { data: pickSlot } = await db
      .from('devy_picks')
      .select('*')
      .eq('draft_id', draft_id)
      .eq('overall', overall)
      .single();

    if (!pickSlot) throw new Error('Pick slot not found');
    if (pickSlot.is_picked) throw new Error('This pick has already been made');
    if (pickSlot.current_roster_id !== roster_id) {
      throw new Error('This pick does not belong to your team');
    }

    // Verify player exists and is not already drafted
    const { data: player } = await db
      .from('players').select('*').eq('id', player_id).single();
    if (!player) throw new Error('Player not found');

    const { data: alreadyDrafted } = await db
      .from('devy_picks')
      .select('id')
      .eq('draft_id', draft_id)
      .eq('player_id', player_id)
      .eq('is_picked', true)
      .limit(1);

    if (alreadyDrafted?.length) throw new Error(`${player.name} has already been drafted`);

    // Make the pick
    const { error: pickErr } = await db
      .from('devy_picks')
      .update({
        player_id,
        player_name:     player.name,
        player_position: player.position,
        player_class:    player.recruiting_class ? String(player.recruiting_class) : null,
        is_nfl_player:   !player.is_devy,
        is_picked:       true,
        picked_at:       new Date().toISOString(),
      })
      .eq('draft_id', draft_id)
      .eq('overall', overall);

    if (pickErr) throw new Error(pickErr.message);

    // Advance draft
    const nextPick = overall + 1;
    const totalPicks = draft.num_teams * draft.rounds;
    const isDone = nextPick > totalPicks;

    await db.from('devy_drafts').update({
      current_pick: nextPick,
      status:       isDone ? 'complete' : 'active',
      completed_at: isDone ? new Date().toISOString() : null,
      updated_at:   new Date().toISOString(),
    }).eq('id', draft_id);

    return res.status(200).json({
      success: true,
      overall,
      player_name: player.name,
      is_complete: isDone,
      next_pick:   isDone ? null : nextPick,
    });
  } catch (err) {
    console.error('make-pick error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
