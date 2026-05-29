import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const NAV_LINKS = [
  { to: '/input', label: 'Input' },
  { to: '/analysis', label: 'Analysis' },
  { to: '/chat', label: 'Chat' },
]

export default function Navbar() {
  const { clearConfig, nativeLanguage, selectedModel } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  function handleReset() {
    clearConfig()
    navigate('/')
  }

  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <Link to="/input" style={styles.brand}>EN-Teacher</Link>
        <div style={styles.navLinks}>
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              style={{
                ...styles.navLink,
                ...(location.pathname === to ? styles.navLinkActive : {}),
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div style={styles.right}>
        {nativeLanguage && (
          <span style={styles.pill}>{nativeLanguage}</span>
        )}
        {selectedModel && (
          <span style={styles.modelPill}>{selectedModel}</span>
        )}
        <button style={styles.resetBtn} onClick={handleReset} title="Change API key, language, or model">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M6 1v1M6 10v1M1 6h1M10 6h1M2.5 2.5l.7.7M8.8 8.8l.7.7M9.5 2.5l-.7.7M3.2 8.8l-.7.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Change Settings
        </button>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    height: '56px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 28px',
    background: 'var(--bg-surface)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    backdropFilter: 'blur(12px)',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '28px',
  },
  brand: {
    fontSize: '0.95rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.03em',
    textDecoration: 'none',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  navLink: {
    fontSize: '0.82rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    padding: '5px 10px',
    borderRadius: 'var(--radius-sm)',
    transition: 'color 150ms ease, background 150ms ease',
  },
  navLinkActive: {
    color: 'var(--accent-primary)',
    background: 'var(--accent-primary-dim)',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  pill: {
    fontSize: '0.72rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '99px',
    padding: '3px 10px',
    letterSpacing: '0.02em',
  },
  modelPill: {
    fontSize: '0.72rem',
    fontWeight: '500',
    color: 'var(--accent-primary)',
    background: 'var(--accent-primary-dim)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: '99px',
    padding: '3px 10px',
    fontFamily: "'SF Mono', 'Cascadia Code', monospace",
    letterSpacing: '0.01em',
  },
  resetBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 10px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'border-color 150ms ease, color 150ms ease',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
}
