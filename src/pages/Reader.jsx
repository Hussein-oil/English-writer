import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Navbar from '../components/Navbar'
import { callAI } from '../utils/callAI'

// ─── Text helpers ─────────────────────────────────────────────────────────────

// Split text into clickable-word and non-word tokens
const TOKEN_RE = /([a-zA-Z'’‘-]+|[^a-zA-Z'’‘-]+)/g

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
  // Find the clause/sentence that contains this word
  const re = new RegExp(`[^.!?\\n]*\\b${word}\\b[^.!?\\n]*[.!?]?`, 'i')
  const match = fullText.match(re)
  if (match) return match[0].trim().slice(0, 250)
  // Fallback: surrounding 120 chars
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

// ─── Tooltip component ────────────────────────────────────────────────────────

function WordTooltip({ word, loading, result, error, pos, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  // Clamp so tooltip doesn't escape viewport
  const x = Math.max(160, Math.min(pos.x, window.innerWidth - 160))
  const y = pos.y + 10

  return (
    <div
      ref={ref}
      style={{
        ...styles.tooltip,
        position: 'fixed',
        top: y,
        left: x,
        transform: 'translateX(-50%)',
      }}
    >
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
          <div style={styles.miniSpinner} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Looking up...</span>
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

  useEffect(() => {
    if (!sourceText) navigate('/input')
  }, [])

  const handleWordClick = useCallback(async (e, rawToken) => {
    e.stopPropagation()
    const word = cleanWord(rawToken)
    if (!word || word.length < 2) return

    const rect = e.currentTarget.getBoundingClientRect()
    const pos = { x: rect.left + rect.width / 2, y: rect.bottom }
    const sentence = getSentenceContaining(sourceText, word)

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

  if (!sourceText) return null

  const tokens = tokenize(sourceText)

  return (
    <div style={styles.page}>
      <Navbar />

      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Interactive Reader</h1>
            <p style={styles.desc}>Click any word to look it up in {nativeLanguage}.</p>
          </div>
          <button style={styles.backBtn} onClick={() => navigate('/analysis')}>
            Back to Analysis
          </button>
        </div>

        <div style={styles.textCard}>
          <div style={styles.textBody} lang="en">
            {tokens.map((token, i) => {
              if (!isWord(token)) {
                return <span key={i}>{token}</span>
              }
              return (
                <span
                  key={i}
                  style={styles.wordSpan}
                  onClick={e => handleWordClick(e, token)}
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
          onClose={() => setTooltip(null)}
        />
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-base)',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    maxWidth: '740px',
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
    transition: 'border-color 150ms ease',
  },
  textCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '32px 36px',
  },
  textBody: {
    fontSize: '1.05rem',
    lineHeight: 2,
    color: 'var(--text-primary)',
    letterSpacing: '0.01em',
    wordBreak: 'break-word',
  },
  wordSpan: {
    cursor: 'pointer',
    borderRadius: '3px',
    transition: 'background 120ms ease, color 120ms ease',
    padding: '1px 0',
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
    minWidth: '220px',
    maxWidth: '300px',
    zIndex: 9999,
    animation: 'fade-in 150ms ease',
  },
  tooltipHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  tooltipWord: {
    fontSize: '1rem',
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
    transition: 'color 150ms ease',
  },
  tooltipLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
  },
  miniSpinner: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2px solid var(--border)',
    borderTopColor: 'var(--accent-primary)',
    animation: 'spin 0.75s linear infinite',
    flexShrink: 0,
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
