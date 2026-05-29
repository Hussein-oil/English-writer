import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import axios from 'axios'
import { useApp } from '../context/AppContext'
import Navbar from '../components/Navbar'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const TABS = ['YouTube Link', 'Upload File', 'Paste Text']
const PREVIEW_LENGTH = 300

function extractVideoId(url) {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  return match ? match[1] : null
}

async function fetchTranscript(videoId) {
  const res = await axios.get(
    `http://localhost:3001/api/transcript?videoId=${videoId}`,
    { timeout: 20000 }
  )
  if (!res.data.success) throw new Error(res.data.error || 'Failed to fetch transcript.')
  const lang = res.data.warning ? 'auto' : (res.data.lang || 'en')
  const text = res.data.fullText || res.data.text || ''
  const minutes = Array.isArray(res.data.minutes) ? res.data.minutes : []
  return { text, lang, minutes }
}

async function readTxtFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsText(file, 'UTF-8')
  })
}

async function readPdfFile(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map(item => item.str).join(' '))
  }
  return pages.join('\n').replace(/\s+/g, ' ').trim()
}

function getCharInfo(len) {
  if (len === 0) return { color: 'var(--text-muted)', label: '' }
  if (len < 500) return { color: 'var(--warning)', label: 'Text might be too short' }
  if (len <= 10000) return { color: 'var(--success)', label: 'Good length' }
  return { color: '#60a5fa', label: 'Long text — will be analyzed in parts' }
}

export default function Input() {
  const navigate = useNavigate()
  const { setSourceText, setTranscriptMinutes } = useApp()

  const [activeTab, setActiveTab] = useState(0)

  const [ytUrl, setYtUrl] = useState('')
  const [ytLoading, setYtLoading] = useState(false)
  const [ytError, setYtError] = useState('')
  const [ytText, setYtText] = useState('')
  const [ytLang, setYtLang] = useState('')
  const [ytMinutes, setYtMinutes] = useState([])
  const [urlFocused, setUrlFocused] = useState(false)

  const [fileText, setFileText] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const [pasteText, setPasteText] = useState('')
  const [textareaFocused, setTextareaFocused] = useState(false)

  const currentText = [ytText, fileText, pasteText][activeTab]
  const hasText = currentText.trim().length > 0

  const ytUrlTrimmed = ytUrl.trim()
  const ytUrlValid = ytUrlTrimmed && extractVideoId(ytUrlTrimmed) !== null
  const ytUrlInvalid = ytUrlTrimmed && !ytUrlValid

  async function handleExtractTranscript() {
    setYtError('')
    setYtText('')
    const videoId = extractVideoId(ytUrl.trim())
    if (!videoId) {
      setYtError('Invalid YouTube URL. Please check the link and try again.')
      return
    }
    setYtLoading(true)
    try {
      const { text, lang, minutes } = await fetchTranscript(videoId)
      setYtText(text)
      setYtLang(lang)
      setYtMinutes(minutes)
    } catch (err) {
      setYtError(err.message || 'Failed to fetch transcript. Please try again.')
    } finally {
      setYtLoading(false)
    }
  }

  async function processFile(file) {
    setFileError('')
    setFileText('')
    setFileName('')
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['txt', 'pdf'].includes(ext)) {
      setFileError('Only .txt and .pdf files are supported.')
      return
    }
    setFileLoading(true)
    try {
      const text = ext === 'pdf' ? await readPdfFile(file) : await readTxtFile(file)
      if (!text.trim()) {
        setFileError('The file appears to be empty or has no extractable text.')
        return
      }
      setFileText(text)
      setFileName(file.name)
    } catch (err) {
      setFileError(err.message || 'Failed to read file.')
    } finally {
      setFileLoading(false)
    }
  }

  const handleFileDrop = useCallback(e => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  const handleDragOver = useCallback(e => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(e => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  function handleFileInputChange(e) {
    const file = e.target.files[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function handleAnalyze() {
    const text = currentText.trim()
    if (!text) return
    setSourceText(text)
    setTranscriptMinutes(activeTab === 0 ? ytMinutes : [])
    navigate('/analysis')
  }

  const charInfo = getCharInfo(pasteText.length)

  return (
    <div style={styles.page} className="page-enter">
      <Navbar />

      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>Add Your Text</h1>
          <p style={styles.desc}>Choose how you want to provide the English content to analyze.</p>
        </div>

        {/* Tab bar with sliding indicator */}
        <div style={styles.tabBar}>
          <div
            style={{
              ...styles.tabIndicator,
              left: `calc(${activeTab} * (100% - 10px) / 3 + 5px)`,
            }}
          />
          {TABS.map((tab, i) => (
            <button
              key={tab}
              style={{
                ...styles.tabBtn,
                ...(activeTab === i ? styles.tabBtnActive : {}),
                position: 'relative',
                zIndex: 1,
              }}
              onClick={() => setActiveTab(i)}
            >
              <TabIcon index={i} active={activeTab === i} />
              {tab}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div style={styles.panel}>

          {/* YouTube */}
          {activeTab === 0 && (
            <div style={styles.tabContent}>
              <label style={styles.label}>YouTube URL</label>
              <div style={styles.urlRow}>
                <input
                  style={{
                    ...styles.urlInput,
                    ...(ytUrlValid ? styles.urlInputValid : {}),
                    ...(ytUrlInvalid ? styles.urlInputInvalid : {}),
                    ...(urlFocused && !ytUrlValid && !ytUrlInvalid ? styles.urlInputFocused : {}),
                  }}
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={ytUrl}
                  onChange={e => { setYtUrl(e.target.value); setYtError(''); setYtText(''); setYtLang('') }}
                  onFocus={() => setUrlFocused(true)}
                  onBlur={() => setUrlFocused(false)}
                  onKeyDown={e => e.key === 'Enter' && !ytLoading && ytUrl.trim() && handleExtractTranscript()}
                  spellCheck={false}
                />
                <button
                  style={{ ...styles.extractBtn, ...(!ytUrl.trim() || ytLoading ? styles.btnDisabled : {}) }}
                  disabled={!ytUrl.trim() || ytLoading}
                  onClick={handleExtractTranscript}
                >
                  {ytLoading ? <SpinnerIcon /> : <TranscriptIcon />}
                  {ytLoading ? 'Extracting...' : 'Extract'}
                </button>
              </div>

              {ytError && (
                <div style={styles.errorBox} className="shake">
                  <ErrorIcon /><span>{ytError}</span>
                </div>
              )}

              {ytLoading && (
                <div style={styles.loadingBox}>
                  <SpinnerIcon />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Fetching transcript from YouTube...
                  </span>
                </div>
              )}

              {ytText && !ytLoading && (
                <>
                  <div style={styles.successBox}>
                    <CheckIcon />
                    <span>Transcript extracted — {ytText.length.toLocaleString()} characters</span>
                  </div>
                  {ytLang !== 'en' && ytLang !== '' && (
                    <div style={styles.warnBox}>
                      <WarnIcon />
                      <span>English transcript not found. Showing available transcript — it may not be in English.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Upload File */}
          {activeTab === 1 && (
            <div style={styles.tabContent}>
              <label style={styles.label}>Upload a file</label>
              <div
                style={{
                  ...styles.dropZone,
                  ...(isDragging ? styles.dropZoneActive : {}),
                  ...(fileText ? styles.dropZoneDone : {}),
                }}
                className={isDragging ? 'drop-zone-dragging' : ''}
                onDrop={handleFileDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !fileLoading && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileInputChange}
                />
                {fileLoading ? (
                  <div style={styles.dropInner}>
                    <SpinnerIcon size={28} />
                    <span style={styles.dropPrimary}>Reading file...</span>
                  </div>
                ) : fileText ? (
                  <div style={styles.dropInner}>
                    <FileSuccessIcon />
                    <span style={styles.dropPrimary}>{fileName}</span>
                    <span style={styles.dropSub}>{fileText.length.toLocaleString()} characters extracted</span>
                    <button
                      style={styles.changeFileBtn}
                      onClick={e => { e.stopPropagation(); setFileText(''); setFileName(''); setFileError('') }}
                    >
                      Change file
                    </button>
                  </div>
                ) : (
                  <div style={styles.dropInner}>
                    <UploadIcon dragging={isDragging} />
                    <span style={styles.dropPrimary}>
                      {isDragging ? 'Release to upload' : 'Drop a file here, or click to browse'}
                    </span>
                    <span style={styles.dropSub}>Supports .txt and .pdf files</span>
                  </div>
                )}
              </div>

              {fileError && (
                <div style={styles.errorBox}>
                  <ErrorIcon /><span>{fileError}</span>
                </div>
              )}
            </div>
          )}

          {/* Paste Text */}
          {activeTab === 2 && (
            <div style={styles.tabContent}>
              <label style={styles.label}>Paste your text</label>
              <div style={styles.textareaWrap}>
                <textarea
                  style={{
                    ...styles.textarea,
                    ...(textareaFocused ? styles.textareaFocused : {}),
                  }}
                  placeholder="Paste your English text here..."
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  onFocus={() => setTextareaFocused(true)}
                  onBlur={() => setTextareaFocused(false)}
                  spellCheck={false}
                />
                <div style={styles.charRow}>
                  {charInfo.label && (
                    <span style={{ ...styles.charHint, color: charInfo.color }}>{charInfo.label}</span>
                  )}
                  <span style={{ ...styles.charCounter, color: charInfo.color }}>
                    {pasteText.length.toLocaleString()} chars
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview + Analyze */}
        {hasText && (
          <div style={styles.previewCard}>
            <div style={styles.previewHeader}>
              <span style={styles.previewLabel}>Preview</span>
              <span style={styles.previewMeta}>{currentText.length.toLocaleString()} characters</span>
            </div>
            <p style={styles.previewText}>
              {currentText.slice(0, PREVIEW_LENGTH)}
              {currentText.length > PREVIEW_LENGTH && (
                <span style={{ color: 'var(--text-muted)' }}>...</span>
              )}
            </p>
            <button style={styles.analyzeBtn} className="btn-shimmer" onClick={handleAnalyze}>
              <AnalyzeIcon />
              Analyze Text
              <ArrowIcon />
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TabIcon({ index, active }) {
  const color = active ? 'var(--accent-primary)' : 'var(--text-muted)'
  if (index === 0) return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2" width="12" height="9" rx="1.5" stroke={color} strokeWidth="1.3" />
      <path d="M5.5 5.5L9 7l-3.5 1.5V5.5z" fill={color} />
    </svg>
  )
  if (index === 1) return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M8 1H3.5A1.5 1.5 0 002 2.5v9A1.5 1.5 0 003.5 13h7A1.5 1.5 0 0012 11.5V5L8 1z"
        stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 1v4h4" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke={color} strokeWidth="1.3" />
      <path d="M4 4.5h6M4 7h6M4 9.5h4" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function SpinnerIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none"
      style={{ animation: 'spin 0.75s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5"
        strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  )
}

function TranscriptIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2 3h11M2 6h8M2 9h9M2 12h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7.5" cy="7.5" r="6.5" stroke="var(--error)" strokeWidth="1.3" />
      <path d="M7.5 4.5v3.5M7.5 10h.01" stroke="var(--error)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7.5" cy="7.5" r="6.5" stroke="var(--success)" strokeWidth="1.3" />
      <path d="M4.5 7.5l2 2 4-4" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function UploadIcon({ dragging }) {
  const color = dragging ? 'var(--accent-primary)' : 'var(--text-muted)'
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M16 22V10M16 10l-5 5M16 10l5 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 24h20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function FileSuccessIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M20 3H9a2 2 0 00-2 2v22a2 2 0 002 2h14a2 2 0 002-2V8l-5-5z"
        stroke="var(--success)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20 3v5h5" stroke="var(--success)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 17l2.5 2.5L21 13" stroke="var(--success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
      <path d="M7.5 1.5L13.5 13H1.5L7.5 1.5z" stroke="#f59e0b" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7.5 6v3M7.5 11h.01" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function AnalyzeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.5 6.5h4M6.5 4.5v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 7.5h9M8.5 3.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flex: 1,
    maxWidth: '700px',
    width: '100%',
    margin: '0 auto',
    padding: '48px 24px 80px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '6px' },
  title: {
    fontSize: '1.6rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.04em',
    lineHeight: 1.2,
  },
  desc: { fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 },
  tabBar: {
    display: 'flex',
    gap: '0',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '5px',
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: '5px',
    width: 'calc((100% - 10px) / 3)',
    height: 'calc(100% - 10px)',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-md)',
    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 1px 6px rgba(0,0,0,0.3)',
    zIndex: 0,
    pointerEvents: 'none',
  },
  tabBtn: {
    flex: 1,
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: '9px 12px',
    fontSize: '0.82rem',
    fontWeight: '500',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    transition: 'color 0.2s ease',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  tabBtnActive: { color: 'var(--accent-primary)' },
  panel: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '28px',
  },
  tabContent: { display: 'flex', flexDirection: 'column', gap: '14px' },
  label: {
    fontSize: '0.72rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  urlRow: { display: 'flex', gap: '10px', alignItems: 'stretch' },
  urlInput: {
    flex: 1,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '11px 14px',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    minWidth: 0,
  },
  urlInputFocused: {
    borderColor: 'var(--accent-primary)',
    boxShadow: '0 0 0 3px var(--accent-glow)',
  },
  urlInputValid: {
    borderColor: 'var(--success)',
    boxShadow: '0 0 0 3px rgba(16,185,129,0.1)',
  },
  urlInputInvalid: {
    borderColor: 'var(--error)',
    boxShadow: '0 0 0 3px rgba(239,68,68,0.1)',
  },
  extractBtn: {
    background: 'var(--accent-primary-dim)',
    border: '1px solid rgba(99,102,241,0.25)',
    color: 'var(--accent-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '11px 18px',
    fontSize: '0.82rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.2s ease',
    flexShrink: 0,
  },
  btnDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'var(--error-dim)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    fontSize: '0.82rem',
    color: 'var(--error)',
    lineHeight: 1.5,
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 0 4px',
    color: 'var(--text-muted)',
  },
  successBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--success-dim)',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: 'var(--radius-md)',
    padding: '11px 14px',
    fontSize: '0.82rem',
    color: 'var(--success)',
  },
  warnBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: 'var(--radius-md)',
    padding: '11px 14px',
    fontSize: '0.82rem',
    color: '#f59e0b',
    lineHeight: 1.5,
  },
  dropZone: {
    border: '2px dashed var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '52px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s ease, background 0.2s ease',
    background: 'var(--bg-base)',
  },
  dropZoneActive: {
    borderColor: 'var(--accent-primary)',
    background: 'rgba(99,102,241,0.05)',
    borderStyle: 'solid',
  },
  dropZoneDone: {
    borderColor: 'rgba(16,185,129,0.3)',
    background: 'var(--success-dim)',
    cursor: 'default',
    borderStyle: 'solid',
  },
  dropInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    textAlign: 'center',
  },
  dropPrimary: {
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    marginTop: '4px',
    wordBreak: 'break-all',
  },
  dropSub: { fontSize: '0.78rem', color: 'var(--text-muted)' },
  changeFileBtn: {
    marginTop: '6px',
    background: 'none',
    border: '1px solid rgba(16,185,129,0.3)',
    color: 'var(--success)',
    borderRadius: 'var(--radius-sm)',
    padding: '5px 14px',
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s ease',
  },
  textareaWrap: { position: 'relative', display: 'flex', flexDirection: 'column' },
  textarea: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    lineHeight: '1.7',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: '220px',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    outline: 'none',
  },
  textareaFocused: {
    borderColor: 'var(--accent-primary)',
    boxShadow: '0 0 0 3px var(--accent-glow)',
  },
  charRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '7px',
    transition: 'color 0.3s ease',
  },
  charHint: {
    fontSize: '0.72rem',
    fontWeight: '500',
    transition: 'color 0.3s ease',
  },
  charCounter: {
    fontSize: '0.72rem',
    fontFamily: "'SF Mono', 'Cascadia Code', monospace",
    transition: 'color 0.3s ease',
  },
  previewCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderLeft: '3px solid var(--accent-primary)',
    borderRadius: 'var(--radius-xl)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewLabel: {
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--accent-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  previewMeta: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontFamily: "'SF Mono', 'Cascadia Code', monospace",
  },
  previewText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.7',
    padding: '14px',
    background: 'var(--bg-base)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    wordBreak: 'break-word',
    fontFamily: "'Georgia', serif",
  },
  analyzeBtn: {
    width: '100%',
    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: '14px 20px',
    fontSize: '0.95rem',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
    boxShadow: '0 4px 20px rgba(99,102,241,0.28)',
    transition: 'opacity 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
  },
}
