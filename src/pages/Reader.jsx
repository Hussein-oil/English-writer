import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Navbar from '../components/Navbar'
import { callAI } from '../utils/callAI'

const TOKEN_RE = /([a-zA-Z'''-]+|[^a-zA-Z'''-]+)/g

function tokenize(text) {
  return Array.from(text.matchAll(TOKEN_RE), m => m[0])
}

function isWord(token) {
  return /^[a-zA-Z]{2,}/.test(token)
}

function cleanWord(token) {
  return token.replace(/[^a-zA-Z]/g, '').toLowerCase()
}

function getSentenceContaining(fullText, word) {
  const re = new RegExp(`[^.!?\\n]*\\b${word}\\b[^.!?\\n]*[.!?]?`, 'i')
  const match = fullText.match(re)
  if (match) return match[0].trim().slice(0, 250)
  const idx = fullText.toLowerCase().indexOf(word.toLowerCase())
  if (idx === -1) return word
  return fullText.slice(Math.max(0, idx - 60), idx + 60 + word.length).trim()
}

function buildWordPrompt(word, sentence, nativeLanguage) {
  return `Translate the English word "${word}" from this sentence context: "${sentence}"

Reply in ${nativeLanguage} using exactly this format (no extra text):
Translation: [translation in ${nativeLanguage}]
Part of speech: [noun / verb / adjective / adverb / etc.]
Example: [new short example sentence in English] — [translation in ${nativeLanguage}]`
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function WordTooltip({ word, loading, result, error, pos, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  // Position above the word, clamped to viewport
  const x = Math.max(160, Math.min(pos.x, window.innerWidth - 160))
  const bottomOffset = window.innerHeight - pos.y + 10

  return (
    <div
      ref={ref}
      style={{
        ...styles.tooltip,
        position: 'fixed',
        bottom: bottomOffset,
        left: x,
        transform: 'translateX(-50%)',
        animation: 'tooltip-in 0.15s ease forwards',
      }}
    >
      <div style={styles.tooltipArrow} />

      <div style={styles.tooltipHeader}>
        <span style={styles.tooltipWord}>{word}</span>
        <button style={styles.tooltipClose} onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {loading && (
        <div style={styles.tooltipLoading}>
          <div className="skeleton" style={{ height: '12px', borderRadius: '6px', marginBottom: '6px' }} />
          <div className="skeleton" style={{ height: '12px', width: '70%', borderRadius: '6px', marginBottom: '6px' }} />
          <div className="skeleton" style={{ height: '12px', width: '85%', borderRadius: '6px' }} />
        </div>
      )}

      {error && !loading && (
        <p style={styles.tooltipError}>{error}</p>
      )}

      {result && !loading && (
        <p style={styles.tooltipResult}>{result}</p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Reader() {
  const navigate = useNavigate()
  const { sourceText, nativeLanguage, apiKey, provider, selectedModel } = useApp()

  const [tooltip, setTooltip] = useState(null)
  const [activeTokenIndex, setActiveTokenIndex] = useState(null)
  const [readProgress, setReadProgress] = useState(0)

  useEffect(() => {
    if (!sourceText) navigate('/input')
  }, [])

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setReadProgress(docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleWordClick = useCallback(async (e, rawToken, tokenIndex) => {
    e.stopPropagation()
    const word = cleanWord(rawToken)
    if (!word || word.length < 2) return

    const rect = e.currentTarget.getBoundingClientRect()
    const pos = { x: rect.left + rect.width / 2, y: rect.top }
    const sentence = getSentenceContaining(sourceText, word)

    setActiveTokenIndex(tokenIndex)
    setTooltip({ word, loading: true, result: null, error: null, pos })

    try {
      const reply = await callAI({
        provider, apiKey, selectedModel,
        userMessages: [{ role: 'user', content: buildWordPrompt(word, sentence, nativeLanguage) }],
        maxTokens: 200,
      })
      setTooltip(prev => prev?.word === word ? { ...prev, loading: false, result: reply.trim() } : prev)
    } catch (err) {
      setTooltip(prev => prev?.word === word ? { ...prev, loading: false, error: err.message } : prev)
    }
  }, [provider, apiKey, selectedModel, nativeLanguage, sourceText])

  function handleClose() {
    setTooltip(null)
    setActiveTokenIndex(null)
  }

  if (!sourceText) return null

  const tokens = tokenize(sourceText)

  return (
    <div style={styles.page} className="page-enter">
      {/* Reading progress bar */}
      <div style={{ ...styles.progressBar, width: `${readProgress}%` }} />

      <Navbar />

      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Interactive Reader</h1>
            <p style={styles.desc}>Click any word to look it up in {nativeLanguage}.</p>
          </div>
          <button
            style={styles.backBtn}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onClick={() => navigate('/analysis')}
          >
            Back to Analysis
          </button>
        </div>

        <div style={styles.textCard}>
          <div style={styles.textBody} lang="en">
            {tokens.map((token, i) => {
              if (!isWord(token)) {
                return <span key={i}>{token}</span>
              }
              const isActive = activeTokenIndex === i
              return (
                <span
                  key={i}
                  className={`word-token${isActive ? ' active' : ''}`}
                  onClick={e => handleWordClick(e, token, i)}
                  title="Click to look up"
                >
                  {token}
                </span>
              )
            })}
          </div>
        </div>

        <p style={styles.hint}>
          {sourceText.length.toLocaleString()} characters &mdash; click any word for an instant translation.
        </p>
      </main>

      {tooltip && (
        <WordTooltip
          word={tooltip.word}
          loading={tooltip.loading}
          result={tooltip.result}
          error={tooltip.error}
          pos={tooltip.pos}
          onClose={handleClose}
        />
      )}
    </div>
  )
}

const styles = {
  progressBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '2px',
    background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
    zIndex: 100,
    transition: 'width 100ms ease',
    pointerEvents: 'none',
  },
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    maxWidth: '760px',
    width: '100%',
    margin: '0 auto',
    padding: '48px 24px 100px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.04em',
    lineHeight: 1.2,
  },
  desc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '6px',
  },
  backBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 16px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
    transition: 'border-color 0.2s ease, color 0.2s ease',
  },
  textCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '36px 40px',
  },
  textBody: {
    fontSize: '18px',
    lineHeight: 1.9,
    color: 'var(--text-primary)',
    letterSpacing: '0.01em',
    wordBreak: 'break-word',
    maxWidth: '680px',
    margin: '0 auto',
  },
  hint: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  // Tooltip
  tooltip: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-hover)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    padding: '14px 16px',
    minWidth: '240px',
    maxWidth: '320px',
    zIndex: 9999,
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: '-6px',
    left: '50%',
    width: '12px',
    height: '12px',
    background: 'var(--bg-elevated)',
    borderRight: '1px solid var(--border-hover)',
    borderBottom: '1px solid var(--border-hover)',
    transform: 'translateX(-50%) rotate(45deg)',
  },
  tooltipHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  tooltipWord: {
    fontSize: '1.05rem',
    fontWeight: '700',
    color: 'var(--accent-primary)',
    fontFamily: "'SF Mono', 'Cascadia Code', monospace",
  },
  tooltipClose: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    transition: 'color 0.2s ease',
  },
  tooltipLoading: {
    padding: '4px 0 2px',
  },
  tooltipResult: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
    whiteSpace: 'pre-line',
  },
  tooltipError: {
    fontSize: '0.78rem',
    color: 'var(--error)',
    lineHeight: 1.5,
  },
}
