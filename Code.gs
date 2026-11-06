/**
 * ==============================================================================
 * 智慧學校會議紀錄自動化系統 (Smart School Meeting Minutes System)
 * 後端控制核心模組 (Code.gs)
 * ==============================================================================
 */

// ==============================================================================
// 1. 系統組態設定 (請在此填寫您的金鑰與雲端資料夾 ID)
// ==============================================================================
const CONFIG = {
  // Google AI Studio 申請之 Gemini API Key (可在此直接填寫，或透過指令碼屬性設定)
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE",
  
  // Google Drive 會議照片暫存資料夾 ID
  PHOTO_FOLDER_ID: "YOUR_PHOTO_FOLDER_ID_HERE",
  
  // Google Drive 會議範本庫資料夾 ID
  TEMPLATE_FOLDER_ID: "YOUR_TEMPLATE_FOLDER_ID_HERE",
  
  // 欲搭配的 Google Docs 文件 ID (若為空字串，將自動抓取當前綁定的文件)
  DOC_ID: "",
  
  // 備援預設模型 (當自動查詢最新版本失敗或連線異常時使用)
  BACKUP_MODEL: "gemini-3.6-flash",
  
  // 模型運作模式 ("AUTO" 代表自動向 API 查詢最新 Flash 版本；亦可填寫指定模型名稱進行鎖定)
  GEMINI_MODEL: "AUTO",
  
  // 部署於 Vercel 的前端公開網址 (供產生手機掃描 QR Code 連線使用)
  VERCEL_APP_URL: "https://smart-meeting-system.vercel.app",
  
  // 預設照片插入寬度 (px)
  PHOTO_DISPLAY_WIDTH: 220
};

// 學校固定辭典與背景脈絡 (大幅強化語音辨識與專有名詞歸納之正確性)
const SCHOOL_CONTEXT = `
【學校組織架構與處室】
- 校長室：校長、秘書
- 教務處：教務主任、教學組、註冊組、設備組、資訊組
- 學務處：學務主任、訓育組、生教組、體育組、衛生組
- 總務處：總務主任、庶務組、出納組、文書組
- 輔導室：輔導主任、輔導組、資料組、特教組
- 圖書館：圖書館主任、讀者服務組、技術服務組
- 其他單位：幼兒園主任、人事室主任、主計室主任、家長會會長、教師會會長

【常用學校行政與教育詞彙】
- 課綱、素養導向、雙語教學、數位學習、生生用平板、校訂課程
- 段考、定期評量、科展、校慶、畢業典禮、親職教育日、家長代表大會
- 防災演練、校園安全、學生輔導管教、IEP個別化教育計畫、特殊教育推行委員會
- 校務會議、行政會報、主管會報、課審會、性平會、資通安全會議、採購招標
`;

// ==============================================================================
// 2. Google Docs 介面與選單整合 (Menu & Triggers)
// ==============================================================================

/**
 * 文件開啟時自動建立「✨ AI 會議助手」頂部選單
 */
function onOpen() {
  const ui = DocumentApp.getUi();
  ui.createMenu('✨ AI 會議助手')
    .addItem('📋 1. 載入學校標準空白表格', 'insertStandardTable')
    .addItem('🏷️ 2. 開啟標籤工具箱 (側邊欄)', 'openTagSidebar')
    .addItem('✂️ 3. 手動切分段落 (通知手機端)', 'triggerManualSplit')
    .addSeparator()
    .addItem('⚡ 4. 一鍵自動排版與插入照片', 'generateFinalMinutesDynamic')
    .addSeparator()
    .addItem('💾 5. 儲存當前格式為範本', 'saveAsTemplate')
    .addItem('📂 6. 載入自訂會議範本', 'showTemplatePicker')
    .addSeparator()
    .addItem('🔄 7. 檢查與更新最新 Gemini 模型', 'checkAndUpdateGeminiModel')
    .addItem('⚙️ 8. 系統組態與狀態檢查', 'showSystemStatus')
    .addToUi();
}

/**
 * 開啟側邊欄 (標籤工具箱)
 */
function openTagSidebar() {
  const html = HtmlService.createTemplateFromFile('TagSidebar')
    .evaluate()
    .setTitle('AI 會議標籤工具箱')
    .setWidth(320);
  DocumentApp.getUi().showSidebar(html);
}

/**
 * 取得當前操作的 Document 實例
 */
function getTargetDocument() {
  const customDocId = getSetting('DOC_ID');
  if (customDocId && customDocId.trim() !== "" && customDocId !== "YOUR_DOC_ID_HERE") {
    return DocumentApp.openById(customDocId.trim());
  }
  return DocumentApp.getActiveDocument();
}

/**
 * 讀取設定值 (優先讀取 Script Properties，若無則回退至 CONFIG 常數)
 */
function getSetting(key) {
  const scriptProps = PropertiesService.getScriptProperties().getProperty(key);
  if (scriptProps && scriptProps.trim() !== "") {
    return scriptProps.trim();
  }
  return CONFIG[key] || "";
}

// ==============================================================================
// 3. 學校標準表格與標籤注入 (Table & Tag Insertion)
// ==============================================================================

/**
 * 於游標處或文末插入「學校標準四欄式會議記錄表格」
 */
function insertStandardTable() {
  const doc = getTargetDocument();
  const body = doc.getBody();
  
  // 插入會議標頭基本資訊
  const title = body.appendParagraph('臺北市/新北市/各級學校 113學年度第1學期 行政會報紀錄');
  title.setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  
  const metaTable = body.appendTable([
    ['會議名稱', '113學年度第1學期第 1 次行政會報', '會議時間', '113年   月   日(星期  ) 上午 09:00'],
    ['會議地點', '本校第一會議室', '主席', '校長 {{主席姓名}}'],
    ['紀錄人員', '文書組長 {{紀錄姓名}}', '出席人員', '詳如簽到表（全體行政主管）']
  ]);
  metaTable.setBorderWidth(1).setBorderColor('#cbd5e1');
  
  body.appendParagraph('').setSpacingAfter(6);
  
  // 插入標準四欄式內容表格 (含動態標籤)
  const contentTable = body.appendTable();
  contentTable.setBorderWidth(1).setBorderColor('#94a3b8');
  
  // 表頭
  const headerRow = contentTable.appendTableRow();
  headerRow.appendTableCell('項次').setWidth(50);
  headerRow.appendTableCell('議程項目 / 處室').setWidth(120);
  headerRow.appendTableCell('報告、討論與摘要內容 (AI 動態填入欄位)').setWidth(300);
  headerRow.appendTableCell('決議與裁示 / 備註').setWidth(130);
  
  // 美化表頭樣式
  for (let i = 0; i < 4; i++) {
    const cell = headerRow.getCell(i);
    cell.setBackgroundColor('#f1f5f9');
    cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER).setBold(true);
  }
  
  // 項目 1: 主席致詞
  const r1 = contentTable.appendTableRow();
  r1.appendTableCell('壹');
  r1.appendTableCell('主席致詞');
  r1.appendTableCell('{{主席致詞}}');
  r1.appendTableCell('主席裁示追蹤');
  
  // 項目 2: 處室業務報告
  const r2 = contentTable.appendTableRow();
  r2.appendTableCell('貳');
  r2.appendTableCell('各處室業務報告');
  r2.appendTableCell('{{處室報告}}');
  r2.appendTableCell('各組依計畫執行');
  
  // 項目 3: 提案討論與決議
  const r3 = contentTable.appendTableRow();
  r3.appendTableCell('參');
  r3.appendTableCell('提案討論與決議');
  r3.appendTableCell('{{討論與決議}}');
  r3.appendTableCell('大會決議');
  
  // 項目 4: 臨時動議與待辦事項
  const r4 = contentTable.appendTableRow();
  r4.appendTableCell('肆');
  r4.appendTableCell('臨時動議 / 待辦事項');
  r4.appendTableCell('{{待辦事項}}');
  r4.appendTableCell('依期限回報');
  
  // 項目 5: 會議現場照片專區
  const r5 = contentTable.appendTableRow();
  r5.appendTableCell('伍');
  r5.appendTableCell('會議實況照片與紀錄');
  
  // 照片儲存格合併或排版
  const photoCell = r5.appendTableCell();
  photoCell.appendParagraph('【會議照片 1】');
  photoCell.appendParagraph('{{會議照片1}}');
  photoCell.appendParagraph('圖說 1：{{圖說1}}');
  photoCell.appendParagraph('----------------------------------------');
  photoCell.appendParagraph('【會議照片 2】');
  photoCell.appendParagraph('{{會議照片2}}');
  photoCell.appendParagraph('圖說 2：{{圖說2}}');
  
  r5.appendTableCell('檔案室歸檔');
  
  // 附加「即時逐字與歷程紀錄」區塊 (每 10 分鐘手機上傳時自動追加於此)
  body.appendParagraph('').setSpacingAfter(10);
  const divider = body.appendHorizontalRule();
  const logHeader = body.appendParagraph('📝【會議即時語音轉寫與分段歷程摘要 (即時產出)】');
  logHeader.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('（說明：手機端每 10 分鐘或手動切分後，將自動在此處追加最新段落重點，利於現場核對）');
  
  DocumentApp.getUi().alert('✅ 學校標準會議記錄表格已成功插入！\n您可以開始進行會議或開啟側邊欄自訂標籤。');
}

/**
 * 側邊欄呼叫：在使用者滑鼠游標位置插入指定標籤
 */
function insertTagAtCursor(tagName) {
  try {
    const doc = DocumentApp.getActiveDocument();
    const cursor = doc.getCursor();
    const tagText = `{{${tagName}}}`;
    
    if (cursor) {
      const element = cursor.insertText(tagText);
      if (element) {
        element.setForegroundColor('#2563eb'); // 標籤預設藍色以利辨識
        return { success: true, message: `已成功插入標籤：${tagText}` };
      }
    }
    
    // 若游標無直接位置，嘗試尋找選取區
    const selection = doc.getSelection();
    if (selection) {
      const elements = selection.getRangeElements();
      if (elements.length > 0) {
        const el = elements[0].getElement();
        if (el.editAsText) {
          el.asText().appendText(tagText);
          return { success: true, message: `已附加標籤至選取區：${tagText}` };
        }
      }
    }
    
    return { success: false, message: '請先在 Google Docs 文件中點選欲插入的位置（儲存格或段落）！' };
  } catch (err) {
    return { success: false, message: '插入失敗：' + err.toString() };
  }
}

// ==============================================================================
// 4. 快取與雙端同步訊號 (Cross-Device Split Polling)
// ==============================================================================

/**
 * 電腦端觸發「手動切分段落」：寫入快取，有效期限 120 秒
 */
function triggerManualSplit() {
  const cache = CacheService.getScriptCache();
  cache.put('SPLIT_SIGNAL', 'true', 120);
  
  // 同時在文件末端標記切分記號
  try {
    const doc = getTargetDocument();
    const body = doc.getBody();
    const p = body.appendParagraph(`✂️ [手動切分點 - ${new Date().toLocaleTimeString('zh-TW')}] 記錄者觸發新議題切分`);
    p.setItalic(true).setForegroundColor('#64748b');
  } catch (e) {
    console.warn('Could not write split mark to doc:', e);
  }
  
  return { success: true, message: '手動切分訊號已發送！手機端將於 3 秒內結束當前段落並立即上傳。' };
}

/**
 * 手機端輪詢查詢：是否被電腦端要求立即切分音訊
 */
function checkSplitSignal() {
  const cache = CacheService.getScriptCache();
  const signal = cache.get('SPLIT_SIGNAL');
  if (signal === 'true') {
    cache.remove('SPLIT_SIGNAL'); // 讀取後立即清除
    return { split: true };
  }
  return { split: false };
}

// ==============================================================================
// 5. Web App 入口與 HTTP 處理 (Mobile Web App & Upload API)
// ==============================================================================

/**
 * GET 請求處理：
 * 1. 若 parameter.action === 'checkSplit'，回傳輪詢切分訊號 JSON
 * 2. 否則載入並渲染手機端錄音拍照 Web App (Mobile.html)
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'checkSplit') {
    const status = checkSplitSignal();
    return ContentService.createTextOutput(JSON.stringify(status))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const template = HtmlService.createTemplateFromFile('Mobile');
  // 注入設定至前端
  template.webAppUrl = ScriptApp.getService().getUrl();
  
  return template.evaluate()
    .setTitle('智慧學校會議助理 - 手機錄音收音端')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

/**
 * POST 請求處理：接收手機端傳來的音訊段落 Base64 或拍照影像 Base64
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    
    if (action === 'uploadAudio') {
      const result = handleAudioSegmentUpload(payload);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'uploadPhoto') {
      const result = handlePhotoUpload(payload);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'checkSplit') {
      const status = checkSplitSignal();
      return ContentService.createTextOutput(JSON.stringify(status))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 處理手機端上傳之 10 分鐘音訊切片
 */
function handleAudioSegmentUpload(payload) {
  const audioBase64 = payload.audioBase64;
  const mimeType = payload.mimeType || 'audio/webm';
  const segmentNumber = payload.segmentNumber || 1;
  const triggerType = payload.triggerType || '自動定時切分';
  
  if (!audioBase64) {
    return { success: false, error: 'Missing audioBase64 data' };
  }
  
  // 呼叫 Gemini 進行該段落語音轉寫與摘要
  const docHeader = getDocHeaderContext();
  const segmentSummary = callGeminiSegmentTranscription(audioBase64, mimeType, docHeader, segmentNumber);
  
  // 將段落轉寫與摘要即時寫入文件歷程區
  try {
    const doc = getTargetDocument();
    const body = doc.getBody();
    
    const timeStr = new Date().toLocaleTimeString('zh-TW');
    const headerP = body.appendParagraph(`\n📍【第 ${segmentNumber} 段音訊摘要】(${triggerType}於 ${timeStr})`);
    headerP.setHeading(DocumentApp.ParagraphHeading.HEADING3).setForegroundColor('#1e40af');
    
    const summaryP = body.appendParagraph(segmentSummary);
    summaryP.setForegroundColor('#334155');
    
    // 儲存並刷新文件
    doc.saveAndClose();
  } catch (err) {
    console.error('Error writing segment to doc:', err);
  }
  
  return {
    success: true,
    segmentNumber: segmentNumber,
    summary: segmentSummary
  };
}

/**
 * 處理手機端 Canvas 壓縮拍攝之會議現場照片上傳
 */
function handlePhotoUpload(payload) {
  const imageBase64 = payload.imageBase64;
  const timestamp = payload.timestamp || new Date().toISOString();
  
  if (!imageBase64) {
    return { success: false, error: 'Missing imageBase64' };
  }
  
  const folderId = getSetting('PHOTO_FOLDER_ID');
  if (!folderId || folderId === "YOUR_PHOTO_FOLDER_ID_HERE") {
    return { success: false, error: 'PHOTO_FOLDER_ID 尚未於後端 Code.gs 中設定！' };
  }
  
  const folder = DriveApp.getFolderById(folderId);
  const cleanBase64 = imageBase64.replace(/^data:image\/(jpeg|png);base64,/, "");
  const decodedBytes = Utilities.base64Decode(cleanBase64);
  
  const fileName = `MeetingPhoto_${Utilities.formatDate(new Date(), 'GMT+8', 'yyyyMMdd_HHmmss')}.jpg`;
  const blob = Utilities.newBlob(decodedBytes, 'image/jpeg', fileName);
  const file = folder.createFile(blob);
  
  return {
    success: true,
    fileId: file.getId(),
    fileName: file.getName(),
    url: file.getUrl()
  };
}

// ==============================================================================
// 6. Gemini API 整合 (動態版本查詢、Audio Transcription & Multimodal)
// ==============================================================================

/**
 * 取得當前應生效的 Gemini 模型名稱
 * 若 GEMINI_MODEL 設定為特定模型 (非空且非 "AUTO")，則使用手動指定之版本；
 * 否則調用 getLatestGeminiFlashModel() 自動向 API 查詢最新版本，失敗時以 gemini-3.6-flash 為備援。
 */
function getEffectiveGeminiModel() {
  const configuredModel = getSetting('GEMINI_MODEL');
  if (configuredModel && configuredModel.trim() !== '' && configuredModel.toUpperCase() !== 'AUTO') {
    return configuredModel.trim();
  }
  return getLatestGeminiFlashModel();
}

/**
 * 自動向 Google Generative Language API 查詢最新可用的 Gemini Flash 模型
 * 依據版本號排序並選取最新版；若查詢失敗或連線異常，則以 gemini-3.6-flash 作為備援
 * 
 * @param {boolean} forceRefresh 是否強制跳過快取並重新向 API 查詢
 * @returns {string} 決定的 Gemini 模型代號 (例如: "gemini-3.6-flash" 或更最新版本)
 */
function getLatestGeminiFlashModel(forceRefresh) {
  const BACKUP_MODEL = getSetting('BACKUP_MODEL') || 'gemini-3.6-flash';
  const cache = CacheService.getScriptCache();
  
  if (!forceRefresh) {
    const cachedModel = cache.get('LATEST_GEMINI_MODEL');
    if (cachedModel && cachedModel.trim() !== '') {
      return cachedModel;
    }
  }
  
  const apiKey = getSetting('GEMINI_API_KEY');
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return BACKUP_MODEL;
  }
  
  const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = UrlFetchApp.fetch(listModelsUrl, {
      method: 'get',
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      console.warn(`查詢 Gemini 模型清單失敗 (HTTP ${response.getResponseCode()})，啟用備援模型 ${BACKUP_MODEL}`);
      return BACKUP_MODEL;
    }
    
    const data = JSON.parse(response.getContentText());
    if (!data.models || !Array.isArray(data.models)) {
      console.warn(`Gemini 模型清單回應格式非陣列，啟用備援模型 ${BACKUP_MODEL}`);
      return BACKUP_MODEL;
    }
    
    // 篩選支援 generateContent 且為 flash 系列之模型
    const flashModels = data.models.filter(function(m) {
      const name = m.name || '';
      const isFlash = name.toLowerCase().indexOf('flash') !== -1;
      const supportsGen = Array.isArray(m.supportedGenerationMethods) &&
                          m.supportedGenerationMethods.indexOf('generateContent') !== -1;
      return isFlash && supportsGen;
    });
    
    if (flashModels.length === 0) {
      console.warn(`未在清單中找到可用的 Flash 模型，啟用備援模型 ${BACKUP_MODEL}`);
      return BACKUP_MODEL;
    }
    
    // 版本號解析與降序排序 (由新到舊)
    flashModels.sort(function(a, b) {
      const vA = parseModelVersion(a.name);
      const vB = parseModelVersion(b.name);
      return compareVersions(vB, vA);
    });
    
    const latestModelFullName = flashModels[0].name; // 例如 "models/gemini-3.6-flash"
    const latestModelName = latestModelFullName.replace(/^models\//, '');
    
    // 快取 6 小時 (21600 秒)
    cache.put('LATEST_GEMINI_MODEL', latestModelName, 21600);
    console.log(`成功獲取最新 Gemini Flash 模型: ${latestModelName}`);
    return latestModelName;
  } catch (err) {
    console.warn(`查詢最新 Gemini 模型異常，啟用備援模型 ${BACKUP_MODEL}：`, err);
    return BACKUP_MODEL;
  }
}

/**
 * 從模型名稱提取版本號陣列，例如 "models/gemini-3.6-flash" -> [3, 6]
 */
function parseModelVersion(modelName) {
  const match = modelName.match(/gemini-(\d+(?:\.\d+)*)/i);
  if (!match) return [0];
  return match[1].split('.').map(function(n) { return parseInt(n, 10); });
}

/**
 * 比較兩組版本號陣列 (由大至小比較)
 */
function compareVersions(vA, vB) {
  const maxLen = Math.max(vA.length, vB.length);
  for (let i = 0; i < maxLen; i++) {
    const numA = vA[i] || 0;
    const numB = vB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

/**
 * 手動觸發檢查並更新最新 Gemini 模型 (供文件選單調用)
 */
function checkAndUpdateGeminiModel() {
  const ui = DocumentApp.getUi();
  const latestModel = getLatestGeminiFlashModel(true); // 強制重新向 API 查詢
  const backupModel = getSetting('BACKUP_MODEL') || 'gemini-3.6-flash';
  const configured = getSetting('GEMINI_MODEL');
  
  let msg = '🤖【Gemini 模型版本狀態與檢查】\n\n';
  msg += `• 自動查詢最新可用模型：✅ ${latestModel}\n`;
  msg += `• 備援模型 (Fallback)：${backupModel}\n`;
  if (configured && configured.toUpperCase() !== 'AUTO') {
    msg += `• 手動指定鎖定模型：${configured} (目前優先套用手動鎖定)\n`;
  } else {
    msg += `• 目前模式：自動啟用最新版 (${latestModel})\n`;
  }
  msg += '\n系統已更新模型快取，後續會議錄音與排版將採用此模型！';
  
  ui.alert(msg);
}

/**
 * 取得當前文件前 500 字元作為背景脈絡 (含會議名稱、主席、紀錄等)
 */
function getDocHeaderContext() {
  try {
    const doc = getTargetDocument();
    const text = doc.getBody().getText();
    return text.substring(0, 600);
  } catch (e) {
    return "";
  }
}

/**
 * 呼叫 Gemini 進行單段 10 分鐘音訊轉寫與段落摘要
 */
function callGeminiSegmentTranscription(audioBase64, mimeType, docHeader, segmentNumber) {
  const apiKey = getSetting('GEMINI_API_KEY');
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
    return `[系統警示] 請先在 Code.gs 中填寫有效的 GEMINI_API_KEY。`;
  }
  
  const model = getEffectiveGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const prompt = `
你是一位專業且經驗豐富的學校行政會議紀錄秘書。
現在收到會議現場第 ${segmentNumber} 段錄音音訊。

【文件已知資訊 (表頭與人員)】
${docHeader}

【學校組織與教育詞彙字典】
${SCHOOL_CONTEXT}

【任務要求】
1. 請仔細聆聽音訊內容，根據上述學校處室與教育詞彙字典進行精確語音識別（修正諧音或專有名詞）。
2. 提供本段會議的「核心重點摘要」（條列式 3 至 5 點，列出發言處室、報告核心與具體決議）。
3. 提供精簡整理的對話重點或發言記錄。
4. 使用繁體中文（台灣標準學校公文規範），語氣客觀嚴謹。
`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          },
          {
            inline_data: {
              mime_type: mimeType.split(';')[0], // 移除 codecs 部分如 audio/webm;codecs=opus
              data: audioBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048
    }
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
      return json.candidates[0].content.parts[0].text;
    } else {
      console.error('Gemini API Error Response:', response.getContentText());
      return `[語音識別回應異常] ${response.getContentText()}`;
    }
  } catch (err) {
    console.error('Fetch error:', err);
    return `[連線錯誤] ${err.toString()}`;
  }
}

// ==============================================================================
// 7. 動態標籤解析與一鍵排版 (Dynamic Final Minutes & Photo Insertion)
// ==============================================================================

/**
 * 核心自動化功能：動態比對所有 {{標籤}}、自動歸納文字、插入最新照片與生成圖說
 */
function generateFinalMinutesDynamic() {
  const ui = DocumentApp.getUi();
  const doc = getTargetDocument();
  const body = doc.getBody();
  const fullText = body.getText();
  
  // 1. 正則表達式掃描文件中所有 {{標籤}}
  const tagMatches = fullText.match(/\{\{([^}]+)\}\}/g);
  if (!tagMatches || tagMatches.length === 0) {
    ui.alert('⚠️ 未在文件中發現任何 {{標籤}}！請先插入學校標準表格或自訂標籤。');
    return;
  }
  
  // 去除重複標籤，取得純標籤名
  const uniqueTags = [...new Set(tagMatches.map(t => t.replace(/[{}]/g, '').trim()))];
  
  ui.alert(`🔍 正在進行 AI 自動排版分析...\n發現 ${uniqueTags.length} 個標籤：\n${uniqueTags.join(', ')}\n\n請稍候 5~10 秒，系統將歸納文字並置換照片！`);
  
  // 2. 區分照片標籤、圖說標籤與純文字標籤
  const photoTags = uniqueTags.filter(t => t.includes('照片') || t.toLowerCase().includes('photo'));
  const captionTags = uniqueTags.filter(t => t.includes('圖說') || t.toLowerCase().includes('caption'));
  const textTags = uniqueTags.filter(t => !photoTags.includes(t));
  
  // 3. 取得照片資料夾中的最新照片
  const photos = getLatestMeetingPhotos(2);
  
  // 4. 呼叫 Gemini 2.5 Flash 生成對應動態標籤的 JSON 內容 (包含文字與圖說)
  const aiOutput = callGeminiDynamicSummary(fullText, textTags, photos);
  
  if (!aiOutput || Object.keys(aiOutput).length === 0) {
    ui.alert('❌ AI 生成摘要失敗或回傳格式有誤，請檢查後端日誌或 API Key 設定。');
    return;
  }
  
  // 5. 文字標籤自動替換
  for (const tag of textTags) {
    if (aiOutput[tag]) {
      const rawText = aiOutput[tag];
      body.replaceText(`\\{\\{${escapeRegex(tag)}\\}\\}`, rawText);
    }
  }
  
  // 6. 圖說標籤替換
  for (const tag of captionTags) {
    if (aiOutput[tag]) {
      body.replaceText(`\\{\\{${escapeRegex(tag)}\\}\\}`, aiOutput[tag]);
    }
  }
  
  // 7. 照片標籤置換為實際 Google Drive 圖片，並自動等比例縮放
  const targetWidth = Number(getSetting('PHOTO_DISPLAY_WIDTH')) || 220;
  
  if (photos.length >= 1 && (fullText.includes('{{會議照片1}}') || fullText.includes('{{照片1}}'))) {
    replaceTagWithImage(body, '{{會議照片1}}', photos[0].getBlob(), targetWidth);
    replaceTagWithImage(body, '{{照片1}}', photos[0].getBlob(), targetWidth);
  }
  
  if (photos.length >= 2 && (fullText.includes('{{會議照片2}}') || fullText.includes('{{照片2}}'))) {
    replaceTagWithImage(body, '{{會議照片2}}', photos[1].getBlob(), targetWidth);
    replaceTagWithImage(body, '{{照片2}}', photos[1].getBlob(), targetWidth);
  }
  
  // 儲存並更新
  doc.saveAndClose();
  
  ui.alert('🎉 會議紀錄自動化排版完成！\n已成功填妥各標籤欄位並縮放插入最新會議現場照片。');
}

/**
 * 呼叫 Gemini 根據所有標籤生成結構化 JSON (包含文字摘要與照片圖說)
 */
function callGeminiDynamicSummary(fullDocText, textTags, photoFiles) {
  const apiKey = getSetting('GEMINI_API_KEY');
  const model = getEffectiveGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const prompt = `
你是一位全能的學校行政會議秘書，請將以下提供的完整會議紀錄、逐字摘要以及現場照片，精準歸納並填入指定標籤。

【學校組織與教育詞彙字典】
${SCHOOL_CONTEXT}

【會議文件完整文字（含歷程轉寫紀錄）】
${fullDocText}

【需填充的動態標籤清單】
${JSON.stringify(textTags, null, 2)}

【特殊規則】
1. 若有標籤如「主席致詞」，請摘要主席之發言方針、勉勵事項與重要政策。
2. 若有「處室報告」，請條列教務、學務、總務、輔導等各處室之業務推動進度。
3. 若有「討論與決議」，請將各案由的討論意見與最後裁決明確條列。
4. 若有「待辦事項」，請提取行動清單、主責處室與預定完成期限。
5. 若有「圖說1」、「圖說2」等圖說標籤，請根據所附照片內容，在 12 字以內生動且客觀描述照片（例如：「行政會報現場討論實況」、「各處室業務白板重點」）。
6. 其他自訂標籤請依標籤字面含意，從會議紀錄中提煉出最適切的內容。
7. 請務必輸出純 JSON 格式，鍵名 (Keys) 必須與標籤清單中的文字完全相符。
`;

  const parts = [{ text: prompt }];
  
  // 將照片附加至 Multimodal 請求中以供生成圖說與輔助理解
  for (let i = 0; i < photoFiles.length; i++) {
    try {
      const blob = photoFiles[i].getBlob();
      const base64Data = Utilities.base64Encode(blob.getBytes());
      parts.push({
        inline_data: {
          mime_type: blob.getContentType(),
          data: base64Data
        }
      });
    } catch (e) {
      console.warn('Error attaching photo to Gemini:', e);
    }
  }

  const requestBody = {
    contents: [{ parts: parts }],
    generationConfig: {
      temperature: 0.2,
      response_mime_type: "application/json"
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(res.getContentText());
    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
      const rawJsonStr = json.candidates[0].content.parts[0].text;
      return JSON.parse(rawJsonStr);
    }
  } catch (err) {
    console.error('Failed to parse Gemini dynamic JSON:', err);
  }
  
  return null;
}

/**
 * 從指定 Google Drive 資料夾取得最新 N 張照片 (依建立時間由新到舊排序)
 */
function getLatestMeetingPhotos(maxCount) {
  const folderId = getSetting('PHOTO_FOLDER_ID');
  if (!folderId || folderId === "YOUR_PHOTO_FOLDER_ID_HERE") {
    return [];
  }
  
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const photoList = [];
    
    while (files.hasNext()) {
      const f = files.next();
      const mime = f.getMimeType();
      if (mime.startsWith('image/')) {
        photoList.push({
          file: f,
          updated: f.getLastUpdated().getTime()
        });
      }
    }
    
    // 由新至舊排序
    photoList.sort((a, b) => b.updated - a.updated);
    
    // 依序回傳最新照片實例
    return photoList.slice(0, maxCount).map(item => item.file);
  } catch (err) {
    console.error('Error fetching photos:', err);
    return [];
  }
}

/**
 * 在 Google Docs 中搜尋特定標籤，將其替換為實際圖片並等比例縮放
 */
function replaceTagWithImage(body, tagText, imageBlob, targetWidth) {
  try {
    const found = body.findText(escapeRegex(tagText));
    if (!found) return;
    
    const element = found.getElement();
    const parent = element.getParent();
    
    let insertedImage = null;
    
    // 若標籤位於段落內 (表格儲存格內通常為 Paragraph)
    if (parent.getType() === DocumentApp.ElementType.PARAGRAPH) {
      const paragraph = parent.asParagraph();
      const childIndex = paragraph.getChildIndex(element);
      insertedImage = paragraph.insertInlineImage(childIndex, imageBlob);
      // 清空原有標籤文字
      element.asText().replaceText(escapeRegex(tagText), "");
    } else if (parent.getType() === DocumentApp.ElementType.TABLE_CELL) {
      const cell = parent.asTableCell();
      insertedImage = cell.appendImage(imageBlob);
      element.asText().replaceText(escapeRegex(tagText), "");
    } else {
      insertedImage = body.appendImage(imageBlob);
      element.asText().replaceText(escapeRegex(tagText), "");
    }
    
    // 等比例縮放至指定寬度
    if (insertedImage) {
      const origW = insertedImage.getWidth();
      const origH = insertedImage.getHeight();
      if (origW > 0) {
        const targetH = Math.round((origH / origW) * targetWidth);
        insertedImage.setWidth(targetWidth);
        insertedImage.setHeight(targetH);
      }
    }
  } catch (err) {
    console.error(`Error replacing ${tagText} with image:`, err);
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==============================================================================
// 8. 範本管理庫 (Template Management)
// ==============================================================================

/**
 * 將當前文件儲存為學校會議範本庫中的一份新範本
 */
function saveAsTemplate() {
  const ui = DocumentApp.getUi();
  const folderId = getSetting('TEMPLATE_FOLDER_ID');
  
  if (!folderId || folderId === "YOUR_TEMPLATE_FOLDER_ID_HERE") {
    ui.alert('⚠️ 請先在 Code.gs 中設定 TEMPLATE_FOLDER_ID 範本庫資料夾 ID！');
    return;
  }
  
  const response = ui.prompt('💾 儲存為會議範本', '請輸入範本名稱（例如：課審會標準範本、行政會報範本）：', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  const templateName = response.getResponseText().trim();
  if (!templateName) {
    ui.alert('範本名稱不得為空！');
    return;
  }
  
  try {
    const currentDoc = getTargetDocument();
    const folder = DriveApp.getFolderById(folderId);
    const copiedFile = DriveApp.getFileById(currentDoc.getId()).makeCopy(templateName, folder);
    ui.alert(`✅ 範本已成功建立！\n名稱：${templateName}\n已儲存於指定的 Google Drive 範本資料夾中。`);
  } catch (err) {
    ui.alert('儲存範本失敗：' + err.toString());
  }
}

/**
 * 顯示自訂範本選擇清單
 */
function showTemplatePicker() {
  const ui = DocumentApp.getUi();
  const folderId = getSetting('TEMPLATE_FOLDER_ID');
  
  if (!folderId || folderId === "YOUR_TEMPLATE_FOLDER_ID_HERE") {
    ui.alert('⚠️ 請先在 Code.gs 中設定 TEMPLATE_FOLDER_ID！');
    return;
  }
  
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByType(MimeType.GOOGLE_DOCS);
    const templates = [];
    
    while (files.hasNext()) {
      const f = files.next();
      templates.push({ id: f.getId(), name: f.getName() });
    }
    
    if (templates.length === 0) {
      ui.alert('範本庫目前沒有任何 Google Docs 範本。\n您可以先排版好表格後，點選「💾 5. 儲存當前格式為範本」！');
      return;
    }
    
    let msg = '現有會議範本庫清單：\n';
    templates.forEach((t, index) => {
      msg += `${index + 1}. ${t.name}\n`;
    });
    msg += '\n請輸入要套用的範本編號：';
    
    const res = ui.prompt('📂 載入自訂會議範本', msg, ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() === ui.Button.OK) {
      const choice = parseInt(res.getResponseText().trim(), 10);
      if (choice >= 1 && choice <= templates.length) {
        applyTemplate(templates[choice - 1].id);
      } else {
        ui.alert('輸入之編號無效。');
      }
    }
  } catch (err) {
    ui.alert('讀取範本庫失敗：' + err.toString());
  }
}

/**
 * 套用範本內容至當前文件
 */
function applyTemplate(templateDocId) {
  const ui = DocumentApp.getUi();
  try {
    const templateDoc = DocumentApp.openById(templateDocId);
    const templateBody = templateDoc.getBody();
    const targetDoc = getTargetDocument();
    const targetBody = targetDoc.getBody();
    
    targetBody.clear(); // 清空當前內容並覆蓋
    
    // 複製段落與表格
    for (let i = 0; i < templateBody.getNumChildren(); i++) {
      const child = templateBody.getChild(i).copy();
      const type = child.getType();
      
      if (type === DocumentApp.ElementType.PARAGRAPH) {
        targetBody.appendParagraph(child.asParagraph());
      } else if (type === DocumentApp.ElementType.TABLE) {
        targetBody.appendTable(child.asTable());
      } else if (type === DocumentApp.ElementType.LIST_ITEM) {
        targetBody.appendListItem(child.asListItem());
      }
    }
    
    ui.alert('✅ 範本載入並套用完成！');
  } catch (err) {
    ui.alert('套用範本失敗：' + err.toString());
  }
}

// ==============================================================================
// 9. 系統設定與狀態檢查 (System Status & Diagnostics)
// ==============================================================================

/**
 * 檢查系統設定完整性與 Web App 部署狀態
 */
function showSystemStatus() {
  const ui = DocumentApp.getUi();
  const apiKey = getSetting('GEMINI_API_KEY');
  const photoFolderId = getSetting('PHOTO_FOLDER_ID');
  const templateFolderId = getSetting('TEMPLATE_FOLDER_ID');
  const webAppUrl = ScriptApp.getService().getUrl();
  const activeModel = getEffectiveGeminiModel();
  const backupModel = getSetting('BACKUP_MODEL') || 'gemini-3.6-flash';
  const configured = getSetting('GEMINI_MODEL');
  
  let msg = '📊【智慧學校會議系統 - 狀態檢查】\n\n';
  msg += `1. Gemini API Key: ${apiKey && apiKey.length > 10 ? '✅ 已填寫 (' + apiKey.substring(0, 7) + '...)' : '❌ 尚未填寫'}\n`;
  msg += `2. 當前啟用模型: ✅ ${activeModel} (備援: ${backupModel}${configured && configured.toUpperCase() !== 'AUTO' ? '，已手動鎖定' : '，自動查詢最新'})\n`;
  msg += `3. 照片資料夾 ID: ${photoFolderId && photoFolderId.length > 5 ? '✅ 已設定' : '❌ 尚未設定'}\n`;
  msg += `4. 範本資料夾 ID: ${templateFolderId && templateFolderId.length > 5 ? '✅ 已設定' : '❌ 尚未設定'}\n`;
  msg += `5. Web App 網址: ${webAppUrl ? '✅ ' + webAppUrl : '⚠️ 尚未部署為 Web 應用程式 (請點選右上角「部署」)'}\n\n`;
  msg += '提示：若使用手機收音，請將 Web App 網址在手機 Safari 或 Chrome 中開啟即可。';
  
  ui.alert(msg);
}

/**
 * 取得本份會議系統連線資訊 (提供給側邊欄 QR Code 產生器使用)
 */
function getSystemConnectionInfo() {
  const webAppUrl = ScriptApp.getService().getUrl() || "";
  const vercelUrl = getSetting('VERCEL_APP_URL') || "https://smart-meeting-system.vercel.app";
  let docId = "";
  try {
    docId = getTargetDocument().getId();
  } catch (e) {}
  
  return {
    webAppUrl: webAppUrl,
    vercelUrl: vercelUrl,
    docId: docId
  };
}

