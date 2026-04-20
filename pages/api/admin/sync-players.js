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
      error: 'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to Vercel environment variables.',
    });
  }

  const supabaseAdmin = createClient(url, svcKey);

  try {
    const sleeperRes = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!sleeperRes.ok) throw new Error(`Sleeper API error: ${sleeperRes.status}`);

    const sleeperPlayers = await sleeperRes.json();
    const SKILL_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K'];

    const relevant = Object.entries(sleeperPlayers)
      .filter(([, p]) =>
        p.active &&
        p.position &&
        SKILL_POSITIONS.includes(p.position) &&
        p.team &&
        p.full_name
      )
      .map(([id, p]) => ({
        sleeper_id:    id,
        name:          p.full_name,
        first_name:    p.first_name   || '',
        last_name:     p.last_name    || '',
        position:      p.position,
        nfl_team:      p.team,
        age:           p.age          || null,
        years_exp:     p.years_exp    || 0,
        college:       p.college      || null,
        height:        p.height       || null,
        weight:        p.weight       ? String(p.weight) : null,
        injury_status: p.injury_status || null,
        status:        p.status       || 'Active',
        is_active:     true,
        is_devy:       false,
        updated_at:    new Date().toISOString(),
      }));

    const BATCH = 100;
    let upserted = 0;
    const errors = [];

    for (let i = 0; i < relevant.length; i += BATCH) {
      const batch = relevant.slice(i, i + BATCH);
      const { error } = await supabaseAdmin
        .from('players')
        .upsert(batch, { onConflict: 'sleeper_id', ignoreDuplicates: false });

      if (error) {
        errors.push(error.message);
      } else {
        upserted += batch.length;
      }
    }

    return res.status(200).json({
      success: true,
      count: upserted,
      errors,
      message: `Synced ${upserted} players from Sleeper.`,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
