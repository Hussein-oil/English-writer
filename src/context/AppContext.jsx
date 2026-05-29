import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext(null)

const STORAGE_KEY = 'en_teacher_config'

// sk- prefix is shared by OpenAI and DeepSeek — preserve whatever is stored for those
const SK_COMPATIBLE = new Set(['openai', 'deepseek'])

function inferProvider(key, storedProvider) {
  if (key.startsWith('sk-ant-')) return 'anthropic'
  if (key.startsWith('gsk_')) return 'groq'
  if (key.startsWith('AIza')) return 'google'
  if (key.startsWith('sk-')) {
    return SK_COMPATIBLE.has(storedProvider) ? storedProvider : 'openai'
  }
  return 'custom'
}

export function AppProvider({ children }) {
  const [nativeLanguage, setNativeLanguage] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [transcriptMinutes, setTranscriptMinutes] = useState([])
  const [analysisResult, setAnalysisResult] = useState(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        let { nativeLanguage: lang, apiKey: key, provider: prov, selectedModel: model } = data

        // Auto-correct provider if the stored value doesn't match the key prefix
        if (key && prov) {
          const correct = inferProvider(key, prov)
          if (correct !== 'custom' && correct !== prov) {
            prov = correct
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, provider: prov }))
          }
        }

        if (lang) setNativeLanguage(lang)
        if (key) setApiKey(key)
        if (prov) setProvider(prov)
        if (model) setSelectedModel(model)
      }
    } catch {
      // ignore corrupt storage
    }
  }, [])

  function saveConfig(updates) {
    const current = { nativeLanguage, apiKey, provider, selectedModel }
    const merged = { ...current, ...updates }
    if (updates.nativeLanguage !== undefined) setNativeLanguage(updates.nativeLanguage)
    if (updates.apiKey !== undefined) setApiKey(updates.apiKey)
    if (updates.provider !== undefined) setProvider(updates.provider)
    if (updates.selectedModel !== undefined) setSelectedModel(updates.selectedModel)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    } catch {
      // ignore storage errors
    }
  }

  function clearConfig() {
    setNativeLanguage('')
    setApiKey('')
    setProvider('')
    setSelectedModel('')
    localStorage.removeItem(STORAGE_KEY)
  }

  const isConfigured = !!(nativeLanguage && apiKey && provider && selectedModel)

  return (
    <AppContext.Provider value={{
      nativeLanguage, apiKey, provider, selectedModel,
      sourceText, setSourceText,
      transcriptMinutes, setTranscriptMinutes,
      analysisResult, setAnalysisResult,
      saveConfig, clearConfig, isConfigured,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
