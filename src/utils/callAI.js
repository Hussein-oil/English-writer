import axios from 'axios'

function classifyError(err) {
  const status = err.response?.status
  const data = err.response?.data
  if (status === 401) return 'Invalid API key. Please check your credentials in Settings.'
  if (status === 403) return 'Access denied. Your API key may not have permission for this model.'
  if (status === 429) return 'Rate limit reached. Please wait a moment and try again.'
  if (status === 400) {
    const msg = data?.error?.message || data?.message || ''
    return msg ? `Bad request: ${msg}` : 'Invalid request — check your model selection.'
  }
  if (status === 404) return 'Model not found. Verify the model name in your settings.'
  if (status >= 500) return 'The AI service returned a server error. Please try again.'
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return 'Request timed out — the model may be overloaded. Try again in a moment.'
  }
  if (err.message?.includes('Network Error')) {
    return 'Network error. Check your connection and that your API key allows browser requests.'
  }
  return data?.error?.message || err.message || 'An unexpected error occurred.'
}

// userMessages: [{ role: 'user'|'assistant', content: string }]
// systemPrompt: string (optional) — handled per-provider
export async function callAI({
  provider,
  apiKey,
  selectedModel,
  systemPrompt,
  userMessages,
  maxTokens = 4000,
}) {
  try {
    switch (provider) {
      case 'anthropic': {
        const body = { model: selectedModel, max_tokens: maxTokens, messages: userMessages }
        if (systemPrompt) body.system = systemPrompt
        const res = await axios.post('https://api.anthropic.com/v1/messages', body, {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          timeout: 90000,
        })
        return res.data.content[0].text
      }

      case 'openai': {
        const messages = systemPrompt
          ? [{ role: 'system', content: systemPrompt }, ...userMessages]
          : userMessages
        const res = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          { model: selectedModel, max_tokens: maxTokens, messages },
          {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 90000,
          }
        )
        return res.data.choices[0].message.content
      }

      case 'google': {
        const contents = userMessages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }))
        const body = { contents }
        if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] }
        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
          body,
          { headers: { 'Content-Type': 'application/json' }, timeout: 90000 }
        )
        return res.data.candidates[0].content.parts[0].text
      }

      case 'deepseek': {
        const messages = systemPrompt
          ? [{ role: 'system', content: systemPrompt }, ...userMessages]
          : userMessages
        const res = await axios.post(
          'https://api.deepseek.com/chat/completions',
          { model: selectedModel, max_tokens: maxTokens, messages },
          {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 90000,
          }
        )
        return res.data.choices[0].message.content
      }

      case 'groq': {
        const messages = systemPrompt
          ? [{ role: 'system', content: systemPrompt }, ...userMessages]
          : userMessages
        const res = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          { model: selectedModel, max_tokens: maxTokens, messages },
          {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 60000,
          }
        )
        return res.data.choices[0].message.content
      }

      case 'custom': {
        // OpenRouter-compatible — model IDs in the selector match OpenRouter's catalog
        const messages = systemPrompt
          ? [{ role: 'system', content: systemPrompt }, ...userMessages]
          : userMessages
        const res = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          { model: selectedModel, max_tokens: maxTokens, messages },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:5173',
              'X-Title': 'EN-Teacher',
            },
            timeout: 90000,
          }
        )
        return res.data.choices[0].message.content
      }

      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  } catch (err) {
    throw new Error(classifyError(err))
  }
}
