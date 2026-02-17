'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {Headphones, Loader2, Pause, Play, SkipBack, SkipForward, X} from 'lucide-react'

import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'

export type AudioStory = {
  clusterKey: string
  headline: string
  text: string
}

type PlayerState = 'idle' | 'loading' | 'playing' | 'paused'

const PILL =
  'rounded-full border border-border/80 bg-background/80 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/65'

const SPEED_OPTIONS = [1, 1.25, 1.5, 2, 0.75] as const

type Voice = {id: string; label: string}
const VOICES: Voice[] = [
  {id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel'},
  {id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah'},
  {id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel'},
  {id: '5Q0t7uMcjvnagumLfvZi', label: 'Paul'},
]

export function StoryAudioPlayer({stories}: {stories: AudioStory[]}) {
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [state, setState] = useState<PlayerState>('idle')
  const [autoplay, setAutoplay] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(0)
  const [voiceIndex, setVoiceIndex] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobRef = useRef<string | null>(null)
  const autoplayRef = useRef(false)
  const speedRef = useRef<number>(SPEED_OPTIONS[0])

  useEffect(() => {
    autoplayRef.current = autoplay
  }, [autoplay])

  useEffect(() => {
    speedRef.current = SPEED_OPTIONS[speedIndex]
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEED_OPTIONS[speedIndex]
    }
  }, [speedIndex])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.onended = null
        audio.src = ''
      }
      if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    }
  }, [])

  function stop() {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.onended = null
      audio.src = ''
    }
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current)
      blobRef.current = null
    }
  }

  const play = useCallback(
    async (i: number, voice?: Voice) => {
      const story = stories[i]
      if (!story) return

      setIndex(i)
      setState('loading')
      stop()

      const selectedVoice = voice ?? VOICES[voiceIndex]

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({text: story.text, voiceId: selectedVoice.id}),
        })

        if (!res.ok) {
          setState('idle')
          return
        }

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        blobRef.current = url

        if (!audioRef.current) audioRef.current = new Audio()
        const audio = audioRef.current
        audio.src = url
        audio.playbackRate = speedRef.current
        audio.onended = () => {
          if (autoplayRef.current && i < stories.length - 1) {
            play(i + 1)
          } else {
            setState('idle')
          }
        }
        await audio.play()
        setState('playing')
      } catch {
        setState('idle')
      }
    },
    [stories, voiceIndex],
  )

  if (stories.length === 0) return null

  // --- Sticky listen button (bottom-right) ---
  if (!active) {
    return (
      <div className={cn('fixed bottom-4 right-3 z-50 p-1 md:right-5', PILL)}>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Listen to articles"
          onClick={() => {
            setActive(true)
            play(0)
          }}
        >
          <Headphones className="size-5" />
        </Button>
      </div>
    )
  }

  // --- Active player ---
  const story = stories[index]
  const isLoading = state === 'loading'
  const isPlaying = state === 'playing'
  const currentSpeed = SPEED_OPTIONS[speedIndex]
  const currentVoice = VOICES[voiceIndex]

  return (
    <>
      {/* Title label */}
      <div className="pointer-events-none fixed bottom-[4.25rem] left-1/2 z-50 -translate-x-1/2">
        <p
          className={cn(
            'max-w-xs truncate px-3 py-1 text-xs text-muted-foreground',
            PILL
          )}
        >
          {story?.headline}
        </p>
      </div>

      {/* Transport — bottom center */}
      <div className={cn('fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-1 p-1', PILL)}>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Previous article"
          disabled={index === 0 || isLoading}
          onClick={() => play(index - 1)}
        >
          <SkipBack className="size-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          disabled={isLoading}
          onClick={() => {
            if (isPlaying && audioRef.current) {
              audioRef.current.pause()
              setState('paused')
            } else if (state === 'paused' && audioRef.current) {
              audioRef.current.play()
              setState('playing')
            } else {
              play(index)
            }
          }}
        >
          {isLoading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Next article"
          disabled={index >= stories.length - 1 || isLoading}
          onClick={() => play(index + 1)}
        >
          <SkipForward className="size-5" />
        </Button>

        {/* Speed control */}
        <button
          type="button"
          className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Playback speed ${currentSpeed}x`}
          onClick={() => setSpeedIndex((prev) => (prev + 1) % SPEED_OPTIONS.length)}
        >
          {currentSpeed}x
        </button>

        {/* Voice control */}
        <button
          type="button"
          className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Voice: ${currentVoice.label}`}
          disabled={isLoading}
          onClick={() => {
            const nextIndex = (voiceIndex + 1) % VOICES.length
            setVoiceIndex(nextIndex)
            // Re-fetch with the new voice if currently playing or paused
            if (state === 'playing' || state === 'paused') {
              play(index, VOICES[nextIndex])
            }
          }}
        >
          {currentVoice.label}
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Close player"
          onClick={() => {
            setActive(false)
            setState('idle')
            stop()
          }}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Autoplay — bottom left */}
      <div className={cn('fixed bottom-4 left-3 z-50 flex items-center gap-2 px-3 py-1.5 md:left-5', PILL)}>
        <button
          type="button"
          role="switch"
          aria-checked={autoplay}
          onClick={() => setAutoplay((prev) => !prev)}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
            autoplay ? 'bg-primary' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform',
              autoplay ? 'translate-x-4' : 'translate-x-0'
            )}
          />
        </button>
        <span className="text-xs text-muted-foreground select-none">Autoplay</span>
      </div>
    </>
  )
}
