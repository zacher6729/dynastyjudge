'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase, getProfile } from '../../lib/supabase';
import styles from './Admin.module.css';

const NAV_ITEMS = [
  { href: '/admin',             icon: '◈', label: 'Overview'  },
  { href: '/admin/rankings',    icon: '📋', label: 'Rankings'  },
  { href: '/admin/tools',       icon: '🔧', label: 'Tools'     },
  { href: '/admin/players',     icon: '🏈', label: 'Players'   },
  { href: '/admin/users',       icon: '👥', label: 'Users'     },
  { href: '/admin/content',     icon: '✍', label: 'Content'   },
  { href: '/admin/weights',     icon: '⚖', label: 'Weights'   },
];

export default function AdminLayout({ children, title, activeHref }) {
  const router  = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: prof } = await getProfile(session.user.id);
      if (!prof || prof.tier !== 'admin') { router.push('/'); return; }
      setProfile(prof);
      setLoading(false);
    }
    check();
  }, [router]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg-primary)', color:'var(--text-muted)', fontSize:'0.875rem' }}>
      Verifying access...
    </div>
  );

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.logo}>
          <span style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', fontWeight:700 }}>
            Dynasty<span style={{ color:'var(--gold-400)' }}>Judge</span>
          </span>
          <span className={styles.adminBadge}>ADMIN</span>
        </Link>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${(activeHref || router.pathname) === item.href ? styles.navItemActive : ''}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginBottom:4 }}>
            {profile?.display_name || profile?.username}
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
            style={{ fontSize:'0.75rem', color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'var(--font-body)' }}>
            Sign out →
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {title && (
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{title}</h1>
          </div>
        )}
        <div className={styles.pageBody}>
          {children}
        </div>
      </main>
    </div>
  );
}
