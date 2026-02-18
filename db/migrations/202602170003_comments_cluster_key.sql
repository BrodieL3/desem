begin;

-- Comments are keyed by cluster (story), not by individual ingested article.
-- Change article_id from uuid (FK to ingested_articles) to text holding the cluster key.

alter table public.article_comments
  drop constraint article_comments_article_id_fkey;

alter table public.article_comments
  alter column article_id type text using article_id::text;

commit;
