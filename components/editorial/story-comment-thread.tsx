"use client";

import { useState } from "react";
import { Flag, MessageSquare } from "lucide-react";

import type { ArticleComment } from "@/lib/articles/types";
import { Button } from "@/components/ui/button";

function timeAgo(dateString: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function CommentItem({
  comment,
  onReport,
}: {
  comment: ArticleComment;
  onReport: (id: string) => void;
}) {
  if (comment.status === "hidden") {
    return (
      <div className="py-3 text-sm italic text-muted-foreground">
        This comment has been removed.
      </div>
    );
  }

  return (
    <div className="space-y-1 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{comment.isOwn ? "You" : "Reader"}</span>
        <span>·</span>
        <span>{timeAgo(comment.createdAt)}</span>
        {!comment.isOwn && !comment.reportedByViewer ? (
          <button
            type="button"
            onClick={() => onReport(comment.id)}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Report comment"
          >
            <Flag className="size-3" />
            Report
          </button>
        ) : null}
        {comment.reportedByViewer ? (
          <span className="ml-auto text-xs text-muted-foreground">
            Reported
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed">{comment.body}</p>
    </div>
  );
}

type StoryCommentThreadProps = {
  storyKey: string;
  isAuthenticated: boolean;
  initialComments: ArticleComment[];
};

export function StoryCommentThread({
  storyKey,
  isAuthenticated,
  initialComments,
}: StoryCommentThreadProps) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState(false);
  const activeComments = comments.filter((c) => c.status === "active");
  const visibleComments = expanded ? comments : comments.slice(0, 3);
  const hasMore = activeComments.length > 3;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/stories/${storyKey}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to post comment.");
        return;
      }

      setComments((prev) => [...prev, data.comment]);
      setBody("");
    } catch {
      setError("Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReport(commentId: string) {
    const reason = "Inappropriate content";

    try {
      const res = await fetch(`/api/comments/${commentId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (res.ok || res.status === 409) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, reportedByViewer: true } : c,
          ),
        );
      }
    } catch {
      // silently fail
    }
  }

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h2 className="flex items-center gap-2 font-display text-lg">
        <MessageSquare className="size-5" />
        Comments
        {activeComments.length > 0 ? (
          <span className="text-sm font-normal text-muted-foreground">
            ({activeComments.length})
          </span>
        ) : null}
      </h2>

      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            maxLength={2000}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
            {submitting ? "Posting..." : "Post comment"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sign in to join the conversation.
        </p>
      )}

      {visibleComments.length > 0 ? (
        <div className="divide-y divide-border">
          {visibleComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReport={handleReport}
            />
          ))}
        </div>
      ) : null}

      {hasMore && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Show all {activeComments.length} comments
        </button>
      ) : null}
    </section>
  );
}
