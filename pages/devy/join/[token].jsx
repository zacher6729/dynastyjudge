import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Nav from '../../../components/Nav';
import { supabase } from '../../../lib/supabase';

export default function JoinDraft() {
  const router = useRouter();
  const { token } = router.query;

  const [invite, setInvite]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError]     = useState('');
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/devy/invites?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setInvite(data.invite);
        else setError(data.error || 'Invalid invite link');
        setLoading(false);
      });
  }, [token]);

  async function joinDraft() {
    setJoining(true);
    try {
      const res  = await fetch('/api/devy/invites', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'accept', token, user_id: session?.user?.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Store roster assignment in localStorage
      localStorage.setItem(`devy_draft_${data.draft_id}_roster_id`, String(data.roster_id));

      // Mark notification as read if there is one
      if (session?.user?.id) {
        await supabase.from('notifications')
          .update({ read: true })
          .eq('user_id', session.user.id)
          .eq('type', 'draft_invite')
          .contains('data', { draft_id: invite.draft_id });
      }

      router.push(`/devy/draft/${data.draft_id}`);
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  }

  if (loading) return (
    <><Nav /><div style={{ padding:'4rem', textAlign:'center', color:'var(--text-muted)' }}>Loading invite...</div></>
  );

  if (error) return (
    <>
      <Nav />
      <div style={{ maxWidth:480, margin:'4rem auto', padding:'0 1.5rem', textAlign:'center' }}>
        <div style={{ fontSize:'2rem', marginBottom:'1rem' }}>⚠</div>
        <h1 style={{ fontSize:'1.25rem', fontWeight:700, color:'var(--text-primary)', marginBottom:8 }}>Invite not found</h1>
        <p style={{ color:'var(--text-muted)', marginBottom:'1.5rem' }}>{error}</p>
        <a href="/devy" style={{ color:'var(--gold-400)' }}>← Back to DevyJudge</a>
      </div>
    </>
  );

  const draft = invite.draft;
  const statusColors = { setup:'#FBBF24', active:'#4ADE80', paused:'#9CA3AF', complete:'#60A5FA' };

  return (
    <>
      <Head><title>Join Draft — {draft?.name}</title></Head>
      <Nav />

      <main style={{ minHeight:'100vh', paddingBottom:'4rem' }}>
        <div style={{ maxWidth:540, margin:'0 auto', padding:'3rem 1.5rem 0' }}>

          {/* Draft info */}
          <div style={{ background:'var(--bg-secondary)', border:'0.5px solid var(--border-gold)', borderRadius:'var(--radius-lg)', padding:'2rem', marginBottom:'1.5rem', textAlign:'center' }}>
            <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>🏛</div>
            <h1 style={{ fontSize:'1.25rem', fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>
              {draft?.name}
            </h1>
            <p style={{ fontSize:'0.875rem', color:'var(--text-muted)', marginBottom:'1rem' }}>
              {draft?.league_name} · {draft?.num_teams} teams · {draft?.rounds} rounds
            </p>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:99, background:`${statusColors[draft?.status] || '#FBBF24'}20`, border:`0.5px solid ${statusColors[draft?.status] || '#FBBF24'}40`, marginBottom:'1.5rem' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background: statusColors[draft?.status] || '#FBBF24', display:'inline-block' }} />
              <span style={{ fontSize:'0.8125rem', fontWeight:600, color: statusColors[draft?.status] || '#FBBF24' }}>
                {draft?.status === 'active' ? 'Draft is live' : draft?.status === 'setup' ? 'Not started yet' : draft?.status}
              </span>
            </div>

            {/* Team assignment */}
            <div style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border-default)', borderRadius:'var(--radius-md)', padding:'1rem', marginBottom:'1.5rem' }}>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Your team</div>
              <div style={{ fontSize:'1.125rem', fontWeight:700, color:'var(--gold-400)' }}>
                {invite.team_name || `Team ${invite.roster_id}`}
              </div>
              {invite.assigned_username && (
                <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:2 }}>
                  Assigned to @{invite.assigned_username}
                </div>
              )}
            </div>

            {invite.status === 'accepted' ? (
              <div>
                <div style={{ color:'#4ADE80', fontWeight:600, marginBottom:'1rem' }}>✓ Already accepted — you're in!</div>
                <button onClick={() => router.push(`/devy/draft/${draft.id}`)} className="btn btn-primary" style={{ width:'100%' }}>
                  Enter draft room →
                </button>
              </div>
            ) : !session ? (
              <div>
                <p style={{ fontSize:'0.875rem', color:'var(--text-muted)', marginBottom:'1rem' }}>
                  Sign in to join this draft and track your picks.
                </p>
                <a href={`/login?redirect=/devy/join/${token}`} className="btn btn-primary" style={{ display:'block', textAlign:'center', textDecoration:'none' }}>
                  Sign in to join →
                </a>
                <button onClick={joinDraft} style={{ width:'100%', marginTop:8, padding:'0.75rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'transparent', color:'var(--text-secondary)', fontSize:'0.875rem', cursor:'pointer', fontFamily:'var(--font-body)' }}>
                  Continue as guest
                </button>
              </div>
            ) : (
              <button onClick={joinDraft} disabled={joining} className="btn btn-primary" style={{ width:'100%', opacity: joining ? 0.7 : 1 }}>
                {joining ? 'Joining...' : `Join as ${invite.team_name || `Team ${invite.roster_id}`} →`}
              </button>
            )}

            {error && (
              <div style={{ marginTop:'0.75rem', color:'#F87171', fontSize:'0.875rem' }}>{error}</div>
            )}
          </div>

          <p style={{ textAlign:'center', fontSize:'0.8125rem', color:'var(--text-muted)' }}>
            This invite link is specific to your team slot. Don't share it with others.
          </p>
        </div>
      </main>
    </>
  );
}
