import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db     = createClient(url, svcKey);

  // ── GET: fetch thread or conversation list ────────────────────────────────
  if (req.method === 'GET') {
    const { user_id, other_id, action } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    if (action === 'threads') {
      // Get all conversations for this user — latest message per thread
      const { data } = await db
        .from('messages')
        .select('*, sender:profiles!sender_id(id, username, display_name), recipient:profiles!recipient_id(id, username, display_name)')
        .or(`sender_id.eq.${user_id},recipient_id.eq.${user_id}`)
        .order('created_at', { ascending: false });

      // Group by conversation partner
      const threads = {};
      (data || []).forEach(msg => {
        const partnerId = msg.sender_id === user_id ? msg.recipient_id : msg.sender_id;
        const partner   = msg.sender_id === user_id ? msg.recipient : msg.sender;
        if (!threads[partnerId]) {
          threads[partnerId] = {
            partner_id:   partnerId,
            partner_name: partner?.display_name || partner?.username || 'Unknown',
            last_message: msg.body,
            last_at:      msg.created_at,
            unread:       msg.recipient_id === user_id && !msg.read ? 1 : 0,
          };
        } else if (msg.recipient_id === user_id && !msg.read) {
          threads[partnerId].unread++;
        }
      });

      return res.status(200).json({ threads: Object.values(threads).sort((a,b) => new Date(b.last_at) - new Date(a.last_at)) });
    }

    if (action === 'thread' && other_id) {
      // Mark messages as read
      await db.from('messages')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('recipient_id', user_id)
        .eq('sender_id', other_id)
        .eq('read', false);

      const { data } = await db
        .from('messages')
        .select('*, sender:profiles!sender_id(id, username, display_name)')
        .or(`and(sender_id.eq.${user_id},recipient_id.eq.${other_id}),and(sender_id.eq.${other_id},recipient_id.eq.${user_id})`)
        .order('created_at', { ascending: true });

      return res.status(200).json({ messages: data || [] });
    }

    if (action === 'can_message' && other_id) {
      // Check if user can message other_id
      // Allow if: friends OR share a Sleeper league (checked via devy_draft_invites or just open for now)
      const { data: friendship } = await db
        .from('friendships')
        .select('id, status')
        .or(`and(requester_id.eq.${user_id},addressee_id.eq.${other_id}),and(requester_id.eq.${other_id},addressee_id.eq.${user_id})`)
        .limit(1);

      const areFriends = friendship?.[0]?.status === 'accepted';

      // For now, also allow messaging anyone (can tighten later)
      // In production: check shared league membership via Sleeper
      return res.status(200).json({ can_message: true, are_friends: areFriends });
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, ...body } = req.body;

  // ── Send message ──────────────────────────────────────────────────────────
  if (action === 'send') {
    const { sender_id, recipient_id, message } = body;
    if (!sender_id || !recipient_id || !message?.trim()) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, error: 'Message too long (max 2000 chars)' });
    }
    if (sender_id === recipient_id) {
      return res.status(400).json({ success: false, error: "Can't message yourself" });
    }

    // Check if recipient exists
    const { data: recipient } = await db.from('profiles').select('id').eq('id', recipient_id).single();
    if (!recipient) return res.status(404).json({ success: false, error: 'Recipient not found' });

    const { data: msg, error } = await db.from('messages').insert({
      sender_id,
      recipient_id,
      body: message.trim(),
    }).select().single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    // Send notification
    await db.from('notifications').insert({
      user_id: recipient_id,
      type:    'message',
      title:   'New message',
      body:    message.slice(0, 80) + (message.length > 80 ? '...' : ''),
      link:    `/messages?with=${sender_id}`,
      data:    { sender_id },
    });

    return res.status(200).json({ success: true, message: msg });
  }

  // ── Friend request ────────────────────────────────────────────────────────
  if (action === 'friend_request') {
    const { requester_id, addressee_id } = body;
    const { data, error } = await db.from('friendships').upsert({
      requester_id,
      addressee_id,
      status: 'pending',
    }, { onConflict: 'requester_id,addressee_id' }).select().single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    // Notify
    await db.from('notifications').insert({
      user_id: addressee_id,
      type:    'friend_request',
      title:   'New friend request',
      body:    'Someone wants to connect with you on DynastyJudge',
      link:    `/profile`,
      data:    { requester_id },
    });

    return res.status(200).json({ success: true, friendship: data });
  }

  // ── Accept friend request ──────────────────────────────────────────────────
  if (action === 'accept_friend') {
    const { user_id, requester_id } = body;
    await db.from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', requester_id)
      .eq('addressee_id', user_id);
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ success: false, error: 'Unknown action' });
}
