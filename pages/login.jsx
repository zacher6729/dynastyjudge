import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { signIn, signUp, signInWithGoogle } from '../lib/supabase';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode]       = useState('signin'); // signin | signup
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [username, setUser]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) { setError(error.message); setLoading(false); return; }
      router.push('/');
    } else {
      if (!username || username.length < 3) {
        setError('Username must be at least 3 characters.');
        setLoading(false); return;
      }
      const { error } = await signUp(email, password, username);
      if (error) { setError(error.message); setLoading(false); return; }
      router.push('/?welcome=1');
    }
  }

  async function handleGoogle() {
    await signInWithGoogle();
  }

  return (
    <>
      <Head>
        <title>{mode === 'signin' ? 'Sign in' : 'Join'} — DynastyJudge</title>
      </Head>

      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', background:'var(--bg-primary)' }}>

        {/* Logo */}
        <Link href="/" style={{ textDecoration:'none', marginBottom:'2rem' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'1.75rem', fontWeight:700, textAlign:'center' }}>
            Dynasty<span style={{ color:'var(--gold-400)' }}>Judge</span>
          </div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textAlign:'center', letterSpacing:'0.1em' }}>COURT IS IN SESSION</div>
        </Link>

        <div style={{ width:'100%', maxWidth:420, background:'var(--bg-secondary)', border:'0.5px solid var(--border-default)', borderRadius:'var(--radius-lg)', padding:'2rem' }}>

          {/* Mode tabs */}
          <div style={{ display:'flex', marginBottom:'1.5rem', border:'0.5px solid var(--border-subtle)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
            {['signin','signup'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex:1, padding:'0.625rem',
                  background: mode === m ? 'var(--gold-500)' : 'transparent',
                  color: mode === m ? 'var(--charcoal-900)' : 'var(--text-muted)',
                  border:'none', cursor:'pointer', fontFamily:'var(--font-body)',
                  fontSize:'0.875rem', fontWeight: mode === m ? 700 : 400,
                }}>
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {/* Google OAuth */}
          <button onClick={handleGoogle} style={{
            width:'100%', padding:'0.75rem', marginBottom:'1rem',
            border:'0.5px solid var(--border-default)', borderRadius:'var(--radius-md)',
            background:'transparent', color:'var(--text-primary)',
            fontSize:'0.9375rem', cursor:'pointer', fontFamily:'var(--font-body)',
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:'1rem' }}>
            <div style={{ flex:1, height:'0.5px', background:'var(--border-subtle)' }} />
            <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>or</span>
            <div style={{ flex:1, height:'0.5px', background:'var(--border-subtle)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {mode === 'signup' && (
              <input type="text" placeholder="Username" value={username} onChange={e => setUser(e.target.value)} required
                style={{ padding:'0.75rem 1rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.9375rem', fontFamily:'var(--font-body)', outline:'none' }} />
            )}
            <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ padding:'0.75rem 1rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.9375rem', fontFamily:'var(--font-body)', outline:'none' }} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPass(e.target.value)} required minLength={8}
              style={{ padding:'0.75rem 1rem', borderRadius:'var(--radius-md)', border:'0.5px solid var(--border-default)', background:'var(--bg-primary)', color:'var(--text-primary)', fontSize:'0.9375rem', fontFamily:'var(--font-body)', outline:'none' }} />

            {error && <p style={{ color:'#F87171', fontSize:'0.8125rem', margin:0 }}>{error}</p>}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ opacity: loading ? 0.7 : 1, marginTop:4 }}>
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {mode === 'signup' && (
            <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'1rem', textAlign:'center', lineHeight:1.6 }}>
              By creating an account you agree to our{' '}
              <Link href="/terms" style={{ color:'var(--text-gold)' }}>Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" style={{ color:'var(--text-gold)' }}>Privacy Policy</Link>.
            </p>
          )}

          {mode === 'signin' && (
            <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:'1rem', textAlign:'center' }}>
              <Link href="/auth/reset-password" style={{ color:'var(--text-gold)' }}>Forgot password?</Link>
            </p>
          )}
        </div>

        <p style={{ marginTop:'1.5rem', fontSize:'0.8125rem', color:'var(--text-muted)' }}>
          {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
            style={{ background:'none', border:'none', color:'var(--text-gold)', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:'0.8125rem' }}>
            {mode === 'signin' ? 'Create one free' : 'Sign in'}
          </button>
        </p>

      </div>
    </>
  );
}
