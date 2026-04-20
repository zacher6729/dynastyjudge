import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db     = createClient(url, svcKey);

  // ── GET: Lookup invite by token ───────────────────────────────────────────
  if (req.method === 'GET') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, error: 'Missing token' });

    const { data: invite } = await db
      .from('devy_draft_invites')
      .select('*, draft:devy_drafts(id, name, league_name, num_teams, rounds, status, draft_order)')
      .eq('token', token)
      .single();

    if (!invite) return res.status(404).json({ success: false, error: 'Invite not found or expired' });
    return res.status(200).json({ success: true, invite });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, ...body } = req.body;

  // ── Invite a DynastyJudge user ────────────────────────────────────────────
  if (action === 'invite_user') {
    const { draft_id, roster_id, team_name, username } = body;

    // Find user by username
    const { data: profile } = await db
      .from('profiles')
      .select('id, display_name, username')
      .ilike('username', username.trim())
      .single();

    if (!profile) return res.status(404).json({ success: false, error: `No user found with username "${username}"` });

    // Create or update invite for this slot
    const { data: existing } = await db
      .from('devy_draft_invites')
      .select('id')
      .eq('draft_id', draft_id)
      .eq('roster_id', roster_id)
      .limit(1);

    let invite;
    if (existing?.[0]) {
      const { data } = await db
        .from('devy_draft_invites')
        .update({ assigned_user_id: profile.id, assigned_username: profile.username || profile.display_name, invite_type: 'user', status: 'pending' })
        .eq('id', existing[0].id).select().single();
      invite = data;
    } else {
      const { data } = await db
        .from('devy_draft_invites')
        .insert({ draft_id, roster_id, team_name, assigned_user_id: profile.id, assigned_username: profile.username || profile.display_name, invite_type: 'user', status: 'pending' })
        .select().single();
      invite = data;
    }

    // Load draft info for notification
    const { data: draft } = await db.from('devy_drafts').select('name, league_name').eq('id', draft_id).single();

    // Send notification
    await db.from('notifications').insert({
      user_id: profile.id,
      type:    'draft_invite',
      title:   `You've been invited to a devy draft`,
      body:    `${draft?.name || 'A devy draft'} — you're assigned to ${team_name || `Team ${roster_id}`}`,
      link:    `/devy/draft/${draft_id}?token=${invite.token}`,
      data:    { draft_id, roster_id, token: invite.token },
    });

    return res.status(200).json({ success: true, invite, invite_link: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://dynastyjudge.vercel.app'}/devy/join/${invite.token}` });
  }

  // ── Generate invite link for a slot ──────────────────────────────────────
  if (action === 'create_link') {
    const { draft_id, roster_id, team_name } = body;

    // Check if invite exists for this slot
    const { data: existing } = await db
      .from('devy_draft_invites')
      .select('*')
      .eq('draft_id', draft_id)
      .eq('roster_id', roster_id)
      .limit(1);

    let invite;
    if (existing?.[0]) {
      invite = existing[0];
    } else {
      const { data } = await db
        .from('devy_draft_invites')
        .insert({ draft_id, roster_id, team_name, invite_type: 'link', status: 'pending' })
        .select().single();
      invite = data;
    }

    const link = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://dynastyjudge.vercel.app'}/devy/join/${invite.token}`;
    return res.status(200).json({ success: true, token: invite.token, invite_link: link });
  }

  // ── Accept invite ─────────────────────────────────────────────────────────
  if (action === 'accept') {
    const { token, user_id } = body;

    const { data: invite } = await db
      .from('devy_draft_invites')
      .select('*')
      .eq('token', token)
      .single();

    if (!invite) return res.status(404).json({ success: false, error: 'Invite not found' });
    if (invite.status === 'accepted') return res.status(200).json({ success: true, already_accepted: true, draft_id: invite.draft_id, roster_id: invite.roster_id });

    // Mark accepted
    await db.from('devy_draft_invites').update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      assigned_user_id: user_id || invite.assigned_user_id,
    }).eq('id', invite.id);

    // Store roster ID for this user in draft
    // (client stores in localStorage; we also persist in the invite record)

    return res.status(200).json({ success: true, draft_id: invite.draft_id, roster_id: invite.roster_id, team_name: invite.team_name });
  }

  // ── List invites for a draft ──────────────────────────────────────────────
  if (action === 'list') {
    const { draft_id } = body;
    const { data } = await db
      .from('devy_draft_invites')
      .select('*')
      .eq('draft_id', draft_id)
      .order('roster_id');
    return res.status(200).json({ success: true, invites: data || [] });
  }

  return res.status(400).json({ success: false, error: 'Unknown action' });
}
