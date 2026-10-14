// 每天清理：刪掉 7 天前的舊訊息和它們的圖片，但最近 50 則一定保留（架構文件 3.2）
// 部署方式：在 Supabase 後台 Edge Functions 用網頁編輯器建立 cleanup，貼上這個檔案。
// 呼叫時必須帶 x-cleanup-secret 標頭，值要等於 Edge Function Secrets 裡的 CLEANUP_SECRET。

import { createClient } from 'npm:@supabase/supabase-js@2';

const KEEP_DAYS = 7;
const KEEP_LATEST = 50;
const BUCKET = 'chat-images';

function adminKey(): string {
  // 新版金鑰（sb_secret_…）優先，沒有的話用舊版 service_role
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    const first = Object.values(JSON.parse(secretKeys) as Record<string, string>)[0];
    if (first) return first;
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

Deno.serve(async (req) => {
  const expected = Deno.env.get('CLEANUP_SECRET');
  if (!expected || req.headers.get('x-cleanup-secret') !== expected) {
    return new Response('forbidden', { status: 403 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, adminKey(), {
    auth: { persistSession: false },
  });

  // 第 50 新的那則的時間：比它新的一律保留
  const { data: latest, error: latestError } = await supabase
    .from('messages')
    .select('created_at')
    .order('created_at', { ascending: false })
    .range(KEEP_LATEST - 1, KEEP_LATEST - 1);
  if (latestError) return Response.json({ error: latestError.message }, { status: 500 });
  if (!latest || latest.length === 0) return Response.json({ deleted: 0, files: 0 });

  const weekAgo = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const cutoff = latest[0].created_at < weekAgo ? latest[0].created_at : weekAgo;

  const { data: old, error: oldError } = await supabase
    .from('messages')
    .select('id, image_path, thumb_path')
    .lt('created_at', cutoff);
  if (oldError) return Response.json({ error: oldError.message }, { status: 500 });

  const paths = [...new Set(old.flatMap((m) => [m.image_path, m.thumb_path]).filter((p): p is string => !!p))];
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  }

  const { error: deleteError } = await supabase.from('messages').delete().lt('created_at', cutoff);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

  return Response.json({ deleted: old.length, files: paths.length });
});
