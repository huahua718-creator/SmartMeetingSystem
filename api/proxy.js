/**
 * Vercel Serverless Function: GAS API Proxy
 * 解決瀏覽器端直接向 Google Apps Script 發送請求時的 CORS 與 302 重導向問題
 */
export default async function handler(req, res) {
  // 設定 CORS 標頭以允許跨網域呼叫
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, target-gas-url'
  );

  // 處理瀏覽器 OPTIONS 預檢請求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 從標頭或 Query 取得目標 GAS Web App 網址
  const targetGasUrl = req.headers['target-gas-url'] || req.query.gasUrl;
  if (!targetGasUrl) {
    return res.status(400).json({
      success: false,
      error: '缺少目標 GAS 網址 (請在 target-gas-url 標頭或 ?gasUrl= 參數中帶入)'
    });
  }

  try {
    const fetchOptions = {
      method: req.method,
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (req.method === 'POST') {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const gasResponse = await fetch(targetGasUrl, fetchOptions);
    const responseText = await gasResponse.text();

    try {
      const jsonData = JSON.parse(responseText);
      return res.status(gasResponse.status).json(jsonData);
    } catch {
      return res.status(gasResponse.status).send(responseText);
    }
  } catch (err) {
    console.error('GAS Proxy Error:', err);
    return res.status(500).json({
      success: false,
      error: '轉發至 GAS 後端失敗：' + err.message
    });
  }
}
