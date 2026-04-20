import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useSleeper — manages Sleeper connection across all pages
 *
 * Loads sleeper_user_id from the user's Supabase profile on mount.
 * Falls back to localStorage for non-logged-in users.
 * Provides connect/disconnect functions.
 *
 * Usage:
 *   const { sleeperId, sleeperUsername, connecting, connect, disconnect } = useSleeper();
 */
export function useSleeper() {
  const [sleeperId, setId]         = useState('');
  const [sleeperUsername, setUser] = useState('');
  const [sleeperAvatar, setAvatar] = useState('');
  const [leagues, setLeagues]      = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading]      = useState(true); // true until we've checked profile
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [error, setError]          = useState('');
  const [session, setSession]      = useState(null);

  // Load connection on mount
  useEffect(() => {
    async function load() {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);

      if (s) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('sleeper_user_id, sleeper_username, sleeper_avatar')
          .eq('id', s.user.id)
          .single();

        if (profile?.sleeper_user_id) {
          setId(profile.sleeper_user_id);
          setUser(profile.sleeper_username || '');
          setAvatar(profile.sleeper_avatar || '');
          setLoading(false);
          return;
        }
      }

      // Fall back to localStorage
      const lsId   = localStorage.getItem('sleeper_user_id');
      const lsUser = localStorage.getItem('sleeper_username');
      if (lsId) { setId(lsId); setUser(lsUser || ''); }
      setLoading(false);
    }
    load();
  }, []);

  // Connect a Sleeper account
  const connect = useCallback(async (username) => {
    setConnecting(true);
    setError('');
    try {
      // Verify username on Sleeper
      const res = await fetch(`https://api.sleeper.app/v1/user/${username.trim()}`);
      if (!res.ok) throw new Error('Sleeper username not found. Check the spelling.');
      const sleeperUser = await res.json();
      if (!sleeperUser?.user_id) throw new Error('Could not find that Sleeper account.');

      const uid      = sleeperUser.user_id;
      const uname    = sleeperUser.username;
      const uavatar  = sleeperUser.avatar || '';

      // Save to state
      setId(uid);
      setUser(uname);
      setAvatar(uavatar);

      // Save to localStorage always
      localStorage.setItem('sleeper_user_id', uid);
      localStorage.setItem('sleeper_username', uname);

      // Save to Supabase profile if logged in
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s) {
        await supabase
          .from('profiles')
          .update({
            sleeper_user_id:  uid,
            sleeper_username: uname,
            sleeper_avatar:   uavatar,
            updated_at:       new Date().toISOString(),
          })
          .eq('id', s.user.id);
      }

      return { success: true, user: sleeperUser };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setConnecting(false);
    }
  }, []);

  // Disconnect Sleeper account
  const disconnect = useCallback(async () => {
    setId('');
    setUser('');
    setAvatar('');
    setLeagues([]);
    localStorage.removeItem('sleeper_user_id');
    localStorage.removeItem('sleeper_username');

    const { data: { session: s } } = await supabase.auth.getSession();
    if (s) {
      await supabase
        .from('profiles')
        .update({
          sleeper_user_id:  null,
          sleeper_username: null,
          sleeper_avatar:   null,
          updated_at:       new Date().toISOString(),
        })
        .eq('id', s.user.id);
    }
  }, []);

  // Load leagues for the connected user
  const loadLeagues = useCallback(async (season = '2026') => {
    if (!sleeperId) return [];
    setLoadingLeagues(true);
    try {
      const res    = await fetch(`https://api.sleeper.app/v1/user/${sleeperId}/leagues/nfl/${season}`);
      const data   = await res.json();
      setLeagues(data || []);
      return data || [];
    } catch {
      return [];
    } finally {
      setLoadingLeagues(false);
    }
  }, [sleeperId]);

  return {
    sleeperId,
    sleeperUsername,
    sleeperAvatar,
    leagues,
    connecting,
    loading,
    loadingLeagues,
    error,
    isConnected: !!sleeperId,
    connect,
    disconnect,
    loadLeagues,
  };
}

/**
 * usePlayerSearch — fast player search via our API
 *
 * Usage:
 *   const { results, search, loading } = usePlayerSearch();
 *   search('ceedee');  // triggers debounced search
 */
export function usePlayerSearch({ position = null, devy = false, limit = 20 } = {}) {
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [query, setQuery]       = useState('');

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query, limit });
        if (position) params.set('position', position);
        if (devy) params.set('devy', 'true');

        const res  = await fetch(`/api/players/search?${params}`);
        const data = await res.json();
        setResults(data.players || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200); // 200ms debounce

    return () => clearTimeout(timer);
  }, [query, position, devy, limit]);

  return { results, loading, query, search: setQuery };
}
