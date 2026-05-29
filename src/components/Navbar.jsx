import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const NAV_LINKS = [
  { to: '/input', label: 'Input' },
  { to: '/analysis', label: 'Analysis' },
  { to: '/chat', label: 'Chat' },
]

const PROVIDER_DOTS = {
  anthropic: '#f97316',
  groq: '#22c55e',
  openai: '#14b8a6',
  deepseek: '#3b82f6',
  google: '#eab308',
  custom: '#64748b',
}

export default function Navbar() {
  const { clearConfig, nativeLanguage, selectedModel, provider } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [hoveredLink, setHoveredLink] = useState(null)

  function handleReset() {
    clearConfig()
    navigate('/')
  }

  const dotColor = PROVIDER_DOTS[provider] || '#64748b'

  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <Link to="/input" style={styles.brand}>EN-Teacher</Link>
        <div style={styles.navLinks}>
          {NAV_LINKS.map(({ to, label }) => {
            const isActive = location.pathname === to
            const isHovered = hoveredLink === to
            return (
              <Link
                key={to}
                to={to}
                style={{
                  ...styles.navLink,
                  ...(isActive ? styles.navLinkActive : {}),
                  ...(!isActive && isHovered ? styles.navLinkHover : {}),
                }}
                onMouseEnter={() => setHoveredLink(to)}
                onMouseLeave={() => setHoveredLink(null)}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      <div style={styles.right}>
        {nativeLanguage && (
          <span style={styles.pill}>{nativeLanguage}</span>
        )}
        {selectedModel && (
          <span style={styles.modelPill}>
            <span style={{ ...styles.providerDot, background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
            {selectedModel}
          </span>
        )}
        <button
          style={styles.resetBtn}
          onClick={handleReset}
          title="Change API key, language, or model"
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M6 1v1M6 10v1M1 6h1M10 6h1M2.5 2.5l.7.7M8.8 8.8l.7.7M9.5 2.5l-.7.7M3.2 8.8l-.7.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Settings
        </button>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    height: '56px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    background: 'rgba(8, 8, 15, 0.82)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
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
    gap: '2px',
  },
  navLink: {
    fontSize: '0.82rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    padding: '5px 11px',
    borderRadius: 'var(--radius-sm)',
    transition: 'color 0.2s ease, background 0.2s ease',
  },
  navLinkActive: {
    color: 'var(--accent-primary)',
    background: 'var(--accent-primary-dim)',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(99,102,241,0.45)',
    textDecorationThickness: '2px',
    textUnderlineOffset: '4px',
  },
  navLinkHover: {
    color: 'var(--text-primary)',
    background: 'rgba(99, 102, 241, 0.06)',
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
    padding: '3px 10px 3px 8px',
    fontFamily: "'SF Mono', 'Cascadia Code', monospace",
    letterSpacing: '0.01em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  providerDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
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
    transition: 'border-color 0.2s ease, color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
}
