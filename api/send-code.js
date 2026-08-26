const store = globalThis.__skinbeautySmsStore || new Map();
globalThis.__skinbeautySmsStore = store;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function normalizePhone(countryCode = '+82', phoneNumber = '') {
  const code = String(countryCode).trim().replace(/[^\d+]/g, '');
  let number = String(phoneNumber).trim().replace(/\D/g, '');
  if (code === '+82' && number.startsWith('0')) number = number.slice(1);
  return `${code}${number}`;
}

async function sendTwilioSms(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error('短信服务未配置：请在 Vercel 设置 TWILIO_ACCOUNT_SID、TWILIO_AUTH_TOKEN、TWILIO_FROM_NUMBER');
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: TWILIO_FROM_NUMBER, To: to, Body: body }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`短信发送失败：${text}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const { countryCode, phoneNumber } = req.body || {};
  const phone = normalizePhone(countryCode, phoneNumber);
  if (!/^\+\d{8,15}$/.test(phone)) return json(res, 400, { error: '手机号格式不正确' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  store.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });
  try {
    await sendTwilioSms(phone, `skinbeauty 验证码：${code}。5分钟内有效。`);
    return json(res, 200, { ok: true, phone });
  } catch (error) {
    store.delete(phone);
    return json(res, 500, { error: error.message });
  }
}
