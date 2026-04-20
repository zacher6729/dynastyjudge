import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, position, limit = 20, devy = 'false' } = req.query;

  if (!q || q.length < 2) {
    return res.status(200).json({ players: [] });
  }

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db     = createClient(url, svcKey);

  try {
    let query = db
      .from('players')
      .select('id, name, position, nfl_team, age, injury_status, sleeper_id, is_devy')
      .eq('is_active', true)
      .eq('is_devy', devy === 'true')
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(parseInt(limit));

    if (position && position !== 'ALL') {
      query = query.eq('position', position);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ players: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message, players: [] });
  }
}
