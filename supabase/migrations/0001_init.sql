-- 匿名聊天室：資料庫設定（架構文件 5.4、9.1）
-- 用法：整段貼到 Supabase 後台的 SQL Editor，按 Run。只需要執行一次。

-- ============================================================
-- 代號整理：全形轉半形、拿掉看不見的字元、去掉頭尾空白
-- （跟前端 src/lib/nickname.ts 的規則一致）
-- ============================================================
create or replace function public.clean_nickname(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(normalize(raw, NFKC),
    '[\x01-\x1F\x7F-\x9F​-‏‪-‮⁠-⁤﻿]', '', 'g'))
$$;

create or replace function public.is_valid_nickname(raw text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(public.clean_nickname(raw)) between 1 and 12
     and lower(public.clean_nickname(raw)) not in ('系統', '管理員', 'admin')
$$;

-- ============================================================
-- 訊息
-- ============================================================
create table public.messages (
  id           uuid primary key,
  sender_id    uuid not null,
  nickname     text not null check (public.is_valid_nickname(nickname)),
  text         text not null default '' check (char_length(text) <= 500),
  image_path   text,
  thumb_path   text,
  image_width  int check (image_width > 0),
  image_height int check (image_height > 0),
  -- 不設外鍵：原訊息被清理掉之後，畫面要顯示「原訊息已無法顯示」，而不是整個引用區消失
  reply_to     uuid,
  created_at   timestamptz not null default now(),
  recalled_at  timestamptz,
  -- 沒收回的訊息，文字和圖片至少要有一個
  constraint has_content check (recalled_at is not null or btrim(text) <> '' or image_path is not null),
  constraint image_complete check ((image_path is null) = (thumb_path is null))
);

create index messages_created_at_idx on public.messages (created_at desc);

-- 寫入時由伺服器決定：送出者一律是自己、時間一律是現在、不能一寫入就是「已收回」
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sender_id := auth.uid();
  new.created_at := now();
  new.recalled_at := null;
  new.nickname := public.clean_nickname(new.nickname);
  return new;
end;
$$;

create trigger messages_before_insert
before insert on public.messages
for each row execute function public.messages_before_insert();

-- ============================================================
-- 表情回應
-- ============================================================
create table public.reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  nickname   text not null check (public.is_valid_nickname(nickname)),
  emoji      text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏')),
  created_at timestamptz not null default now(),
  -- 同一人、同一則訊息、同一個表情最多一筆
  primary key (message_id, user_id, emoji)
);

-- ============================================================
-- 權限規則（RLS）：網頁程式碼是公開的，真正的把關在這裡
-- ============================================================
alter table public.messages enable row level security;
alter table public.reactions enable row level security;

revoke all on public.messages, public.reactions from anon;
grant select, insert on public.messages to authenticated;
grant select, insert, delete on public.reactions to authenticated;

-- 有匿名身分的人都能讀
create policy "messages: read" on public.messages
  for select to authenticated using (true);

-- 只能用自己的身分寫入；圖片只能指向自己的資料夾
create policy "messages: insert own" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (image_path is null or image_path like (select auth.uid())::text || '/%')
    and (thumb_path is null or thumb_path like (select auth.uid())::text || '/%')
  );
-- 沒有 update、delete 規則 = 一律不准改、不准刪（收回只能透過下面的函式）

create policy "reactions: read" on public.reactions
  for select to authenticated using (true);

create policy "reactions: insert own" on public.reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.messages m where m.id = message_id and m.recalled_at is null)
  );

create policy "reactions: delete own" on public.reactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ============================================================
-- 收回：檢查是不是本人、有沒有超過 2 分鐘
-- 回傳 'ok'、'too_late' 或 'not_owner'
-- ============================================================
create or replace function public.recall_message(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.messages;
begin
  select * into m from public.messages where id = p_id for update;
  if not found or m.sender_id <> auth.uid() then
    return 'not_owner';
  end if;
  if m.recalled_at is not null then
    return 'ok';
  end if;
  if now() - m.created_at > interval '2 minutes' then
    return 'too_late';
  end if;

  delete from public.reactions where message_id = p_id;
  update public.messages
     set text = '', image_path = null, thumb_path = null,
         image_width = null, image_height = null, recalled_at = now()
   where id = p_id;
  return 'ok';
end;
$$;

revoke all on function public.recall_message(uuid) from public, anon;
grant execute on function public.recall_message(uuid) to authenticated;

-- ============================================================
-- 即時推送：這兩張表有變動就通知線上的人
-- ============================================================
alter publication supabase_realtime add table public.messages, public.reactions;

-- ============================================================
-- 圖片倉庫：公開讀取、單檔 5MB、只收 4 種圖片格式
-- 路徑是「匿名身分/訊息id.jpg」，只能上傳、刪除自己資料夾裡的檔案
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "chat-images: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-images');

create policy "chat-images: upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "chat-images: overwrite own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "chat-images: delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
