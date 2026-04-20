import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db     = createClient(url, svcKey);

  const {
    name, sleeper_league_id, sleeper_league_name,
    rounds = 5, seconds_per_pick = 90, snake_draft = true,
    include_nfl_players = false, include_devy = true,
    devy_classes = ['2027', '2028'],
    draft_order,           // [{roster_id, team_name, owner_name, sleeper_user_id}]
    commissioner_id, commissioner_name,
    num_teams,
  } = req.body;

  if (!name || !draft_order?.length) {
    return res.status(400).json({ success: false, error: 'Missing name or draft_order' });
  }

  const teams = num_teams || draft_order.length;

  try {
    // 1. Create draft
    const { data: draft, error: draftErr } = await db
      .from('devy_drafts')
      .insert({
        name,
        league_name:         sleeper_league_name || name,
        sleeper_league_id:   sleeper_league_id || null,
        num_teams:           teams,
        rounds,
        seconds_per_pick,
        snake_draft,
        include_nfl_players,
        include_devy,
        devy_classes,
        status:              'setup',
        current_pick:        1,
        draft_order,
        commissioner_id:     commissioner_id || null,
        commissioner_name:   commissioner_name || null,
      })
      .select()
      .single();

    if (draftErr) throw new Error(draftErr.message);

    // 2. Generate all pick slots
    const picks = [];
    for (let round = 1; round <= rounds; round++) {
      for (let slot = 1; slot <= teams; slot++) {
        // Snake: odd rounds go 1→N, even rounds go N→1
        const pickInRound  = snake_draft && round % 2 === 0 ? (teams - slot + 1) : slot;
        const teamIndex    = pickInRound - 1;
        const team         = draft_order[teamIndex];
        const overall      = (round - 1) * teams + slot;

        picks.push({
          draft_id:           draft.id,
          overall,
          round,
          pick_in_round:      slot,
          original_roster_id: team?.roster_id || teamIndex + 1,
          current_roster_id:  team?.roster_id || teamIndex + 1,
          owner_name:         team?.owner_name || `Team ${teamIndex + 1}`,
          is_picked:          false,
          is_traded:          false,
        });
      }
    }

    const { error: picksErr } = await db.from('devy_picks').insert(picks);
    if (picksErr) throw new Error(picksErr.message);

    return res.status(200).json({ success: true, draft_id: draft.id, pick_count: picks.length });
  } catch (err) {
    console.error('create-devy-draft error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
