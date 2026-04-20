import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sleeper_ids } = req.body;
  if (!sleeper_ids?.length) {
    return res.status(200).json({ players: [] });
  }

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db     = createClient(url, svcKey);

  try {
    const { data, error } = await db
      .from('players')
      .select('id, sleeper_id, name, position, nfl_team, age, injury_status')
      .in('sleeper_id', sleeper_ids)
      .eq('is_active', true);

    if (error) throw error;

    // Return as map: sleeper_id -> player
    const map = {};
    (data || []).forEach(p => { map[p.sleeper_id] = p; });

    return res.status(200).json({ players: data || [], map });
  } catch (err) {
    return res.status(500).json({ error: err.message, players: [], map: {} });
  }
}
