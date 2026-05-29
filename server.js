import express from 'express'
import cors from 'cors'
import { YoutubeTranscript } from 'youtube-transcript'

const app = express()
const PORT = 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function groupByMinute(segments) {
  const map = new Map()

  for (const seg of segments) {
    const offsetMs = seg.offset   // package returns milliseconds
    const minuteNum = Math.floor(offsetMs / 60000) + 1

    if (!map.has(minuteNum)) {
      map.set(minuteNum, { minute: minuteNum, startMs: (minuteNum - 1) * 60000, segs: [] })
    }
    map.get(minuteNum).segs.push({ text: seg.text, offset: offsetMs })
  }

  return Array.from(map.values()).map(m => ({
    minute: m.minute,
    timeLabel: `${formatTime(m.startMs)} - ${formatTime(m.startMs + 60000)}`,
    text: m.segs.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim(),
    segments: m.segs,
  }))
}

async function getTranscript(videoId) {
  const langPriority = ['en', 'en-US', 'en-GB']
  let segments = null
  let lang = null
  let warning = null

  for (const code of langPriority) {
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: code })
      lang = code
      break
    } catch {
      // try next
    }
  }

  if (!segments) {
    segments = await YoutubeTranscript.fetchTranscript(videoId)
    lang = 'auto'
    warning = 'English transcript not available'
  }

  const minutes = groupByMinute(segments)
  const fullText = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim()
  return { minutes, fullText, lang, warning }
}

app.get('/api/transcript', async (req, res) => {
  const { videoId } = req.query

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ success: false, error: 'Invalid or missing videoId.' })
  }

  try {
    const { minutes, fullText, lang, warning } = await getTranscript(videoId)
    if (!fullText) {
      return res.status(404).json({ success: false, error: 'No transcript available for this video.' })
    }
    res.json({ success: true, text: fullText, fullText, minutes, lang, warning: warning || null })
  } catch (err) {
    const msg = err.message || ''
    let error
    if (msg.includes('disabled') || msg.includes('No transcripts')) {
      error = 'Transcripts are disabled for this video.'
    } else if (msg.includes('private') || msg.includes('unavailable')) {
      error = 'This video is private or unavailable.'
    } else if (msg.includes('Could not find')) {
      error = 'No transcript found. The video may not have captions.'
    } else {
      error = 'Failed to fetch transcript. The video may be private, age-restricted, or have no captions.'
    }
    res.status(500).json({ success: false, error })
  }
})

const server = app.listen(PORT, () => {
  console.log(`Transcript proxy running on http://localhost:${PORT}`)
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Kill the process using it and retry.`)
  } else {
    console.error('Server error:', err.message)
  }
  process.exit(1)
})
