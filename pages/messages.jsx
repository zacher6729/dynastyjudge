import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Nav from '../components/Nav';
import { supabase } from '../lib/supabase';

export default function Messages() {
  const router = useRouter();
  const { with: withUserId } = router.query;

  const [session, setSession]       = useState(null);
  const [profile, setProfile]       = useState(null);
  const [threads, setThreads]       = useState([]);
  const [activeThread, setActive]   = useState(null); // partner profile
  const [messages, setMessages]     = useState([]);
  const [newMsg, setNewMsg]         = useState('');
  const [sending, setSending]       = useState(false);
  const [searchUser, setSearch]     = useState('');
  const [searchResults, setResults] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const bottomRef                   = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) { router.push('/login'); return; }
      setSession(s);
      const { data: p } = await supabase.from('profiles').select('id, username, display_name').eq('id', s.user.id).single();
      setProfile(p);
      loadThreads(s.user.id);
    });
  }, []);

  // Open a specific thread if ?with= param provided
  useEffect(() => {
    if (!withUserId || !profile) return;
    openThread(withUserId);
  }, [withUserId, profile]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!profile) return;
    const channel = supabase.channel(`messages_${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${profile.id}`,
      }, payload => {
        if (activeThread?.id === payload.new.sender_id) {
          // In the active thread — add message and mark read
          setMessages(prev => [...prev, { ...payload.new, sender: profile }]);
          fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send', sender_id: profile.id, recipient_id: payload.new.sender_id }),
          });
        }
        loadThreads(profile.id);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile, activeThread]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadThreads(userId) {
    const res  = await fetch(`/api/messages?user_id=${userId}&action=threads`);
    const data = await res.json();
    setThreads(data.threads || []);
    setLoading(false);
  }

  async function openThread(partnerId) {
    if (!profile) return;
    // Load partner profile
    const { data: partner } = await supabase.from('profiles').select('id, username, display_name').eq('id', partnerId).single();
    setActive(partner);
    // Load messages
    const res  = await fetch(`/api/messages?user_id=${profile.id}&other_id=${partnerId}&action=thread`);
    const data = await res.json();
    setMessages(data.messages || []);
    loadThreads(profile.id);
  }

  async function sendMessage() {
    if (!newMsg.trim() || !activeThread || !profile) return;
    setSending(true);
    const text = newMsg.trim();
    setNewMsg('');

    // Optimistic update
    const optimistic = { id: `temp-${Date.now()}`, sender_id: profile.id, recipient_id: activeThread.id, body: text, created_at: new Date().toISOString(), sender: profile, read: false };
    setMessages(prev => [...prev, optimistic]);

    const res  = await fetch('/api/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'send', sender_id: profile.id, recipient_id: activeThread.id, message: text }),
    });
    const data = await res.json();
    if (data.success) {
      // Replace optimistic with real
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data.message : m));
      loadThreads(profile.id);
    }
    setSending(false);
  }

  // Search users to start new conversation
  useEffect(() => {
    if (!searchUser || searchUser.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from('profiles').select('id, username, display_name').ilike('username', `%${searchUser}%`).limit(8);
      setResults((data || []).filter(u => u.id !== profile?.id));
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchUser, profile]);

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    return d.toLocaleDateString([], { month:'short', day:'numeric' });
  }

  const unreadCount = threads.filter(t => t.unread > 0).length;

  return (
    <>
      <Head><title>Messages — DynastyJudge</title></Head>
      <Nav />

      <main style={{ minHeight:'100vh', paddingBottom:'4rem' }}>
        <div style={{ maxWidth:900, margin:'0 auto', padding:'1.5rem 1rem' }}>

          <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:'1rem', height:'calc(100vh - 140px)' }}>

            {/* ── LEFT: Thread list ── */}
            <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ padding:'1rem', borderBottom:'0.5px solid var(--border-subtle)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                  <h1 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text-primary)' }}>
                    Messages {unreadCount > 0 && <span style={{ fontSize:'0.75rem', padding:'1px 7px', borderRadius:99, background:'#F87171', color:'#fff', marginLeft:4 }}>{unreadCount}</span>}
                  </h1>
                </div>
                {/* New conversation search */}
                <div style={{ position:'relative' }}>
                  <input type="text" placeholder="Find a user..." value={searchUser} onChange={e => setSearch(e.target.value)}
                    style={{ width:'100%', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.8125rem', fontFamily:'var(--font-body)', outline:'none' }} />
                  {searchResults.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg-secondary)', border:'0.5px solid var(--border-default)', borderRadius:'var(--radius-md)', zIndex:50, overflow:'hidden', marginTop:4 }}>
                      {searchResults.map(u => (
                        <button key={u.id} onClick={() => { openThread(u.id); setSearch(''); setResults([]); }}
                          style={{ display:'block', width:'100%', padding:'0.625rem 0.875rem', background:'none', border:'none', borderBottom:'0.5px solid var(--border-subtle)', cursor:'pointer', textAlign:'left', fontFamily:'var(--font-body)', color:'var(--text-primary)', fontSize:'0.875rem' }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--bg-tertiary)'}
                          onMouseLeave={e => e.currentTarget.style.background='none'}
                        >
                          {u.display_name || u.username}
                          <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginLeft:6 }}>@{u.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Thread list */}
              <div style={{ flex:1, overflowY:'auto' }}>
                {loading && <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem' }}>Loading...</div>}
                {!loading && threads.length === 0 && (
                  <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem' }}>
                    No conversations yet.<br/>Search for a user above to start one.
                  </div>
                )}
                {threads.map(t => (
                  <button key={t.partner_id}
                    onClick={() => openThread(t.partner_id)}
                    style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'0.875rem 1rem', background: activeThread?.id === t.partner_id ? 'var(--bg-tertiary)' : 'none', border:'none', borderBottom:'0.5px solid var(--border-subtle)', cursor:'pointer', textAlign:'left', fontFamily:'var(--font-body)' }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--bg-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.875rem', fontWeight:700, color:'var(--text-muted)', flexShrink:0 }}>
                      {(t.partner_name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span style={{ fontSize:'0.875rem', fontWeight: t.unread > 0 ? 700 : 500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.partner_name}</span>
                        <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', flexShrink:0, marginLeft:4 }}>{formatTime(t.last_at)}</span>
                      </div>
                      <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {t.last_message}
                      </div>
                    </div>
                    {t.unread > 0 && (
                      <span style={{ width:18, height:18, borderRadius:'50%', background:'var(--gold-500)', color:'var(--charcoal-900)', fontSize:'0.65rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {t.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── RIGHT: Message thread ── */}
            {!activeThread ? (
              <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:'0.875rem', flexDirection:'column', gap:8 }}>
                <span style={{ fontSize:'2rem' }}>💬</span>
                Select a conversation or search for a user to message
              </div>
            ) : (
              <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
                {/* Thread header */}
                <div style={{ padding:'1rem 1.25rem', borderBottom:'0.5px solid var(--border-subtle)', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--bg-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.875rem', fontWeight:700, color:'var(--text-muted)', flexShrink:0 }}>
                    {(activeThread.display_name || activeThread.username || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--text-primary)' }}>{activeThread.display_name || activeThread.username}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>@{activeThread.username}</div>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                  {messages.length === 0 && (
                    <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem', marginTop:'2rem' }}>
                      No messages yet. Say hello!
                    </div>
                  )}
                  {messages.map(msg => {
                    const isMe = msg.sender_id === profile?.id;
                    return (
                      <div key={msg.id} style={{ display:'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap:8, alignItems:'flex-end' }}>
                        {!isMe && (
                          <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--bg-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', flexShrink:0 }}>
                            {(activeThread.display_name || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div style={{ maxWidth:'70%' }}>
                          <div style={{ padding:'0.625rem 0.875rem', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: isMe ? 'var(--gold-500)' : 'var(--bg-tertiary)', color: isMe ? 'var(--charcoal-900)' : 'var(--text-primary)', fontSize:'0.875rem', lineHeight:1.5 }}>
                            {msg.body}
                          </div>
                          <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginTop:3, textAlign: isMe ? 'right' : 'left' }}>
                            {formatTime(msg.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div style={{ padding:'0.875rem 1rem', borderTop:'0.5px solid var(--border-subtle)', display:'flex', gap:8 }}>
                  <input
                    type="text"
                    placeholder={`Message ${activeThread.display_name || activeThread.username}...`}
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    maxLength={2000}
                    style={{ flex:1, padding:'0.625rem 0.875rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.875rem', fontFamily:'var(--font-body)', outline:'none' }}
                  />
                  <button onClick={sendMessage} disabled={sending || !newMsg.trim()}
                    style={{ padding:'0.625rem 1.125rem', borderRadius:'var(--radius-md)', background:'var(--gold-500)', color:'var(--charcoal-900)', border:'none', fontSize:'0.875rem', fontWeight:700, cursor: sending || !newMsg.trim() ? 'not-allowed' : 'pointer', fontFamily:'var(--font-body)', opacity: sending ? 0.7 : 1 }}>
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
