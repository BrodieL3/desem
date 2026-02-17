import {type NextRequest, NextResponse} from 'next/server'

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
const ALLOWED_VOICE_IDS = new Set([
  '21m00Tcm4TlvDq8ikWAM', // Rachel
  'EXAVITQu4vr4xnSDxMaL', // Sarah
  'onwK4e9ZLuTAKqWW03F9', // Daniel
  '5Q0t7uMcjvnagumLfvZi', // Paul
])
const MAX_CHARS = 5000

function truncateAtSentence(text: string, max: number) {
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const boundary = slice.search(/[.!?]\s[^.!?]*$/)
  return boundary > max * 0.5 ? slice.slice(0, boundary + 1) : slice
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY

  if (!apiKey) {
    return NextResponse.json({error: 'TTS not configured'}, {status: 500})
  }

  let text: string
  let voiceId: string = DEFAULT_VOICE_ID

  try {
    const body = await request.json()
    text = typeof body.text === 'string' ? body.text : ''
    if (typeof body.voiceId === 'string' && ALLOWED_VOICE_IDS.has(body.voiceId)) {
      voiceId = body.voiceId
    }
  } catch {
    return NextResponse.json({error: 'Invalid request'}, {status: 400})
  }

  if (!text.trim()) {
    return NextResponse.json({error: 'No text provided'}, {status: 400})
  }

  const truncated = truncateAtSentence(text.trim(), MAX_CHARS)

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: truncated,
      model_id: 'eleven_multilingual_v2',
    }),
  })

  if (!response.ok) {
    return NextResponse.json({error: `TTS error ${response.status}`}, {status: response.status})
  }

  const audioBuffer = await response.arrayBuffer()

  return new Response(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
