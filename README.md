# 猜數字炸彈

2–8 人的瀏覽器遊戲。系統從 1～100 選出炸彈數字。大家輪流猜，猜小了就提高下限，猜大了就降低上限。猜中炸彈的人輸。

## 開始玩

- **同機輪流**。用瀏覽器開啟 `index.html`，選「同機輪流」，輸入每位玩家的暱稱後開始。
- **線上連線**。房主選「建立房間」，將房間碼或邀請連結交給朋友。朋友輸入暱稱和房間碼，按「加入」。到齊後房主按「開始遊戲」。
- 每局結束後可選「再玩一局」。開局玩家會依序輪替。

## 發布到 GitHub Pages

1. 將此資料夾內的檔案上傳到 GitHub 儲存庫根目錄，保留原檔名與相對位置。
2. 在儲存庫開啟 **Settings → Pages**，將 **Source** 設為 **Deploy from a branch**。
3. 選擇存放檔案的分支（例如 `main`）及 **/ (root)**，按 **Save**。
4. 部署完成後，開啟 Pages 顯示的 HTTPS 網址。

遊戲頁面使用 HTML、CSS 和 JavaScript。線上模式透過 PeerJS Cloud 配對，再使用 WebRTC 同步遊戲。房主需保持網頁開啟。部分公司、校園或 VPN 網路可能限制點對點連線，可換網路或使用同機輪流。

[GitHub Pages 設定文件](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [PeerJS 連線說明](https://peerjs.com/client/faq)

## 測試規則

在此資料夾執行 `node --test tests/game.test.cjs`。
