import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db     = createClient(url, svcKey);

  if (req.method === 'GET') {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    const { data } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(20);

    return res.status(200).json({ notifications: data || [] });
  }

  if (req.method === 'POST') {
    const { action, user_id, notification_id } = req.body;

    if (action === 'mark_read') {
      if (notification_id) {
        await db.from('notifications').update({ read: true }).eq('id', notification_id).eq('user_id', user_id);
      } else {
        await db.from('notifications').update({ read: true }).eq('user_id', user_id).eq('read', false);
      }
      return res.status(200).json({ success: true });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
