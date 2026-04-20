import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db     = createClient(url, svcKey);

  const { action, ...body } = req.body;

  try {
    if (action === 'propose') {
      // Create trade offer
      const { draft_id, proposing_roster_id, receiving_roster_id,
              proposing_name, receiving_name,
              proposing_gives, receiving_gives } = body;

      const { data: trade, error } = await db
        .from('devy_draft_trades')
        .insert({
          draft_id, proposing_roster_id, receiving_roster_id,
          proposing_name, receiving_name,
          proposing_gives, receiving_gives,
          status: 'pending',
        })
        .select().single();

      if (error) throw new Error(error.message);
      return res.status(200).json({ success: true, trade_id: trade.id });
    }

    if (action === 'accept') {
      const { trade_id } = body;

      // Load trade
      const { data: trade } = await db
        .from('devy_draft_trades').select('*').eq('id', trade_id).single();
      if (!trade || trade.status !== 'pending') throw new Error('Trade not found or already resolved');

      const { data: draft } = await db
        .from('devy_drafts').select('*').eq('id', trade.draft_id).single();
      if (!draft) throw new Error('Draft not found');

      // Process pick transfers
      const allGives = [
        ...trade.proposing_gives.map(a => ({ ...a, from: trade.proposing_roster_id, to: trade.receiving_roster_id })),
        ...trade.receiving_gives.map(a => ({ ...a, from: trade.receiving_roster_id, to: trade.proposing_roster_id })),
      ];

      for (const asset of allGives) {
        if (asset.type === 'pick') {
          // Transfer pick ownership
          const { error } = await db
            .from('devy_picks')
            .update({
              current_roster_id: asset.to,
              owner_name: asset.to === trade.proposing_roster_id
                ? trade.proposing_name : trade.receiving_name,
              is_traded: true,
            })
            .eq('draft_id', trade.draft_id)
            .eq('overall', asset.pick_overall)
            .eq('is_picked', false);  // Can't trade already-used picks

          if (error) throw new Error(`Failed to transfer pick: ${error.message}`);
        }
        // Player transfers are tracked in the trade record for the recap
        // (devy players don't have a roster table yet — commissioner applies manually)
      }

      // Mark trade accepted
      await db.from('devy_draft_trades').update({
        status: 'accepted',
        approved_at: new Date().toISOString(),
      }).eq('id', trade_id);

      return res.status(200).json({ success: true, message: 'Trade accepted and picks transferred' });
    }

    if (action === 'reject' || action === 'cancel') {
      const { trade_id } = body;
      await db.from('devy_draft_trades')
        .update({ status: action === 'reject' ? 'rejected' : 'cancelled' })
        .eq('id', trade_id);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    console.error('draft-trade error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
