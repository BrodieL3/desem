"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ArticleCard } from "@/lib/articles/types";
import { cn } from "@/lib/utils";

const TOP_HIT_LIMIT = 6;
const QUERY_MIN_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 180;

const publishedFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

type ArticleListApiResponse = {
  data?: ArticleCard[];
};

function compactText(value: string, maxChars: number) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxChars) {
    return normalized;
  }

  const slice = normalized.slice(0, maxChars + 1);
  const breakIndex = slice.lastIndexOf(" ");
  const bounded =
    breakIndex > Math.floor(maxChars * 0.6)
      ? slice.slice(0, breakIndex)
      : slice.slice(0, maxChars);
  return `${bounded.trimEnd()}...`;
}

function formatTopHitDate(publishedAt: string | null, fetchedAt: string) {
  const parsed = new Date(publishedAt ?? fetchedAt);

  if (Number.isNaN(parsed.getTime())) {
    return publishedAt ?? fetchedAt;
  }

  return publishedFormatter.format(parsed);
}

function buildSearchHref(query: string) {
  const normalized = query.trim();

  if (!normalized) {
    return "/search";
  }

  const params = new URLSearchParams({ q: normalized });
  return `/search?${params.toString()}`;
}

function SearchTopHit({
  hit,
  onNavigate,
}: {
  hit: ArticleCard;
  onNavigate: () => void;
}) {
  const summary = compactText(hit.summary ?? hit.fullTextExcerpt ?? "", 120);

  return (
    <Link
      href={`/stories/article/${hit.id}`}
      onClick={onNavigate}
      className="news-divider-item news-divider-item-compact block px-3 py-2 transition-colors hover:bg-muted/65"
    >
      <p className="text-muted-foreground mb-1 text-[0.69rem] tracking-[0.12em] uppercase">
        {hit.sourceName} · {formatTopHitDate(hit.publishedAt, hit.fetchedAt)}
      </p>
      <p className="font-display text-[1.05rem] leading-tight text-foreground">
        {hit.title}
      </p>
      {summary ? (
        <p className="text-muted-foreground mt-1 text-sm leading-snug">
          {summary}
        </p>
      ) : null}
    </Link>
  );
}

export function SiteSearch({ className }: { className?: string }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [topHits, setTopHits] = useState<ArticleCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const trimmedQuery = query.trim();
  const shouldShowDropdown =
    isExpanded && trimmedQuery.length >= QUERY_MIN_LENGTH;

  const resetSearchState = useCallback(() => {
    setTopHits([]);
    setIsLoading(false);
    setError(null);
    setHasFetched(false);
  }, []);

  const collapseSearch = useCallback(() => {
    setIsExpanded(false);
    resetSearchState();
  }, [resetSearchState]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    inputRef.current?.focus();
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (containerRef.current?.contains(target)) {
        return;
      }

      collapseSearch();
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [collapseSearch, isExpanded]);

  useEffect(() => {
    if (!shouldShowDropdown) {
      resetSearchState();
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          q: trimmedQuery,
          limit: String(TOP_HIT_LIMIT),
        });
        const response = await fetch(`/api/articles?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load search results.");
        }

        const payload = (await response.json()) as ArticleListApiResponse;
        setTopHits(payload.data ?? []);
        setHasFetched(true);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setTopHits([]);
        setHasFetched(true);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load search results.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [resetSearchState, shouldShowDropdown, trimmedQuery]);

  function submitSearch() {
    router.push(buildSearchHref(trimmedQuery));
    collapseSearch();
  }

  function handleSearchButtonClick() {
    if (!isExpanded) {
      setIsExpanded(true);
      return;
    }

    submitSearch();
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative transition-[width] duration-200 ease-out",
        isExpanded ? "w-[min(26rem,calc(100vw-2.75rem))]" : "w-11",
        className,
      )}
    >
      <form
        className={cn(
          "flex h-11 items-center rounded-full transition-[background-color,border-color,box-shadow]",
          isExpanded
            ? "border border-transparent bg-background/95 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-2 focus-within:ring-offset-background"
            : "w-11 bg-transparent",
        )}
        onSubmit={(event) => {
          event.preventDefault();
          submitSearch();
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("rounded-full p-0", isExpanded ? "size-11" : "size-full")}
          aria-label={isExpanded ? "Search all articles" : "Open search"}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? dropdownId : undefined}
          onClick={handleSearchButtonClick}
        >
          <Search className="size-4" />
        </Button>

        {isExpanded ? (
          <>
            <label htmlFor="top-search-input" className="sr-only">
              Search articles
            </label>
            <input
              id="top-search-input"
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reporting, companies, topics..."
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/90 focus-visible:!outline-none"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  collapseSearch();
                }
              }}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Close search"
              onClick={collapseSearch}
            >
              <X className="size-4" />
            </Button>
          </>
        ) : null}
      </form>

      {shouldShowDropdown ? (
        <div
          id={dropdownId}
          className="absolute top-full right-0 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-background/98 text-foreground shadow-md backdrop-blur-sm"
        >
          {isLoading ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Searching...
            </p>
          ) : null}
          {error && !isLoading ? (
            <p className="px-3 py-3 text-sm text-destructive">{error}</p>
          ) : null}
          {!error && !isLoading && hasFetched && topHits.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No top hits yet.
            </p>
          ) : null}

          {!error && topHits.length > 0 ? (
            <div className="news-divider-list news-divider-list-no-top">
              {topHits.map((hit) => (
                <SearchTopHit
                  key={hit.id}
                  hit={hit}
                  onNavigate={collapseSearch}
                />
              ))}
            </div>
          ) : null}

          <div className="border-t border-border px-3 py-2">
            <Link
              href={buildSearchHref(trimmedQuery)}
              onClick={collapseSearch}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View full results
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
