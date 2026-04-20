'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase, getProfile } from '../lib/supabase';
import styles from './Nav.module.css';

const NAV_LINKS = [
  { href: '/rankings',   label: 'Rankings'   },
  { href: '/analysis',   label: 'Rulings'    },
  { href: '/tools',      label: 'Tools'      },
  { href: '/devy',       label: 'Devy'       },
  { href: '/newsletter', label: 'Newsletter' },
];

export default function Nav() {
  const router                  = useRouter();
  const [open, setOpen]         = useState(false);
  const [profile, setProfile]   = useState(null);
  const [userMenu, setUserMenu] = useState(false);
  const userMenuRef             = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) getProfile(session.user.id).then(({ data }) => setProfile(data));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) getProfile(session.user.id).then(({ data }) => setProfile(data));
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handler(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setUserMenu(false);
    router.push('/');
  }

  const displayName = profile?.display_name || profile?.username || '?';

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>

        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoGavel}>⚖</span>
          <span className={styles.logoText}>
            Dynasty<span className={styles.logoAccent}>Judge</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className={styles.links}>
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className={styles.ctas}>
          {profile ? (
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button onClick={() => setUserMenu(v => !v)} className={styles.userBtn}>
                <span className={styles.userAvatar}>{displayName[0].toUpperCase()}</span>
                <span className={styles.userName}>{displayName}</span>
                <span style={{ fontSize: 10, color: 'var(--charcoal-400)', marginLeft: 2 }}>▾</span>
              </button>

              {userMenu && (
                <div className={styles.userDropdown}>
                  <div className={styles.dropdownHeader}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{displayName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1, textTransform: 'capitalize' }}>{profile.tier} member</div>
                  </div>
                  <div className={styles.dropdownDivider} />
                  <Link href="/my-rankings" className={styles.dropdownItem} onClick={() => setUserMenu(false)}>📋 My rankings</Link>
                  <Link href="/tools" className={styles.dropdownItem} onClick={() => setUserMenu(false)}>🔧 Judge tools</Link>
                  {profile.tier === 'admin' && (
                    <Link href="/admin" className={styles.dropdownItem} onClick={() => setUserMenu(false)}>◈ Admin dashboard</Link>
                  )}
                  <div className={styles.dropdownDivider} />
                  <Link href="/subscribe" className={styles.dropdownItem} onClick={() => setUserMenu(false)}>⭐ Upgrade plan</Link>
                  <div className={styles.dropdownDivider} />
                  <button onClick={handleSignOut} className={styles.dropdownSignOut}>Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className={styles.loginLink}>Sign in</Link>
              <Link href="/subscribe" className={styles.ctaBtn}>Go Judge Elite</Link>
            </>
          )}
        </div>

        {/* Hamburger */}
        <button className={styles.hamburger} onClick={() => setOpen(!open)} aria-label="Menu">
          <span className={open ? styles.barOpen  : styles.bar} />
          <span className={open ? styles.barOpen2 : styles.bar} />
          <span className={open ? styles.barOpen3 : styles.bar} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className={styles.mobileMenu}>
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href} className={styles.mobileLink} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <div className={styles.mobileDivider} />
          {profile ? (
            <>
              <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Signed in as {displayName}
              </div>
              <Link href="/my-rankings" className={styles.mobileLink} onClick={() => setOpen(false)}>My rankings</Link>
              <Link href="/tools" className={styles.mobileLink} onClick={() => setOpen(false)}>Judge tools</Link>
              {profile.tier === 'admin' && (
                <Link href="/admin" className={styles.mobileLink} onClick={() => setOpen(false)}>Admin dashboard</Link>
              )}
              <div className={styles.mobileDivider} />
              <button
                onClick={handleSignOut}
                style={{ padding: '0.625rem 0.75rem', background: 'none', border: 'none', color: '#F87171', fontSize: '0.9375rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', width: '100%' }}>
                Sign out
              </button>
            </>
          ) : (
            <Link href="/subscribe" className={styles.mobileCta} onClick={() => setOpen(false)}>
              Go Judge Elite →
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
