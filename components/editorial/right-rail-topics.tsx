"use client";

import { useState } from "react";
import Link from "next/link";

import { FollowTopicButton } from "@/components/aggregator/follow-topic-button";
import type { CuratedHomeForYouTopic } from "@/lib/editorial/ui-types";
import { SectionLabel } from "@/components/editorial/section-label";
import { Button } from "@/components/ui/button";

type RightRailTopicsProps = {
  topics: CuratedHomeForYouTopic[];
  title?: string;
  headingId?: string;
  maxTopics?: number;
  collapsedMax?: number;
  showFollowActions?: boolean;
  isAuthenticated?: boolean;
  manageHref?: string;
  manageLabel?: string;
  emptyMessage?: string;
};

export function RightRailTopics({
  topics,
  title = "Topics",
  headingId = "right-rail-topics-heading",
  maxTopics = 6,
  collapsedMax,
  showFollowActions = false,
  isAuthenticated = false,
  manageHref = "/topics",
  manageLabel = "Manage topics",
  emptyMessage = "No topics yet.",
}: RightRailTopicsProps) {
  const boundedLimit = Number.isFinite(maxTopics)
    ? Math.max(1, Math.floor(maxTopics))
    : 6;
  const allTopics = topics.slice(0, boundedLimit);
  const canCollapse =
    typeof collapsedMax === "number" && allTopics.length > collapsedMax;
  const [expanded, setExpanded] = useState(false);
  const visibleTopics =
    canCollapse && !expanded ? allTopics.slice(0, collapsedMax) : allTopics;

  if (visibleTopics.length === 0 && !manageHref) {
    return null;
  }

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <SectionLabel id={headingId}>{title}</SectionLabel>

      {showFollowActions && !isAuthenticated ? (
        <p className="text-muted-foreground text-sm">
          <Link
            href="/auth/sign-in?next=/topics"
            className="underline-offset-2 hover:underline"
          >
            Sign in
          </Link>{" "}
          to follow topics.
        </p>
      ) : null}

      {visibleTopics.length === 0 ? (
        <p className=" news-divider-list-no-top news-divider-item px-1 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="news-divider-list-no-top">
          {visibleTopics.map((topic) => (
            <div
              key={topic.id}
              className="news-divider-item news-divider-item-compact flex min-h-11 items-center justify-between gap-2 px-1"
            >
              <div className="min-w-0">
                <Link
                  href={`/topics/${topic.slug}`}
                  className="text-sm font-medium hover:text-primary"
                >
                  {topic.label}
                </Link>
                <p className="text-muted-foreground text-xs">
                  {topic.articleCount} stories
                </p>
              </div>

              {showFollowActions ? (
                <FollowTopicButton
                  topicId={topic.id}
                  initialFollowed={topic.followed}
                  isAuthenticated={isAuthenticated}
                  className="h-11 px-3 text-xs"
                />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-muted-foreground hover:text-foreground px-1 text-xs transition-colors"
        >
          {expanded ? "Show fewer" : `Show more`}
        </button>
      ) : null}

      {manageHref ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-h-11 px-1 text-xs"
        >
          <Link href={manageHref}>{manageLabel}</Link>
        </Button>
      ) : null}
    </section>
  );
}
