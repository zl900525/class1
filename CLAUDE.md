# CLAUDE.md

這是一個不用登入的匿名網頁聊天室，前端放在 GitHub Pages，即時傳訊使用 Supabase。

## 開始工作前
- 開始任何工作前，先讀 `docs/architecture.md`。需求原文在 `docs/requirements.md`。
- 做畫面相關的工作前，也要讀 `docs/design.md`（顏色、字體、元件外觀）。

## 目前進度
- 目前在**階段二**：已接上 Supabase（`SupabaseChatService`）。有設定 `.env.local` 時預設使用 Supabase 版；網址加上 `?local=1` 可改用本機版測試畫面，不會弄髒正式資料。
- 資料庫設定在 `supabase/migrations/`，要由使用者貼到 Supabase 後台的 SQL Editor 執行（不使用 Supabase CLI）。
- 畫面元件只能透過 `src/state/` 取得資料，不可以直接使用 `src/chat/local` 或 `src/chat/supabase`（見架構文件 4.1、11 節）。

## 金鑰
- 不可以把金鑰檔案 commit 進 git：`.env`、`.env.local`、`.env.*`（`.env.example` 除外，它只放欄位名稱，不放真正的值）。
- Supabase 的 Secret key（`sb_secret_…`）和資料庫密碼，永遠不可以出現在 repo 的任何檔案裡。
- commit 前檢查 `git status`，確認沒有金鑰檔案被加入。
