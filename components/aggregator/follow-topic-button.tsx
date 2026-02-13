'use client'

import {useState} from 'react'

import {Button} from '@/components/ui/button'

type FollowTopicButtonProps = {
  topicId: string
  initialFollowed: boolean
  isAuthenticated: boolean
  className?: string
}

export function FollowTopicButton({topicId, initialFollowed, isAuthenticated, className}: FollowTopicButtonProps) {
  const [isFollowed, setIsFollowed] = useState(initialFollowed)
  const [isPending, setIsPending] = useState(false)

  if (!isAuthenticated) {
    return null
  }
  const label = isPending ? 'Saving…' : isFollowed ? 'Following' : 'Follow'

  async function toggleFollow() {
    if (isPending) {
      return
    }

    setIsPending(true)

    try {
      const response = await fetch('/api/me/topics', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: isFollowed ? 'unfollow' : 'follow',
          topicId,
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to update follow state.')
      }

      const payload = (await response.json()) as {
        data?: Array<{id: string}>
      }

      const nextFollowedState = Boolean(payload.data?.some((topic) => topic.id === topicId))
      setIsFollowed(nextFollowedState)
    } catch {
      // Keep the previous local state when the request fails.
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant={isFollowed ? 'secondary' : 'outline'}
      size="sm"
      className={className}
      disabled={isPending}
      onClick={toggleFollow}
    >
      {label}
    </Button>
  )
}
