# CLAUDE.md

這是一個不用登入的匿名網頁聊天室，前端放在 GitHub Pages，即時傳訊使用 Supabase。

## 開始工作前
- 開始任何工作前，先讀 `docs/architecture.md`。需求原文在 `docs/requirements.md`。

## 目前進度
- 目前在**階段一**：只做前端，使用本機版聊天服務（`LocalChatService`），**還不接 Supabase**。
- 畫面元件只能透過 `src/state/` 取得資料，不可以直接使用 `src/chat/local` 或 `src/chat/supabase`（見架構文件 4.1、11 節）。

## 金鑰
- 不可以把金鑰檔案 commit 進 git：`.env`、`.env.local`、`.env.*`（`.env.example` 除外，它只放欄位名稱，不放真正的值）。
- Supabase 的 Secret key（`sb_secret_…`）和資料庫密碼，永遠不可以出現在 repo 的任何檔案裡。
- commit 前檢查 `git status`，確認沒有金鑰檔案被加入。
