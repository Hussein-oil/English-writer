import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Navbar from '../components/Navbar'
import { callAI } from '../utils/callAI'

const SUGGESTIONS = [
  'What is the main idea of this text?',
  'Explain the most difficult vocabulary.',
  'What grammar structures are used here?',
  'How can I use this text to improve my English?',
]

function buildSystemPrompt(nativeLanguage, sourceText) {
  return `You are a friendly and knowledgeable English teacher helping a ${nativeLanguage} speaker understand an English text they just analyzed.

The text they analyzed was:
"""
${sourceText.substring(0, 1000)}
"""

Answer all questions in ${nativeLanguage}, but keep English terms, words, and phrases in English when relevant — explain them when needed. Be concise, encouraging, and pedagogically helpful.`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={styles.bubbleWrap}>
      <div style={{ ...styles.bubble, ...styles.aiBubble, padding: '14px 16px' }}>
        <div style={styles.dotRow}>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              style={{ ...styles.dot, animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ ...styles.bubbleWrap, ...(isUser ? styles.userWrap : {}) }}>
      {!isUser && (
        <div style={styles.avatar}>AI</div>
      )}
      <div
        style={{
          ...styles.bubble,
          ...(isUser ? styles.userBubble : styles.aiBubble),
          ...(msg.isError ? styles.errorBubble : {}),
        }}
      >
        <p style={styles.bubbleText}>{msg.content}</p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Chat() {
  const navigate = useNavigate()
  const { sourceText, nativeLanguage, apiKey, provider, selectedModel } = useApp()

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!sourceText) navigate('/input')
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const systemPrompt = buildSystemPrompt(nativeLanguage, sourceText || '')

  async function sendMessage(content) {
    const text = (content ?? input).trim()
    if (!text || thinking) return

    const userMsg = { role: 'user', content: text, id: Date.now() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setThinking(true)
    inputRef.current?.focus()

    try {
      const apiMessages = history.map(({ role, content }) => ({ role, content }))
      const reply = await callAI({
        provider, apiKey, selectedModel, systemPrompt,
        userMessages: apiMessages,
        maxTokens: 2000,
      })
      setMessages(prev => [...prev, { role: 'assistant', content: reply, id: Date.now() + 1 }])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: err.message, id: Date.now() + 1, isError: true },
      ])
    } finally {
      setThinking(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
      <Navbar />

      <div style={styles.layout}>
        {/* Messages area */}
        <div style={styles.messagesArea}>
          {isEmpty ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M24 14a10 10 0 01-10 10H6l-3 3V14A10 10 0 1124 14z" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M9 12h10M9 17h6" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h2 style={styles.emptyTitle}>Ask me anything about the text</h2>
              <p style={styles.emptyDesc}>
                I'm here to help you understand the English text you analyzed.
                Ask questions in any language — I'll reply in {nativeLanguage}.
              </p>
              <div style={styles.suggestions}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} style={styles.suggestion} onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={styles.messageList}>
              {messages.map(msg => <Message key={msg.id} msg={msg} />)}
              {thinking && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input row */}
        <div style={styles.inputRow}>
          <div style={styles.inputWrap}>
            <input
              ref={inputRef}
              style={styles.input}
              placeholder={`Ask in ${nativeLanguage} or English...`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={thinking}
              autoFocus
            />
            <button
              style={{
                ...styles.sendBtn,
                ...(!input.trim() || thinking ? styles.sendBtnDisabled : {}),
              }}
              disabled={!input.trim() || thinking}
              onClick={() => sendMessage()}
            >
              {thinking ? <MiniSpinner /> : <SendIcon />}
            </button>
          </div>
          {messages.length > 0 && (
            <button style={styles.clearBtn} onClick={() => setMessages([])}>
              Clear chat
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 8L2 2l3 6-3 6 12-6z" fill="currentColor" />
    </svg>
  )
}

function MiniSpinner() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ animation: 'spin 0.75s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    height: '100vh',
    background: 'var(--bg-base)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  layout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '720px',
    width: '100%',
    margin: '0 auto',
    padding: '0 16px',
    overflow: 'hidden',
  },
  // Messages
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: '24px',
    paddingBottom: '16px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '60px 24px 32px',
    gap: '14px',
  },
  emptyIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'var(--accent-primary-dim)',
    border: '1px solid rgba(99,102,241,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '4px',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  emptyDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    maxWidth: '380px',
  },
  suggestions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%',
    maxWidth: '440px',
    marginTop: '8px',
  },
  suggestion: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '11px 16px',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'border-color 150ms ease, color 150ms ease, background 150ms ease',
  },
  messageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  // Message bubbles
  bubbleWrap: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    animation: 'fade-in 200ms ease',
  },
  userWrap: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'var(--accent-primary-dim)',
    border: '1px solid rgba(99,102,241,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.6rem',
    fontWeight: '700',
    color: 'var(--accent-primary)',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 'var(--radius-lg)',
    padding: '12px 16px',
  },
  aiBubble: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderBottomLeftRadius: '4px',
  },
  userBubble: {
    background: 'var(--accent-primary)',
    borderBottomRightRadius: '4px',
  },
  errorBubble: {
    background: 'var(--error-dim)',
    border: '1px solid rgba(248,113,113,0.2)',
  },
  bubbleText: {
    fontSize: '0.9rem',
    lineHeight: 1.65,
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  dotRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  dot: {
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: 'var(--text-muted)',
    animation: 'bounce-dot 1.2s ease infinite',
  },
  // Input
  inputRow: {
    padding: '12px 0 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    borderTop: '1px solid var(--border)',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '6px 8px 6px 16px',
    transition: 'border-color 150ms ease',
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    minHeight: '32px',
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'var(--accent-primary)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 150ms ease',
  },
  sendBtnDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  clearBtn: {
    alignSelf: 'flex-end',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '2px 4px',
    transition: 'color 150ms ease',
  },
}
