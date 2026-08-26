export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { countryCode = '+82', phoneNumber = '' } = req.body || {};

  if (!phoneNumber.trim()) {
    return res.status(400).json({ error: '请输入手机号' });
  }

  return res.status(200).json({
    ok: true,
    phone: `${countryCode}${phoneNumber}`,
    testCode: '123456'
  });
}