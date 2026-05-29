import { useState, useEffect, useRef, useCallback } from 'react'
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

function TypingIndicator() {
  return (
    <div style={styles.bubbleWrap}>
      <div style={styles.avatar}>EN</div>
      <div style={{ ...styles.bubble, ...styles.aiBubble, padding: '14px 16px' }}>
        <div style={styles.dotRow}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ ...styles.dot, animationDelay: `${i * 180}ms` }} />
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
      {!isUser && <div style={styles.avatar}>EN</div>}
      <div style={{
        ...styles.bubble,
        ...(isUser ? styles.userBubble : styles.aiBubble),
        ...(msg.isError ? styles.errorBubble : {}),
      }}>
        <p style={{ ...styles.bubbleText, ...(isUser ? styles.userBubbleText : {}) }}>
          {msg.content}
        </p>
      </div>
    </div>
  )
}

export default function Chat() {
  const navigate = useNavigate()
  const { sourceText, nativeLanguage, apiKey, provider, selectedModel } = useApp()

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!sourceText) navigate('/input')
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const systemPrompt = buildSystemPrompt(nativeLanguage, sourceText || '')

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 96) + 'px'
  }, [])

  function handleInputChange(e) {
    setInput(e.target.value)
    adjustHeight()
  }

  async function sendMessage(content) {
    const text = (content ?? input).trim()
    if (!text || thinking) return

    const userMsg = { role: 'user', content: text, id: Date.now() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setThinking(true)
    textareaRef.current?.focus()

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
        <div style={styles.messagesArea}>
          {isEmpty ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M24 14a10 10 0 01-10 10H6l-3 3V14A10 10 0 1124 14z"
                    stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M9 12h10M9 17h6" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h2 style={styles.emptyTitle}>Ask me anything about the text</h2>
              <p style={styles.emptyDesc}>
                I'm here to help you understand the English text you analyzed.
                Ask in any language — I'll reply in {nativeLanguage}.
              </p>
              <div style={styles.suggestions}>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    style={styles.suggestion}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                      e.currentTarget.style.background = 'var(--bg-card-hover)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                      e.currentTarget.style.background = 'var(--bg-surface)'
                    }}
                    onClick={() => sendMessage(s)}
                  >
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

        {/* Floating input bar */}
        <div style={styles.inputRow}>
          <div style={styles.inputWrap}>
            <textarea
              ref={textareaRef}
              style={styles.input}
              placeholder={`Ask in ${nativeLanguage} or English...`}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={thinking}
              rows={1}
              autoFocus
            />
            <button
              style={{
                ...styles.sendBtn,
                ...(!input.trim() || thinking ? styles.sendBtnDisabled : styles.sendBtnActive),
              }}
              disabled={!input.trim() || thinking}
              onClick={() => sendMessage()}
            >
              {thinking ? <MiniSpinner /> : <SendIcon />}
            </button>
          </div>
          {messages.length > 0 && (
            <button
              style={styles.clearBtn}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              onClick={() => setMessages([])}
            >
              Clear chat
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M14 8L2 2l3 6-3 6 12-6z" fill="currentColor" />
    </svg>
  )
}

function MiniSpinner() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ animation: 'spin 0.75s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5"
        strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  )
}

const styles = {
  page: {
    height: '100vh',
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
    width: '60px',
    height: '60px',
    borderRadius: '18px',
    background: 'var(--accent-primary-dim)',
    border: '1px solid rgba(99,102,241,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '4px',
  },
  emptyTitle: { fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' },
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
    transition: 'border-color 0.2s ease, color 0.2s ease, background 0.2s ease',
  },
  messageList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  bubbleWrap: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    animation: 'fade-in 200ms ease',
  },
  userWrap: { flexDirection: 'row-reverse' },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'var(--accent-primary-dim)',
    border: '1px solid rgba(99,102,241,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.55rem',
    fontWeight: '800',
    color: 'var(--accent-primary)',
    flexShrink: 0,
    letterSpacing: '0.03em',
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
    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
    borderBottomRightRadius: '4px',
    boxShadow: '0 2px 12px rgba(99,102,241,0.25)',
  },
  errorBubble: {
    background: 'var(--error-dim)',
    border: '1px solid rgba(239,68,68,0.2)',
  },
  bubbleText: {
    fontSize: '0.9rem',
    lineHeight: 1.65,
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  userBubbleText: { color: '#fff' },
  dotRow: { display: 'flex', alignItems: 'center', gap: '5px' },
  dot: {
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: 'var(--text-muted)',
    animation: 'bounce-dot 1.2s ease infinite',
  },
  inputRow: {
    padding: '10px 0 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
    background: 'rgba(15, 15, 26, 0.9)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '8px 8px 8px 16px',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'none',
    lineHeight: '1.5',
    minHeight: '24px',
    maxHeight: '96px',
    overflowY: 'auto',
    padding: '4px 0',
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.2s ease, background 0.2s ease',
  },
  sendBtnActive: {
    background: 'var(--accent-primary)',
    color: '#fff',
  },
  sendBtnDisabled: {
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    opacity: 0.5,
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
    transition: 'color 0.2s ease',
  },
}
