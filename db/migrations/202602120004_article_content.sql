begin;

alter table public.ingested_articles
  add column if not exists full_text text,
  add column if not exists full_text_excerpt text,
  add column if not exists lead_image_url text,
  add column if not exists canonical_image_url text,
  add column if not exists content_fetch_status text not null default 'pending',
  add column if not exists content_fetch_error text,
  add column if not exists content_fetched_at timestamptz,
  add column if not exists word_count integer not null default 0,
  add column if not exists reading_minutes integer not null default 0,
  add column if not exists search_document tsvector;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ingested_articles_content_fetch_status_check'
  ) then
    alter table public.ingested_articles
      add constraint ingested_articles_content_fetch_status_check
      check (content_fetch_status in ('pending', 'fetched', 'failed'));
  end if;
end;
$$;

create index if not exists ingested_articles_search_document_gin_idx
  on public.ingested_articles
  using gin (search_document);

create or replace function public.ingested_articles_set_search_document()
returns trigger
language plpgsql
as $$
begin
  new.search_document := to_tsvector(
    'english',
    trim(
      both from concat_ws(
        ' ',
        coalesce(new.title, ''),
        coalesce(new.summary, ''),
        coalesce(new.full_text, '')
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists ingested_articles_set_search_document on public.ingested_articles;
create trigger ingested_articles_set_search_document
before insert or update of title, summary, full_text
on public.ingested_articles
for each row
execute function public.ingested_articles_set_search_document();

update public.ingested_articles
set search_document = to_tsvector(
  'english',
  trim(
    both from concat_ws(
      ' ',
      coalesce(title, ''),
      coalesce(summary, ''),
      coalesce(full_text, '')
    )
  )
)
where search_document is null;

commit;
