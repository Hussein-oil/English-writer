import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const LANGUAGES = [
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'fa', name: 'Persian', native: 'فارسی' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
]

const SUBTITLES = {
  ar: 'منصتك الذكية لتعلم اللغة الإنجليزية',
  fr: 'Votre plateforme intelligente pour apprendre l\'anglais',
  es: 'Tu plataforma inteligente para aprender inglés',
  zh: '您的智能英语学习平台',
  tr: 'İngilizce öğrenmek için akıllı platformunuz',
  fa: 'پلتفرم هوشمند شما برای یادگیری زبان انگلیسی',
  hi: 'अंग्रेजी सीखने के लिए आपका स्मार्ट प्लेटफॉर्म',
  de: 'Ihre intelligente Plattform zum Englischlernen',
  it: 'La tua piattaforma intelligente per imparare l\'inglese',
  pt: 'Sua plataforma inteligente para aprender inglês',
  ru: 'Ваша умная платформа для изучения английского',
  ja: '英語学習のためのスマートプラットフォーム',
  ko: '영어 학습을 위한 스마트 플랫폼',
  nl: 'Uw slimme platform voor het leren van Engels',
  pl: 'Twoja inteligentna platforma do nauki angielskiego',
  sv: 'Din smarta plattform för att lära dig engelska',
  id: 'Platform cerdas Anda untuk belajar bahasa Inggris',
  ms: 'Platform pintar anda untuk belajar bahasa Inggeris',
  ur: 'انگریزی سیکھنے کے لیے آپ کا ذہین پلیٹ فارم',
  bn: 'ইংরেজি শেখার জন্য আপনার স্মার্ট প্ল্যাটফর্ম',
}

const PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
  },
  openai: {
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  deepseek: {
    label: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  google: {
    label: 'Google',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  groq: {
    label: 'Groq',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  },
}

// Providers that share the sk- key prefix — shown as a choice when ambiguous
const SK_AMBIGUOUS = ['openai', 'deepseek']

const CUSTOM_MODELS = [
  'meta-llama/Llama-3.3-70B-Instruct',
  'meta-llama/Llama-3.1-8B-Instruct',
  'mistralai/Mixtral-8x7B-Instruct-v0.1',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'deepseek-ai/DeepSeek-V3',
  'deepseek-ai/DeepSeek-R1',
  'microsoft/Phi-3-medium-128k-instruct',
  'google/gemma-2-9b-it',
  'Qwen/Qwen2.5-72B-Instruct',
]

function detectProvider(key) {
  if (key.startsWith('sk-ant-')) return 'anthropic'
  if (key.startsWith('gsk_')) return 'groq'
  if (key.startsWith('AIza')) return 'google'
  if (key.startsWith('sk-')) return 'ambiguous'  // OpenAI and DeepSeek share this prefix
  return 'custom'
}

function getBrowserLang() {
  const lang = navigator.language?.split('-')[0] || 'en'
  return SUBTITLES[lang] ? lang : 'en'
}

export default function Welcome() {
  const navigate = useNavigate()
  const { saveConfig } = useApp()

  const [step, setStep] = useState(1)
  const [browserLang] = useState(getBrowserLang)

  // Step 1
  const [langSearch, setLangSearch] = useState('')
  const [langOpen, setLangOpen] = useState(false)
  const [selectedLang, setSelectedLang] = useState(null)
  const langRef = useRef(null)

  // Step 2
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [detectedProvider, setDetectedProvider] = useState(null)
  const [ambiguousProviderChoice, setAmbiguousProviderChoice] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [customDropdownValue, setCustomDropdownValue] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [detecting, setDetecting] = useState(false)

  const filteredLangs = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
    l.native.includes(langSearch)
  )

  useEffect(() => {
    function handleClick(e) {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectLanguage(lang) {
    setSelectedLang(lang)
    setLangSearch('')
    setLangOpen(false)
  }

  function resetProviderState() {
    setDetectedProvider(null)
    setAmbiguousProviderChoice('')
    setSelectedModel('')
    setCustomDropdownValue('')
    setCustomModel('')
  }

  function handleDetect() {
    if (!apiKey.trim()) return
    setDetecting(true)
    setAmbiguousProviderChoice('')
    setSelectedModel('')
    setCustomDropdownValue('')
    setCustomModel('')
    setTimeout(() => {
      const p = detectProvider(apiKey.trim())
      setDetectedProvider(p)
      setDetecting(false)
    }, 600)
  }

  function handleGetStarted() {
    let model
    let effectiveProvider = detectedProvider

    if (detectedProvider === 'custom') {
      model = customDropdownValue === '__custom__' ? customModel.trim() : customDropdownValue
    } else if (detectedProvider === 'ambiguous') {
      model = selectedModel
      effectiveProvider = ambiguousProviderChoice
    } else {
      model = selectedModel
    }

    if (!model || !effectiveProvider) return
    saveConfig({
      nativeLanguage: selectedLang.name,
      apiKey: apiKey.trim(),
      provider: effectiveProvider,
      selectedModel: model,
    })
    navigate('/input')
  }

  const canProceedStep1 = !!selectedLang
  const canGetStarted = (() => {
    if (detectedProvider === 'custom') {
      return customDropdownValue === '__custom__' ? customModel.trim().length > 0 : customDropdownValue.length > 0
    }
    if (detectedProvider === 'ambiguous') {
      return ambiguousProviderChoice.length > 0 && selectedModel.length > 0
    }
    return selectedModel.length > 0
  })()

  const subtitle = SUBTITLES[browserLang] || 'Your intelligent English learning platform'

  return (
    <div style={styles.page}>
      <div style={styles.bg} />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoMark} />
          <h1 style={styles.title}>EN-Teacher</h1>
          <p style={styles.subtitle}>{subtitle}</p>
        </div>

        {/* Step indicator */}
        <div style={styles.stepRow}>
          <div style={{ ...styles.stepDot, ...(step >= 1 ? styles.stepDotActive : {}) }}>
            <span style={styles.stepNum}>1</span>
          </div>
          <div style={{ ...styles.stepLine, ...(step >= 2 ? styles.stepLineActive : {}) }} />
          <div style={{ ...styles.stepDot, ...(step >= 2 ? styles.stepDotActive : {}) }}>
            <span style={styles.stepNum}>2</span>
          </div>
        </div>

        {/* Card */}
        <div style={styles.card}>
          {step === 1 && (
            <div style={styles.stepContent}>
              <h2 style={styles.cardTitle}>What is your native language?</h2>
              <p style={styles.cardDesc}>
                We'll tailor explanations and translations to your mother tongue.
              </p>

              {/* Dropdown */}
              <div style={styles.dropdownWrap} ref={langRef}>
                <div
                  style={{
                    ...styles.dropdownTrigger,
                    ...(langOpen ? styles.dropdownTriggerOpen : {}),
                  }}
                  onClick={() => setLangOpen(o => !o)}
                >
                  {selectedLang ? (
                    <span style={styles.selectedLangDisplay}>
                      <span style={styles.selectedLangName}>{selectedLang.name}</span>
                      <span style={styles.selectedLangNative}>{selectedLang.native}</span>
                    </span>
                  ) : (
                    <span style={styles.placeholder}>Select your language</span>
                  )}
                  <ChevronIcon open={langOpen} />
                </div>

                {langOpen && (
                  <div style={styles.dropdown}>
                    <div style={styles.searchWrap}>
                      <SearchIcon />
                      <input
                        autoFocus
                        style={styles.searchInput}
                        placeholder="Search languages..."
                        value={langSearch}
                        onChange={e => setLangSearch(e.target.value)}
                      />
                    </div>
                    <div style={styles.langList}>
                      {filteredLangs.length === 0 ? (
                        <div style={styles.noResults}>No languages found</div>
                      ) : filteredLangs.map(lang => (
                        <div
                          key={lang.code}
                          style={{
                            ...styles.langItem,
                            ...(selectedLang?.code === lang.code ? styles.langItemSelected : {}),
                          }}
                          onClick={() => selectLanguage(lang)}
                        >
                          <span style={styles.langItemName}>{lang.name}</span>
                          <span style={styles.langItemNative}>{lang.native}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                style={{
                  ...styles.primaryBtn,
                  ...(canProceedStep1 ? {} : styles.btnDisabled),
                }}
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={styles.stepContent}>
              <button style={styles.backBtn} onClick={() => { setStep(1); resetProviderState() }}>
                <BackIcon /> Back
              </button>

              <h2 style={styles.cardTitle}>Enter your AI API Key</h2>
              <p style={styles.cardDesc}>
                Your key is stored locally and never sent to our servers.
              </p>

              {/* API Key input */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>API Key</label>
                <div style={styles.inputWrap}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    style={styles.input}
                    placeholder="Enter your API key..."
                    value={apiKey}
                    onChange={e => { setApiKey(e.target.value); resetProviderState() }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    style={styles.eyeBtn}
                    onClick={() => setShowKey(v => !v)}
                    type="button"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <button
                style={{
                  ...styles.detectBtn,
                  ...((!apiKey.trim() || detecting) ? styles.btnDisabled : {}),
                }}
                disabled={!apiKey.trim() || detecting}
                onClick={handleDetect}
              >
                {detecting ? <SpinnerIcon /> : <ScanIcon />}
                {detecting ? 'Detecting...' : 'Detect Model Provider'}
              </button>

              {/* Provider result */}
              {detectedProvider && (
                <div style={styles.providerSection}>
                  <div style={styles.providerBadge}>
                    <span style={{
                      ...styles.providerDot,
                      ...(detectedProvider === 'ambiguous' ? styles.providerDotAmbiguous : {}),
                    }} />
                    <span style={styles.providerLabel}>
                      {detectedProvider === 'ambiguous'
                        ? 'OpenAI-compatible key — choose your provider'
                        : `${PROVIDERS[detectedProvider]?.label ?? 'Custom'} detected`}
                    </span>
                  </div>

                  {detectedProvider === 'ambiguous' ? (
                    <>
                      <p style={styles.selectModelLabel}>Your provider</p>
                      <div style={styles.providerChoiceGrid}>
                        {SK_AMBIGUOUS.map(p => (
                          <button
                            key={p}
                            style={{
                              ...styles.providerChoiceCard,
                              ...(ambiguousProviderChoice === p ? styles.providerChoiceCardSelected : {}),
                            }}
                            onClick={() => { setAmbiguousProviderChoice(p); setSelectedModel('') }}
                          >
                            <span style={styles.providerChoiceName}>{PROVIDERS[p].label}</span>
                            <span style={styles.providerChoiceHint}>
                              {PROVIDERS[p].models.join(' · ')}
                            </span>
                          </button>
                        ))}
                      </div>

                      {ambiguousProviderChoice && (
                        <>
                          <p style={styles.selectModelLabel}>Select a model</p>
                          <div style={styles.modelGrid}>
                            {PROVIDERS[ambiguousProviderChoice].models.map(m => (
                              <button
                                key={m}
                                style={{
                                  ...styles.modelCard,
                                  ...(selectedModel === m ? styles.modelCardSelected : {}),
                                }}
                                onClick={() => setSelectedModel(m)}
                              >
                                <span style={styles.modelName}>{m}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : detectedProvider !== 'custom' ? (
                    <>
                      <p style={styles.selectModelLabel}>Select a model</p>
                      <div style={styles.modelGrid}>
                        {PROVIDERS[detectedProvider].models.map(m => (
                          <button
                            key={m}
                            style={{
                              ...styles.modelCard,
                              ...(selectedModel === m ? styles.modelCardSelected : {}),
                            }}
                            onClick={() => setSelectedModel(m)}
                          >
                            <span style={styles.modelName}>{m}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={styles.selectModelLabel}>Select a model</p>
                      <div style={styles.selectWrap}>
                        <select
                          style={styles.modelSelect}
                          value={customDropdownValue}
                          onChange={e => { setCustomDropdownValue(e.target.value); setCustomModel('') }}
                        >
                          <option value="" disabled>Choose a model...</option>
                          {CUSTOM_MODELS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          <option value="__custom__">Custom — enter manually</option>
                        </select>
                        <SelectChevronIcon />
                      </div>
                      {customDropdownValue === '__custom__' && (
                        <input
                          style={{ ...styles.input, marginTop: '8px' }}
                          placeholder="e.g. org/model-name"
                          value={customModel}
                          onChange={e => setCustomModel(e.target.value)}
                          autoFocus
                        />
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Get Started */}
              {detectedProvider && (
                <button
                  style={{
                    ...styles.primaryBtn,
                    ...styles.getStartedBtn,
                    ...(canGetStarted ? {} : styles.btnDisabled),
                  }}
                  disabled={!canGetStarted}
                  onClick={handleGetStarted}
                >
                  Get Started
                  <ArrowRightIcon />
                </button>
              )}
            </div>
          )}
        </div>

        <p style={styles.footer}>
          Your API key and settings are stored locally in your browser only.
        </p>
      </div>
    </div>
  )
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    position: 'relative',
    overflow: 'hidden',
  },
  bg: {
    position: 'fixed',
    inset: 0,
    background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%), #0a0a0f',
    zIndex: 0,
    pointerEvents: 'none',
  },
  container: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '32px',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  logoMark: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    boxShadow: '0 0 32px rgba(99,102,241,0.35)',
    marginBottom: '4px',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '800',
    letterSpacing: '-0.04em',
    background: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1.1,
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
    fontWeight: '400',
    letterSpacing: '0.01em',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    width: '120px',
  },
  stepDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-surface)',
    flexShrink: 0,
    transition: 'all 250ms ease',
  },
  stepDotActive: {
    borderColor: 'var(--accent-primary)',
    background: 'var(--accent-primary-dim)',
    boxShadow: '0 0 12px rgba(99,102,241,0.25)',
  },
  stepNum: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  stepLine: {
    flex: 1,
    height: '2px',
    background: 'var(--border)',
    transition: 'background 250ms ease',
  },
  stepLineActive: {
    background: 'var(--accent-primary)',
  },
  card: {
    width: '100%',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '36px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.06)',
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  cardTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  cardDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    marginTop: '-8px',
  },
  // Dropdown
  dropdownWrap: {
    position: 'relative',
  },
  dropdownTrigger: {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: 'border-color var(--transition)',
    userSelect: 'none',
  },
  dropdownTriggerOpen: {
    borderColor: 'var(--accent-primary)',
    boxShadow: '0 0 0 3px var(--accent-primary-dim)',
  },
  placeholder: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
  selectedLangDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  selectedLangName: {
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  selectedLangNative: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 100,
    overflow: 'hidden',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  langList: {
    maxHeight: '220px',
    overflowY: 'auto',
  },
  langItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    cursor: 'pointer',
    transition: 'background var(--transition)',
  },
  langItemSelected: {
    background: 'var(--accent-primary-dim)',
  },
  langItemName: {
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    fontWeight: '500',
  },
  langItemNative: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  noResults: {
    padding: '16px 14px',
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
  // Inputs
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 44px 12px 14px',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    transition: 'border-color var(--transition), box-shadow var(--transition)',
    fontFamily: 'inherit',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '4px',
    borderRadius: '4px',
    transition: 'color var(--transition)',
  },
  // Buttons
  primaryBtn: {
    width: '100%',
    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: '13px 20px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity var(--transition), transform var(--transition)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    letterSpacing: '0.01em',
  },
  btnDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  detectBtn: {
    width: '100%',
    background: 'var(--bg-elevated)',
    color: 'var(--accent-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '11px 20px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'border-color var(--transition), box-shadow var(--transition)',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '0',
    marginBottom: '-4px',
    transition: 'color var(--transition)',
  },
  // Provider section
  providerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px',
    background: 'var(--bg-base)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
  },
  providerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  providerDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--success)',
    boxShadow: '0 0 8px var(--success)',
    flexShrink: 0,
  },
  providerDotAmbiguous: {
    background: '#f59e0b',
    boxShadow: '0 0 8px rgba(245,158,11,0.5)',
  },
  providerChoiceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  providerChoiceCard: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '14px 14px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '5px',
    textAlign: 'left',
    transition: 'border-color var(--transition), background var(--transition)',
    fontFamily: 'inherit',
  },
  providerChoiceCardSelected: {
    borderColor: 'var(--accent-primary)',
    background: 'var(--accent-primary-dim)',
    boxShadow: '0 0 0 3px var(--accent-primary-dim)',
  },
  providerChoiceName: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  providerChoiceHint: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontFamily: "'SF Mono', 'Cascadia Code', monospace",
    lineHeight: 1.5,
  },
  providerLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--success)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  selectModelLabel: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  selectWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  modelSelect: {
    width: '100%',
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '11px 40px 11px 14px',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    fontFamily: "'SF Mono', 'Cascadia Code', monospace",
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  },
  modelGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  modelCard: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color var(--transition), background var(--transition)',
    display: 'flex',
    alignItems: 'center',
  },
  modelCardSelected: {
    borderColor: 'var(--accent-primary)',
    background: 'var(--accent-primary-dim)',
  },
  modelName: {
    fontSize: '0.85rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
    fontFamily: '\'SF Mono\', \'Cascadia Code\', monospace',
  },
  getStartedBtn: {
    marginTop: '4px',
  },
  footer: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    lineHeight: '1.6',
  },
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transition: 'transform 150ms ease', transform: open ? 'rotate(180deg)' : 'none' }}>
      <path d="M4 6l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SelectChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ position: 'absolute', right: '13px', pointerEvents: 'none', flexShrink: 0 }}>
      <path d="M3 5l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5" stroke="var(--text-muted)" strokeWidth="1.5" />
      <path d="M10.5 10.5l3 3" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 2l12 12M6.5 6.5A2 2 0 009.5 9.5M4.5 4.5C2.8 5.6 1.5 7.5 1.5 8s2.5 5 6.5 5a7.3 7.3 0 003.5-.9M6.5 3.1A7 7 0 0114.5 8c-.4.9-1 1.8-1.7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M3 7.5h9M8.5 3.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M1 4V2a1 1 0 011-1h2M11 1h2a1 1 0 011 1v2M14 11v2a1 1 0 01-1 1h-2M4 14H2a1 1 0 01-1-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1 7.5h13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  )
}
