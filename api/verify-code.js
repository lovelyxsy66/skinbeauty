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

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const { countryCode, phoneNumber, code } = req.body || {};
  const phone = normalizePhone(countryCode, phoneNumber);
  const record = store.get(phone);
  if (!record) return json(res, 400, { error: '请先发送短信验证码' });
  if (record.expiresAt < Date.now()) {
    store.delete(phone);
    return json(res, 400, { error: '验证码已过期，请重新发送' });
  }
  record.attempts += 1;
  if (record.attempts > 5) {
    store.delete(phone);
    return json(res, 429, { error: '尝试次数过多，请重新发送' });
  }
  if (String(code || '').trim() !== record.code) return json(res, 400, { error: '验证码不正确' });
  store.delete(phone);
  return json(res, 200, { ok: true, phone });
}
