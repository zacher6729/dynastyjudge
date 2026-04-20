/**
 * DynastyJudge — Sleeper API Client
 * Read-only. No auth token required.
 * Rate limit: 1,000 req/min — cache aggressively.
 */

const BASE     = 'https://api.sleeper.app/v1';
const STATS    = 'https://api.sleeper.app/v1';
const WS_DRAFT = 'wss://draftservice.sleeper.app/ws/v2/draft';

// ─── Cache layer (in-memory, replace with Redis in production) ────────────────
const cache = new Map();

function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data);
  return fn().then(data => {
    cache.set(key, { data, ts: Date.now() });
    return data;
  });
}

const TTL = {
  PLAYER:      24 * 60 * 60 * 1000,  // 24 hours
  LEAGUE:       5 * 60 * 1000,        // 5 minutes
  ROSTER:       2 * 60 * 1000,        // 2 minutes (lineup change detection)
  MATCHUP:      2 * 60 * 1000,
  TRANSACTIONS: 5 * 60 * 1000,
  DRAFT:        1 * 60 * 1000,
};

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sleeper API error: ${res.status} ${url}`);
  return res.json();
}

// ─── USER ────────────────────────────────────────────────────────────────────
export async function getUser(username) {
  return cached(`user:${username}`, TTL.LEAGUE, () =>
    get(`${BASE}/user/${username}`)
  );
}

export async function getUserByID(userId) {
  return cached(`user-id:${userId}`, TTL.LEAGUE, () =>
    get(`${BASE}/user/${userId}`)
  );
}

// ─── LEAGUES ─────────────────────────────────────────────────────────────────
export async function getUserLeagues(userId, sport = 'nfl', season = '2026') {
  return cached(`leagues:${userId}:${season}`, TTL.LEAGUE, () =>
    get(`${BASE}/user/${userId}/leagues/${sport}/${season}`)
  );
}

export async function getLeague(leagueId) {
  return cached(`league:${leagueId}`, TTL.LEAGUE, () =>
    get(`${BASE}/league/${leagueId}`)
  );
}

// ─── ROSTERS ─────────────────────────────────────────────────────────────────
export async function getRosters(leagueId) {
  return cached(`rosters:${leagueId}`, TTL.ROSTER, () =>
    get(`${BASE}/league/${leagueId}/rosters`)
  );
}

export async function getUsers(leagueId) {
  return cached(`users:${leagueId}`, TTL.LEAGUE, () =>
    get(`${BASE}/league/${leagueId}/users`)
  );
}

// ─── MATCHUPS ────────────────────────────────────────────────────────────────
export async function getMatchups(leagueId, week) {
  return cached(`matchups:${leagueId}:${week}`, TTL.MATCHUP, () =>
    get(`${BASE}/league/${leagueId}/matchups/${week}`)
  );
}

// ─── TRANSACTIONS ────────────────────────────────────────────────────────────
export async function getTransactions(leagueId, week) {
  return cached(`transactions:${leagueId}:${week}`, TTL.TRANSACTIONS, () =>
    get(`${BASE}/league/${leagueId}/transactions/${week}`)
  );
}

export async function getTradedPicks(leagueId) {
  return cached(`tradedpicks:${leagueId}`, TTL.TRANSACTIONS, () =>
    get(`${BASE}/league/${leagueId}/traded_picks`)
  );
}

// ─── DRAFTS ──────────────────────────────────────────────────────────────────
export async function getLeagueDrafts(leagueId) {
  return cached(`drafts:${leagueId}`, TTL.DRAFT, () =>
    get(`${BASE}/league/${leagueId}/drafts`)
  );
}

export async function getDraft(draftId) {
  return cached(`draft:${draftId}`, TTL.DRAFT, () =>
    get(`${BASE}/draft/${draftId}`)
  );
}

export async function getDraftPicks(draftId) {
  return cached(`draftpicks:${draftId}`, TTL.DRAFT, () =>
    get(`${BASE}/draft/${draftId}/picks`)
  );
}

// ─── PLAYERS ─────────────────────────────────────────────────────────────────
// Heavy call (~5MB) — call once per day max
export async function getAllPlayers(sport = 'nfl') {
  return cached(`allplayers:${sport}`, TTL.PLAYER, () =>
    get(`${BASE}/players/${sport}`)
  );
}

export async function getTrendingPlayers(sport = 'nfl', type = 'add', lookback = 24, limit = 25) {
  return get(`${BASE}/players/${sport}/trending/${type}?lookback_hours=${lookback}&limit=${limit}`);
}

// ─── STATS ───────────────────────────────────────────────────────────────────
export async function getPlayerStats(season, week, sport = 'nfl') {
  const type = week ? `week/${week}` : 'totals';
  return cached(`stats:${season}:${week}`, TTL.MATCHUP, () =>
    get(`${STATS}/stats/${sport}/regular/${season}/${week || ''}`)
  );
}

// ─── WEBSOCKET: LIVE DRAFT ───────────────────────────────────────────────────
/**
 * Connect to a live draft and receive real-time pick events.
 *
 * Usage:
 *   const ws = connectDraftWebSocket(draftId, {
 *     onPick: (pick) => console.log('Pick made:', pick),
 *     onClock: (state) => console.log('On the clock:', state),
 *     onDisconnect: () => console.log('Disconnected'),
 *   });
 *   // Later: ws.close();
 */
export function connectDraftWebSocket(draftId, { onPick, onClock, onStateChange, onDisconnect }) {
  const ws = new WebSocket(`${WS_DRAFT}/${draftId}`);

  ws.onopen = () => {
    console.log(`[DraftWS] Connected to draft ${draftId}`);
    ws.send(JSON.stringify({ type: 'subscribe_draft', draft_id: draftId }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'picked':
          onPick?.(msg.payload);
          break;
        case 'draft_update':
          onStateChange?.(msg.payload);
          break;
        case 'clock_updated':
          onClock?.(msg.payload);
          break;
        default:
          break;
      }
    } catch (e) {
      console.error('[DraftWS] Parse error:', e);
    }
  };

  ws.onerror = (err) => console.error('[DraftWS] Error:', err);
  ws.onclose = () => onDisconnect?.();

  return ws;
}

// ─── HELPER: Build full league snapshot ──────────────────────────────────────
/**
 * Returns a combined object with league info, rosters, users, and current
 * week's matchups — everything needed to render the league dashboard.
 */
export async function getLeagueSnapshot(leagueId, week) {
  const [league, rosters, users, matchups] = await Promise.all([
    getLeague(leagueId),
    getRosters(leagueId),
    getUsers(leagueId),
    getMatchups(leagueId, week),
  ]);

  const userMap = Object.fromEntries(users.map(u => [u.user_id, u]));

  const teams = rosters.map(r => ({
    ...r,
    display_name: userMap[r.owner_id]?.display_name ?? 'Unknown',
    avatar: userMap[r.owner_id]?.avatar,
    matchup: matchups.find(m => m.roster_id === r.roster_id),
  }));

  return { league, teams, week };
}

// ─── HELPER: Find player across all leagues ───────────────────────────────────
/**
 * Given a userId + playerId, returns all leagues where that player
 * is in the user's active starting lineup (not bench, not IR).
 *
 * This powers the "Player → Leagues" tool and lineup update tracker.
 */
export async function findPlayerAcrossLeagues(userId, playerId, season = '2026') {
  const leagues = await getUserLeagues(userId, 'nfl', season);
  const results = [];

  await Promise.all(leagues.map(async (league) => {
    const rosters = await getRosters(league.league_id);
    const myRoster = rosters.find(r => r.owner_id === userId);
    if (!myRoster) return;

    const isStarter = myRoster.starters?.includes(playerId);
    const isOnRoster = myRoster.players?.includes(playerId);

    if (isOnRoster) {
      results.push({
        league_id: league.league_id,
        league_name: league.name,
        scoring_settings: league.scoring_settings,
        roster_positions: league.roster_positions,
        total_rosters: league.total_rosters,
        is_starter: isStarter,
        slot: isStarter
          ? myRoster.starters.indexOf(playerId)
          : 'bench',
        starters: myRoster.starters,
        players: myRoster.players,
      });
    }
  }));

  return results.sort((a, b) => (b.is_starter ? 1 : 0) - (a.is_starter ? 1 : 0));
}

// ─── HELPER: Leaguemate tendency analysis ────────────────────────────────────
/**
 * For a given league, analyzes all draft picks across all historical
 * drafts and builds behavioral profiles for each manager.
 *
 * Returns: Map of roster_id → profile object with positional tendencies,
 * round preferences, age bias, and trade/waiver aggressiveness.
 */
export async function buildLeaguemateTendencies(leagueId) {
  const [rosters, users, drafts] = await Promise.all([
    getRosters(leagueId),
    getUsers(leagueId),
    getLeagueDrafts(leagueId),
  ]);

  const profiles = {};
  const userMap = Object.fromEntries(users.map(u => [u.user_id, u]));
  const rosterMap = Object.fromEntries(rosters.map(r => [r.roster_id, r]));

  // Init profiles
  rosters.forEach(r => {
    profiles[r.roster_id] = {
      display_name: userMap[r.owner_id]?.display_name ?? 'Unknown',
      picks: [],
      pos_by_round: {},       // { round: { pos: count } }
      pos_totals: {},          // { pos: count }
      reach_tendency: 0,       // avg (adp - pick_no) — positive = reaches
      age_bias: null,          // 'youth' | 'veteran' | 'balanced'
      qb_round: [],            // rounds where they've taken QBs
      rb_hoarding: false,      // takes >40% RBs
    };
  });

  // Process each draft
  await Promise.all(drafts.map(async (draft) => {
    if (draft.status !== 'complete') return;
    const picks = await getDraftPicks(draft.draft_id);

    picks.forEach(pick => {
      const profile = profiles[pick.roster_id];
      if (!profile) return;

      profile.picks.push(pick);

      // Round-by-round position tracking
      const round = pick.round;
      if (!profile.pos_by_round[round]) profile.pos_by_round[round] = {};
      const pos = pick.metadata?.position ?? 'UNK';
      profile.pos_by_round[round][pos] = (profile.pos_by_round[round][pos] || 0) + 1;
      profile.pos_totals[pos] = (profile.pos_totals[pos] || 0) + 1;

      if (pos === 'QB') profile.qb_round.push(round);
    });

    // Compute derived metrics
    Object.values(profiles).forEach(p => {
      const totalPicks = Object.values(p.pos_totals).reduce((a,b)=>a+b,0);
      if (totalPicks === 0) return;
      const rbPct = (p.pos_totals['RB'] || 0) / totalPicks;
      p.rb_hoarding = rbPct > 0.40;
      p.avg_qb_round = p.qb_round.length
        ? (p.qb_round.reduce((a,b)=>a+b,0) / p.qb_round.length).toFixed(1)
        : null;
      p.top_position = Object.entries(p.pos_totals).sort(([,a],[,b])=>b-a)[0]?.[0];
    });
  }));

  return profiles;
}
