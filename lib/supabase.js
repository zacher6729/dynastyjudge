import { createClient } from '@supabase/supabase-js';

// ── Supabase client (browser-safe) ────────────────────────────────────────────
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://placeholder.supabase.co';
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, full_name: username },
    },
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Profile helpers ───────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}

export function isAdmin(profile) { return profile?.tier === 'admin'; }
export function isPro(profile)   { return ['pro','elite','creator','admin'].includes(profile?.tier); }
export function isElite(profile) { return ['elite','creator','admin'].includes(profile?.tier); }
export function isCreator(profile){ return profile?.is_creator === true; }

// ── Rankings helpers ──────────────────────────────────────────────────────────

/**
 * Get consensus rankings for a format
 * Returns players sorted by consensus_rank with all source ranks
 */
export async function getConsensusRankings(format = '1qb', limit = 300) {
  const { data, error } = await supabase
    .from('v_consensus_rankings')
    .select('*')
    .eq('format', format)
    .order('consensus_rank', { ascending: true })
    .limit(limit);
  return { data, error };
}

/**
 * Get a specific user's personal ranking board
 * If no board exists for this format, returns null (caller should create one)
 */
export async function getUserBoard(userId, format = '1qb') {
  const { data: board, error: boardErr } = await supabase
    .from('ranking_boards')
    .select('*')
    .eq('owner_id', userId)
    .eq('format', format)
    .in('type', ['community', 'personal'])
    .single();

  if (boardErr || !board) return { board: null, entries: [], error: boardErr };

  const { data: entries, error: entriesErr } = await supabase
    .from('ranking_entries')
    .select(`*, player:players(id, name, position, nfl_team, age, injury_status)`)
    .eq('board_id', board.id)
    .order('rank', { ascending: true });

  return { board, entries: entries || [], error: entriesErr };
}

/**
 * Create a personal ranking board for a user
 */
export async function createPersonalBoard(userId, format = '1qb') {
  const { data, error } = await supabase
    .from('ranking_boards')
    .insert({
      owner_id: userId,
      type: 'community',
      format,
      display_name: 'My Rankings',
      is_public: true,
      in_consensus: true,
    })
    .select()
    .single();
  return { data, error };
}

/**
 * Save/update a single player rank on a board
 */
export async function upsertRankingEntry(boardId, playerId, rank, extras = {}) {
  const { data, error } = await supabase
    .from('ranking_entries')
    .upsert({
      board_id: boardId,
      player_id: playerId,
      rank,
      updated_at: new Date().toISOString(),
      ...extras,
    }, { onConflict: 'board_id,player_id' })
    .select();
  return { data, error };
}

/**
 * Bulk save an entire rankings board (replaces all entries)
 * rankedPlayers: array of { player_id, rank, tier, note }
 */
export async function saveFullBoard(boardId, rankedPlayers) {
  // Delete existing entries
  await supabase.from('ranking_entries').delete().eq('board_id', boardId);

  if (!rankedPlayers.length) return { data: [], error: null };

  const entries = rankedPlayers.map((p, i) => ({
    board_id:  boardId,
    player_id: p.player_id,
    rank:      p.rank ?? i + 1,
    tier:      p.tier ?? null,
    note:      p.note ?? null,
    trade_value: p.trade_value ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('ranking_entries')
    .insert(entries)
    .select();
  return { data, error };
}

/**
 * Get all creator boards (for the rankings page creator tab)
 */
export async function getCreatorBoards(format = '1qb') {
  const { data, error } = await supabase
    .from('ranking_boards')
    .select(`
      *,
      owner:profiles(id, display_name, username, avatar_url, twitter_handle, creator_weight),
      entries:ranking_entries(rank, player:players(id, name, position, nfl_team))
    `)
    .eq('type', 'creator')
    .eq('format', format)
    .eq('is_active', true)
    .eq('is_public', true)
    .order('consensus_weight', { ascending: false });
  return { data, error };
}

/**
 * Get editorial board (DJ staff rankings)
 */
export async function getEditorialBoard(format = '1qb') {
  const { data: board, error: boardErr } = await supabase
    .from('ranking_boards')
    .select('*')
    .eq('type', 'editorial')
    .eq('format', format)
    .eq('is_active', true)
    .single();

  if (boardErr || !board) return { board: null, entries: [], error: boardErr };

  const { data: entries, error } = await supabase
    .from('ranking_entries')
    .select(`*, player:players(id, name, position, nfl_team, age, injury_status)`)
    .eq('board_id', board.id)
    .order('rank', { ascending: true });

  return { board, entries: entries || [], error };
}

/**
 * Get consensus weights for a format
 */
export async function getConsensusWeights(format = '1qb') {
  const { data, error } = await supabase
    .from('consensus_weights')
    .select('*')
    .eq('format', format)
    .single();
  return { data, error };
}

/**
 * Admin: update consensus weights
 */
export async function updateConsensusWeights(format, weights, adminId) {
  const { data, error } = await supabase
    .from('consensus_weights')
    .update({ ...weights, updated_at: new Date().toISOString(), updated_by: adminId })
    .eq('format', format)
    .select();
  return { data, error };
}

// ── Players helpers ───────────────────────────────────────────────────────────

export async function searchPlayers(query, position = null, limit = 50) {
  let q = supabase
    .from('players')
    .select('id, name, position, nfl_team, age, injury_status')
    .eq('is_active', true)
    .ilike('name', `%${query}%`)
    .limit(limit);

  if (position) q = q.eq('position', position);

  const { data, error } = await q.order('name');
  return { data, error };
}

export async function getAllPlayers(position = null) {
  let q = supabase
    .from('players')
    .select('id, name, position, nfl_team, age, injury_status, status')
    .eq('is_active', true)
    .order('name');

  if (position) q = q.eq('position', position);
  const { data, error } = await q;
  return { data, error };
}

// ── Real-time subscriptions ───────────────────────────────────────────────────

/**
 * Subscribe to live consensus ranking updates for a format
 * callback: function(payload) — called on every change
 * Returns the channel (call channel.unsubscribe() to clean up)
 */
export function subscribeToConsensus(format, callback) {
  return supabase
    .channel(`consensus:${format}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'consensus_rankings',
        filter: `format=eq.${format}`,
      },
      callback
    )
    .subscribe();
}

/**
 * Subscribe to a specific board's ranking entry changes
 */
export function subscribeToBoardChanges(boardId, callback) {
  return supabase
    .channel(`board:${boardId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ranking_entries',
        filter: `board_id=eq.${boardId}`,
      },
      callback
    )
    .subscribe();
}
