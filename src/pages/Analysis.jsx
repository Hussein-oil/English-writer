import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Navbar from '../components/Navbar'
import { callAI } from '../utils/callAI'

// ─── Section generation (non-YouTube) ────────────────────────────────────────

function splitTextIntoSections(text, maxLen = 500) {
  const parts = text.match(/[^.!?\n]+[.!?\n]+|\S[^.!?\n]*/g) || [text]
  const sections = []
  let current = ''
  let num = 1

  for (const part of parts) {
    if (current.length + part.length > maxLen && current.trim()) {
      sections.push({ minute: num, timeLabel: `Section ${num}`, text: current.trim(), segments: [] })
      num++
      current = part
    } else {
      current += part
    }
  }
  if (current.trim()) {
    sections.push({ minute: num, timeLabel: `Section ${num}`, text: current.trim(), segments: [] })
  }
  return sections
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildMinutePrompt(section, nativeLanguage) {
  return `You are an English teacher. The student speaks ${nativeLanguage} at a ZERO English level.

Analyze this English text segment (from ${section.timeLabel}):

"${section.text}"

Return ONLY this JSON (no markdown):
{
  "key_vocabulary": [
    {
      "word": "English word as it appears",
      "meaning": "translation in ${nativeLanguage}",
      "pronunciation": "simple pronunciation guide",
      "pos": "noun/verb/adj/adv/etc",
      "example": "simple example sentence in English"
    }
  ],
  "sentence_breakdown": [
    {
      "sentence": "one important sentence from the text",
      "translation": "translation in ${nativeLanguage}",
      "grammar_note": "brief grammar explanation in ${nativeLanguage}"
    }
  ],
  "minute_summary": "What was said in this segment — explained simply in ${nativeLanguage}",
  "grammar_focus": {
    "pattern": "one grammar pattern found in this text e.g: 'Subject + is/are + adjective'",
    "explanation": "explanation in ${nativeLanguage}",
    "from_text": "the actual sentence from the text that uses this pattern"
  }
}`
}

function parseJSON(raw) {
  try {
    let text = raw.trim()
    const fence = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/)
    if (fence) text = fence[1].trim()
    const s = text.indexOf('{')
    const e = text.lastIndexOf('}')
    if (s !== -1 && e > s) text = text.slice(s, e + 1)
    return JSON.parse(text)
  } catch {
    throw new Error('The AI returned an invalid response. Please try again.')
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ title, count }) {
  return (
    <div style={styles.sectionLabel}>
      <span style={styles.sectionLabelText}>{title}</span>
      {count > 0 && <span style={styles.sectionBadge}>{count}</span>}
    </div>
  )
}

function SidebarItem({ section, active, analyzed, isLoading, onClick }) {
  return (
    <button style={{ ...styles.sidebarItem, ...(active ? styles.sidebarItemActive : {}) }} onClick={onClick}>
      <div style={styles.sidebarItemRow}>
        <span style={{ ...styles.sidebarTime, ...(active ? styles.sidebarTimeActive : {}) }}>
          {section.timeLabel}
        </span>
        {isLoading
          ? <div style={styles.sidebarSpinner} />
          : analyzed
            ? <div style={styles.sidebarDot} />
            : null}
      </div>
      <span style={styles.sidebarPreview}>
        {(section.text || '').slice(0, 80)}
      </span>
    </button>
  )
}

function VocabCard({ item }) {
  return (
    <div style={styles.vocabCard}>
      <div style={styles.vocabTop}>
        <span style={styles.vocabWord}>{item.word}</span>
        {item.pos && <span style={styles.vocabPOS}>{item.pos}</span>}
      </div>
      {item.pronunciation && <span style={styles.vocabPronun}>{item.pronunciation}</span>}
      <span style={styles.vocabMeaning}>{item.meaning}</span>
      {item.example && (
        <div style={styles.vocabExample}>
          <span style={styles.vocabQ}>"</span>
          <span style={styles.vocabExText}>{item.example}</span>
          <span style={styles.vocabQ}>"</span>
        </div>
      )}
    </div>
  )
}

function SentenceCard({ item }) {
  return (
    <div style={styles.sentenceCard}>
      <p style={styles.sentenceEn}>{item.sentence}</p>
      <p style={styles.sentenceTr}>{item.translation}</p>
      {item.grammar_note && (
        <p style={styles.sentenceGrammar}>
          <span style={styles.grammarTag}>Grammar: </span>
          {item.grammar_note}
        </p>
      )}
    </div>
  )
}

function GrammarFocusCard({ item }) {
  return (
    <div style={styles.grammarFocusCard}>
      <span style={styles.grammarFocusLabel}>Grammar Focus</span>
      <code style={styles.grammarPattern}>{item.pattern}</code>
      <p style={styles.grammarExplanation}>{item.explanation}</p>
      {item.from_text && (
        <div style={styles.grammarFromWrap}>
          <span style={styles.grammarFromLabel}>From the text:</span>
          <p style={styles.grammarFromText}>"{item.from_text}"</p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ text }) {
  return (
    <div style={styles.summaryCard}>
      <span style={styles.summaryLabel}>Summary</span>
      <p style={styles.summaryText}>{text}</p>
    </div>
  )
}

function OriginalBlock({ section }) {
  return (
    <div style={styles.originalBlock}>
      <div style={styles.originalHeader}>
        <span style={styles.originalLabel}>Original Text</span>
        <span style={styles.originalTime}>{section.timeLabel}</span>
      </div>
      <p style={styles.originalText}>{section.text}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Analysis() {
  const navigate = useNavigate()
  const { sourceText, nativeLanguage, apiKey, provider, selectedModel, transcriptMinutes } = useApp()

  // Always treat as array — guards against undefined from old context or edge cases
  const minutes = Array.isArray(transcriptMinutes) ? transcriptMinutes : []
  const isYouTube = minutes.length > 0

  const [sections, setSections] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cache, setCache] = useState({})
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [analyzingAll, setAnalyzingAll] = useState(false)
  const [analyzeAllProgress, setAnalyzeAllProgress] = useState('')
  const analyzingAllRef = useRef(false)

  // Set up sections on mount and auto-analyze first one
  useEffect(() => {
    if (!sourceText) { navigate('/input'); return }
    const secs = minutes.length > 0
      ? minutes
      : splitTextIntoSections(sourceText, 500)
    setSections(secs)
    if (secs.length > 0) {
      setSelectedIndex(0)
      fetchAndCache(secs[0], {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchAndCache(section, existingCache) {
    if (existingCache[section.minute]) return
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const raw = await callAI({
        provider, apiKey, selectedModel,
        userMessages: [{ role: 'user', content: buildMinutePrompt(section, nativeLanguage) }],
        maxTokens: 3000,
      })
      const result = parseJSON(raw)
      setCache(prev => ({ ...prev, [section.minute]: result }))
    } catch (err) {
      setAnalyzeError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  function handleSelectSection(index) {
    if (analyzingAll) return
    const section = sections[index]
    setSelectedIndex(index)
    setAnalyzeError('')
    if (section && !cache[section.minute] && !analyzing) {
      fetchAndCache(section, cache)
    }
  }

  async function handleAnalyzeAll() {
    if (analyzingAllRef.current || sections.length === 0) return
    analyzingAllRef.current = true
    setAnalyzingAll(true)

    // snapshot which are already cached
    const done = new Set(Object.keys(cache).map(Number))

    for (let i = 0; i < sections.length; i++) {
      if (!analyzingAllRef.current) break
      const section = sections[i]
      if (done.has(section.minute)) continue

      setSelectedIndex(i)
      setAnalyzeAllProgress(`Analyzing ${section.timeLabel} (${i + 1} of ${sections.length})...`)
      setAnalyzing(true)
      setAnalyzeError('')
      try {
        const raw = await callAI({
          provider, apiKey, selectedModel,
          userMessages: [{ role: 'user', content: buildMinutePrompt(section, nativeLanguage) }],
          maxTokens: 3000,
        })
        const result = parseJSON(raw)
        setCache(prev => ({ ...prev, [section.minute]: result }))
        done.add(section.minute)
      } catch {
        // continue even if one section fails
      } finally {
        setAnalyzing(false)
      }

      if (i < sections.length - 1) await new Promise(r => setTimeout(r, 250))
    }

    analyzingAllRef.current = false
    setAnalyzingAll(false)
    setAnalyzeAllProgress('')
  }

  function handleStopAll() {
    analyzingAllRef.current = false
  }

  const selectedSection = sections[selectedIndex] ?? null
  const currentResult = selectedSection ? cache[selectedSection.minute] : null
  const cachedCount = Object.keys(cache).length

  return (
    <div style={styles.page}>
      <Navbar />

      <div style={styles.panelArea}>
        {/* ── Sidebar ── */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div style={styles.sidebarHeaderTop}>
              <span style={styles.sidebarTitle}>{isYouTube ? 'Minutes' : 'Sections'}</span>
              <span style={styles.sidebarCount}>{cachedCount}/{sections.length}</span>
            </div>
            {!analyzingAll ? (
              <button
                style={styles.analyzeAllBtn}
                onClick={handleAnalyzeAll}
                disabled={sections.length === 0 || analyzingAll}
              >
                <PlayIcon />
                Analyze All
              </button>
            ) : (
              <button style={styles.stopBtn} onClick={handleStopAll}>
                <StopIcon />
                Stop
              </button>
            )}
          </div>

          <div style={styles.sidebarList}>
            {sections.map((section, i) => (
              <SidebarItem
                key={section.minute}
                section={section}
                active={selectedIndex === i}
                analyzed={!!cache[section.minute]}
                isLoading={analyzing && selectedIndex === i}
                onClick={() => handleSelectSection(i)}
              />
            ))}
          </div>
        </div>

        {/* ── Main panel ── */}
        <div style={styles.mainPanel}>
          {/* Top bar */}
          <div style={styles.mainHeader}>
            <div>
              <h1 style={styles.mainTitle}>
                {selectedSection ? selectedSection.timeLabel : 'Text Analysis'}
              </h1>
              <p style={styles.mainSubtitle}>
                {sections.length} {isYouTube ? 'minutes' : 'sections'} · {nativeLanguage} explanations
              </p>
            </div>
            <div style={styles.mainHeaderRight}>
              <button style={styles.readerBtn} onClick={() => navigate('/reader')}>
                <ReaderIcon /> Reader
              </button>
              <button style={styles.chatBtn} onClick={() => navigate('/chat')}>
                <ChatIcon /> Chat
              </button>
            </div>
          </div>

          {/* Analyze-all progress banner */}
          {analyzingAll && (
            <div style={styles.progressBanner}>
              <div style={styles.progressSpinner} />
              <span style={styles.progressText}>{analyzeAllProgress}</span>
              <div style={styles.progressBarWrap}>
                <div
                  style={{
                    ...styles.progressBarFill,
                    width: `${Math.round((cachedCount / sections.length) * 100)}%`,
                    transition: 'width 400ms ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div style={styles.mainContent}>
            {!selectedSection && (
              <div style={styles.emptyState}>
                <p style={styles.emptyText}>Select a section to begin learning.</p>
              </div>
            )}

            {selectedSection && (
              <>
                <OriginalBlock section={selectedSection} />

                {/* Loading */}
                {analyzing && !currentResult && (
                  <div style={styles.sectionLoading}>
                    <div style={styles.sectionSpinner} />
                    <span style={styles.sectionLoadingText}>
                      Analyzing {selectedSection.timeLabel}...
                    </span>
                  </div>
                )}

                {/* Error */}
                {analyzeError && !analyzing && (
                  <div style={styles.errorCard}>
                    <p style={styles.errorMsg}>{analyzeError}</p>
                    <button
                      style={styles.retryBtn}
                      onClick={() => fetchAndCache(selectedSection, {})}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Lesson content */}
                {currentResult && (
                  <div style={styles.lesson}>
                    {currentResult.minute_summary && (
                      <SummaryCard text={currentResult.minute_summary} />
                    )}

                    {currentResult.key_vocabulary?.length > 0 && (
                      <div style={styles.lessonSection}>
                        <SectionLabel title="Key Vocabulary" count={currentResult.key_vocabulary.length} />
                        <div style={styles.vocabGrid}>
                          {currentResult.key_vocabulary.map((v, i) => (
                            <VocabCard key={i} item={v} />
                          ))}
                        </div>
                      </div>
                    )}

                    {currentResult.sentence_breakdown?.length > 0 && (
                      <div style={styles.lessonSection}>
                        <SectionLabel title="Sentence Breakdown" count={currentResult.sentence_breakdown.length} />
                        <div style={styles.sentenceList}>
                          {currentResult.sentence_breakdown.map((s, i) => (
                            <SentenceCard key={i} item={s} />
                          ))}
                        </div>
                      </div>
                    )}

                    {currentResult.grammar_focus && (
                      <div style={styles.lessonSection}>
                        <GrammarFocusCard item={currentResult.grammar_focus} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 2l7 4-7 4V2z" fill="currentColor" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" />
    </svg>
  )
}

function ReaderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 4h6M3.5 6.5h6M3.5 9h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M11 6.5a4.5 4.5 0 01-4.5 4.5H2.5L1 12.5V6.5a4.5 4.5 0 119 0z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg-base)',
    display: 'flex',
    flexDirection: 'column',
  },
  panelArea: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  // ── Sidebar ──
  sidebar: {
    width: '260px',
    flexShrink: 0,
    borderRight: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '16px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flexShrink: 0,
  },
  sidebarHeaderTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sidebarTitle: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  sidebarCount: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontFamily: "'SF Mono', monospace",
  },
  analyzeAllBtn: {
    width: '100%',
    background: 'var(--accent-primary-dim)',
    border: '1px solid rgba(99,102,241,0.2)',
    color: 'var(--accent-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'opacity 150ms ease',
  },
  stopBtn: {
    width: '100%',
    background: 'var(--error-dim)',
    border: '1px solid rgba(248,113,113,0.2)',
    color: 'var(--error)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  sidebarList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  sidebarItem: {
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    transition: 'background 120ms ease',
    width: '100%',
  },
  sidebarItemActive: {
    background: 'var(--accent-primary-dim)',
  },
  sidebarItemRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sidebarTime: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    fontFamily: "'SF Mono', 'Cascadia Code', monospace",
  },
  sidebarTimeActive: {
    color: 'var(--accent-primary)',
  },
  sidebarSpinner: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '1.5px solid var(--border)',
    borderTopColor: 'var(--accent-primary)',
    animation: 'spin 0.75s linear infinite',
    flexShrink: 0,
  },
  sidebarDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: 'var(--success)',
    flexShrink: 0,
  },
  sidebarPreview: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
    overflow: 'hidden',
    maxHeight: '2.8em',
    wordBreak: 'break-word',
  },
  // ── Main panel ──
  mainPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  mainHeader: {
    padding: '20px 28px 16px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexShrink: 0,
    background: 'var(--bg-surface)',
  },
  mainTitle: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.03em',
    lineHeight: 1.2,
  },
  mainSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  mainHeaderRight: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  readerBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    fontSize: '0.78rem',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    transition: 'border-color 150ms ease, color 150ms ease',
  },
  chatBtn: {
    background: 'var(--accent-primary)',
    border: 'none',
    color: '#fff',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  progressBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 28px',
    background: 'var(--accent-primary-dim)',
    borderBottom: '1px solid rgba(99,102,241,0.15)',
    flexShrink: 0,
  },
  progressSpinner: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2px solid rgba(99,102,241,0.2)',
    borderTopColor: 'var(--accent-primary)',
    animation: 'spin 0.75s linear infinite',
    flexShrink: 0,
  },
  progressText: {
    flex: 1,
    fontSize: '0.8rem',
    color: 'var(--accent-primary)',
    fontWeight: '500',
  },
  progressBarWrap: {
    width: '120px',
    height: '4px',
    background: 'rgba(99,102,241,0.15)',
    borderRadius: '99px',
    overflow: 'hidden',
    flexShrink: 0,
  },
  progressBarFill: {
    height: '100%',
    background: 'var(--accent-primary)',
    borderRadius: '99px',
  },
  mainContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
  },
  // Original text block
  originalBlock: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderLeft: '3px solid var(--accent-primary)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  },
  originalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  originalLabel: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  originalTime: {
    fontSize: '0.7rem',
    color: 'var(--accent-primary)',
    fontFamily: "'SF Mono', monospace",
    fontWeight: '600',
  },
  originalText: {
    padding: '16px',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    lineHeight: 1.8,
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
  // Loading / error states
  sectionLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '32px 0',
    justifyContent: 'center',
  },
  sectionSpinner: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '2px solid var(--border)',
    borderTopColor: 'var(--accent-primary)',
    animation: 'spin 0.75s linear infinite',
  },
  sectionLoadingText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  errorCard: {
    background: 'var(--error-dim)',
    border: '1px solid rgba(248,113,113,0.2)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  errorMsg: {
    fontSize: '0.875rem',
    color: 'var(--error)',
    lineHeight: 1.5,
  },
  retryBtn: {
    background: 'var(--error)',
    border: 'none',
    color: '#fff',
    borderRadius: 'var(--radius-sm)',
    padding: '7px 14px',
    fontSize: '0.78rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  // Lesson
  lesson: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    animation: 'fade-in 250ms ease',
  },
  lessonSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingBottom: '10px',
    borderBottom: '1px solid var(--border)',
  },
  sectionLabelText: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  sectionBadge: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '99px',
    padding: '1px 7px',
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  // Summary
  summaryCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderLeft: '3px solid var(--accent-secondary)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  summaryLabel: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'var(--accent-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  summaryText: {
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    lineHeight: 1.75,
  },
  // Vocabulary
  vocabGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  vocabCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  vocabTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  vocabWord: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: 'var(--accent-primary)',
    fontFamily: "'SF Mono', 'Cascadia Code', monospace",
  },
  vocabPOS: {
    fontSize: '0.62rem',
    fontWeight: '600',
    color: 'var(--accent-secondary)',
    background: 'var(--accent-secondary-dim)',
    border: '1px solid rgba(139,92,246,0.18)',
    borderRadius: '99px',
    padding: '1px 6px',
    textTransform: 'lowercase',
    flexShrink: 0,
  },
  vocabPronun: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontFamily: "'SF Mono', monospace",
  },
  vocabMeaning: {
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    fontWeight: '500',
    lineHeight: 1.4,
    marginTop: '2px',
  },
  vocabExample: {
    display: 'flex',
    gap: '2px',
    marginTop: '6px',
    padding: '6px 10px',
    background: 'var(--bg-base)',
    borderRadius: 'var(--radius-sm)',
    borderLeft: '2px solid var(--accent-primary)',
  },
  vocabQ: {
    color: 'var(--accent-primary)',
    fontWeight: '700',
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  vocabExText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  // Sentence breakdown
  sentenceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sentenceCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  sentenceEn: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
  sentenceTr: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    paddingTop: '4px',
    borderTop: '1px solid var(--border)',
  },
  sentenceGrammar: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  grammarTag: {
    fontWeight: '600',
    color: 'var(--accent-primary)',
  },
  // Grammar focus
  grammarFocusCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  grammarFocusLabel: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: 'var(--accent-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  grammarPattern: {
    display: 'block',
    fontFamily: "'SF Mono', 'Cascadia Code', monospace",
    fontSize: '0.88rem',
    color: 'var(--accent-primary)',
    background: 'var(--accent-primary-dim)',
    border: '1px solid rgba(99,102,241,0.18)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 14px',
    letterSpacing: '0.02em',
  },
  grammarExplanation: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
  },
  grammarFromWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '10px 12px',
    background: 'var(--bg-base)',
    borderRadius: 'var(--radius-sm)',
    borderLeft: '2px solid var(--border-hover)',
  },
  grammarFromLabel: {
    fontSize: '0.65rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  grammarFromText: {
    fontSize: '0.83rem',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
}
