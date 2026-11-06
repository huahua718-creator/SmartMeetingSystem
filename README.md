# 智慧學校會議紀錄自動化系統 (Smart School Meeting Minutes System)

> **專為各級學校打造的零額外費用、高相容性、端到端 AI 會議紀錄自動化解決方案。**  
> **架構：Vercel PWA 前端 (全球 CDN、免安裝、現代化體驗) + 去中心化個人 Google Apps Script 後端 (BYOK、文件排版、雲端儲存)**

---

## 🌟 系統特色

1. **Vercel + GAS 雙強架構**：
   * **前端託管於 Vercel**：提供自訂網域、極速 CDN、PWA 手機桌面安裝、全螢幕收音與相機體驗。
   * **後端運行於 Google Apps Script**：零伺服器維運費用、去中心化隱私防護，使用者使用自己 Google 雲端與 Gemini API Key（BYOK）。
2. **雙模並行不中斷**：手機透過 HTML5 Canvas 拍照上傳雲端，**不觸發原生相機 App**，背景錄音傳輸 100% 不暫停。
3. **無縫 QR Code 連線綁定**：打開 Google Docs 側邊欄點選「產生手機連線 QR Code」，手機相機一掃自動綁定當前會議後端！
4. **自動查詢最新 Gemini 模型**：內建版本動態探索，優先查詢並啟用 Google 最新 Flash 模型，並以 `gemini-3.6-flash` 作為高可用備援。
5. **多模態圖文整合**：自動抓取雲端最新會議照片，縮放排版（220px）入 Google Docs，並由 Gemini 自動辨識生成照片圖說。
6. **動態標籤識別 (`{{標籤}}`)**：學校可自由修改會議表格格式，AI 動態掃描並一對一填入，不需改動任何後端程式。

---

## 📂 專案架構與檔案清單

```text
SmartMeetingSystem/
├── api/
│   └── proxy.js           # Vercel Serverless Proxy (解決瀏覽器端 CORS 與 302 轉址限制)
├── index.html             # Vercel 前端主要入口 (PWA 會議收音與無縫拍照介面)
├── vercel.json            # Vercel 部署設定檔
├── package.json           # 專案套件與元資料清單
├── manifest.json          # PWA 應用程式清單 (支援加入手機主畫面)
├── icon.svg               # 高解析度 PWA 向量圖示
├── Code.gs                # Google Apps Script 核心後端邏輯
├── TagSidebar.html        # Google Docs 內嵌側邊欄 (標籤工具箱 & QR Code 產生器)
├── Mobile.html            # GAS 原生備用手機 Web App
├── appsscript.json        # GAS 專案資訊清單 (OAuth 權限範圍)
├── Template_Example.md    # 學校標準四欄式表格範本與動態標籤配置
└── deploy_guide.html      # 本地視覺化部署助手
```

---

## 🚀 部署指南 (Deployment Guide)

### 第一部分：部署前端至 Vercel (只需部署一次，大家均可共用)

1. 前往 [Vercel 官網](https://vercel.com/) 並以 GitHub 帳號登入。
2. 點選 **「Add New」** > **「Project」**。
3. 選擇並匯入本 GitHub 專案：**`SmartMeetingSystem`**。
4. 設定保持預設（Framework Preset 選擇 `Other`），點選 **「Deploy」**。
5. 部署完成後即可獲得專屬公開網址（例如：`https://smart-meeting-system.vercel.app`）。

---

### 第二部分：各使用者設定 Google Docs 與 GAS 後端

#### 步驟 1：取得免費 Gemini API Key
* 前往 [Google AI Studio](https://aistudio.google.com/) 登入 Google 帳號，點選「Get API key」並複製（格式如 `AIzaSy...`）。

#### 步驟 2：在 Google Drive 建立專用資料夾
* 建立 `會議照片專區`（取得資料夾 ID，例如 `1a2b3c...`）。
* 建立 `會議範本庫`（取得資料夾 ID，例如 `4d5e6f...`）。

#### 步驟 3：建立 Google Docs 並設定 Apps Script
1. 新建一份 Google Docs 文件（例如：`113學年度第1學期行政會報`）。
2. 點選選單 **「擴充功能」** > **「Apps Script」**。
3. 貼上專案內的 **`Code.gs`**，並填寫頂部設定：
   ```javascript
   const CONFIG = {
     GEMINI_API_KEY: "AIzaSy...",          // 使用者自己的 Gemini API Key
     PHOTO_FOLDER_ID: "1a2b3c...",         // Google Drive 照片資料夾 ID
     TEMPLATE_FOLDER_ID: "4d5e6f...",      // 範本庫資料夾 ID
     DOC_ID: "",                           // 留空即可自動抓取當前文件
     BACKUP_MODEL: "gemini-3.6-flash",     // 備援模型
     GEMINI_MODEL: "AUTO",                 // 自動查詢最新 Flash 版本
     VERCEL_APP_URL: "https://your-app.vercel.app", // 您的 Vercel 前端網址
     PHOTO_DISPLAY_WIDTH: 220
   };
   ```
4. 點選左側 **「+」** > **「HTML」** 新增：
   * 檔名 **`TagSidebar`** 貼上 `TagSidebar.html` 內容。
   * 檔名 **`Mobile`** 貼上 `Mobile.html` 內容。
5. 齒輪 ⚙️「專案設定」勾選顯示資訊清單，貼上 **`appsscript.json`** 內容。
6. 點擊右上角 **「部署」** > **「新增部署作業」** > **「網路應用程式」**：
   * 執行身分：**我 (Me)**
   * 誰可以存取：**任何人 (Anyone)**
   * 點選部署並完成 Google 帳號授權，取得 GAS Web App URL。

---

## 📱 會議操作三步驟 (Usage Flow)

1. **會前準備 (電腦端)**：
   * 開啟 Google Docs，點選選單「✨ AI 會議助手」>「📋 1. 載入學校標準空白表格」。
   * 點選「🏷️ 2. 開啟標籤工具箱」，點擊 **「📱 顯示手機連線 QR Code」**。
2. **會議進行 (手機端)**：
   * 拿出手機相機掃描 Google Docs 畫面上的 QR Code，手機將自動開啟 Vercel Web App 並綁定該場會議！
   * 點選「▶ 開始會議錄音收音」，手機置於會議桌中央（螢幕常亮防休眠）。
   * 需要拍照時點選「📸 拍攝照片並上傳」，相機畫面經 Canvas 壓縮後直接同步至 Google Drive（**錄音不中斷**）。
   * 每 5 分鐘自動產出 AI 段落摘要；電腦端點選「✂️ 手動切分段落」時，手機 3 秒內自動切分。
3. **散會排版 (電腦端)**：
   * 手機端點選「⏹ 結束會議」。
   * 電腦端點選「✨ AI 會議助手」>「⚡ 4. 一鍵自動排版與插入照片」。
   * Gemini 自動動態掃描所有 `{{標籤}}`（主席致詞、各處室報告、決議、待辦清單），自動等比例縮放插入最新照片並生成圖說！

---

## 📄 開源授權

本專案採用 [MIT 授權條款](LICENSE)。歡迎各級教育機構與學術單位自由部署與二次開發。
