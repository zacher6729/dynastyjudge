import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db     = createClient(url, svcKey);

  const { action, draft_id, ...body } = req.body;
  if (!draft_id) return res.status(400).json({ success: false, error: 'Missing draft_id' });

  try {
    const { data: draft } = await db
      .from('devy_drafts').select('*').eq('id', draft_id).single();
    if (!draft) throw new Error('Draft not found');

    if (action === 'start') {
      if (draft.status !== 'setup' && draft.status !== 'paused') {
        throw new Error('Draft can only be started from setup or paused state');
      }
      await db.from('devy_drafts').update({
        status:     'active',
        started_at: draft.started_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', draft_id);
      return res.status(200).json({ success: true, status: 'active' });
    }

    if (action === 'pause') {
      await db.from('devy_drafts').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', draft_id);
      return res.status(200).json({ success: true, status: 'paused' });
    }

    if (action === 'reset_order') {
      // Reorder draft based on last season standings (worst record picks first)
      const { draft_order } = body;
      if (!draft_order?.length) throw new Error('Missing draft_order');

      // Rebuild all pick slots with new order
      await db.from('devy_picks').delete().eq('draft_id', draft_id).eq('is_picked', false);

      const picks = [];
      const { rounds, num_teams, snake_draft } = draft;
      // Find what overall pick we're on
      const startOverall = draft.current_pick;

      // Only rebuild future picks
      for (let overall = startOverall; overall <= rounds * num_teams; overall++) {
        const round = Math.ceil(overall / num_teams);
        const slotInRound = overall - (round - 1) * num_teams;
        const pickInRound = snake_draft && round % 2 === 0
          ? num_teams - slotInRound + 1
          : slotInRound;
        const teamIndex  = pickInRound - 1;
        const team       = draft_order[teamIndex];

        picks.push({
          draft_id,
          overall,
          round,
          pick_in_round:      slotInRound,
          original_roster_id: team?.roster_id || teamIndex + 1,
          current_roster_id:  team?.roster_id || teamIndex + 1,
          owner_name:         team?.owner_name || `Team ${teamIndex + 1}`,
          is_picked:          false,
          is_traded:          false,
        });
      }

      if (picks.length) {
        const { error } = await db.from('devy_picks').insert(picks);
        if (error) throw new Error(error.message);
      }

      await db.from('devy_drafts').update({
        draft_order,
        updated_at: new Date().toISOString(),
      }).eq('id', draft_id);

      return res.status(200).json({ success: true, message: 'Draft order reset', picks_rebuilt: picks.length });
    }

    if (action === 'update_settings') {
      const { include_nfl_players, include_devy, devy_classes, seconds_per_pick } = body;
      if (draft.status === 'complete') throw new Error('Cannot update a completed draft');

      await db.from('devy_drafts').update({
        ...(include_nfl_players !== undefined && { include_nfl_players }),
        ...(include_devy !== undefined && { include_devy }),
        ...(devy_classes && { devy_classes }),
        ...(seconds_per_pick && { seconds_per_pick }),
        updated_at: new Date().toISOString(),
      }).eq('id', draft_id);

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('control-draft error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
