import { put } from '@vercel/blob';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const rawFilename = req.headers['x-filename'];
    const filename = rawFilename ? decodeURIComponent(String(rawFilename)) : '';

    if (!filename) {
      return json(res, 400, { error: '缺少文件名' });
    }

    if (!req.headers['content-type']?.startsWith('image/')) {
      return json(res, 400, { error: '只能上传图片文件' });
    }

    const safeName = String(filename)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-120);

    const pathname =
      `receipts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const blob = await put(pathname, req, {
      access: 'private',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return json(res, 201, {
      ok: true,
      pathname: blob.pathname
    });
  } catch (error) {
    console.error(error);

    return json(res, 500, {
      error: error.message || '凭证上传失败'
    });
  }
}
