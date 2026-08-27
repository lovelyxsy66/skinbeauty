import { get } from '@vercel/blob';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const pathname = req.query?.pathname;

    if (!pathname || !String(pathname).startsWith('receipts/')) {
      return json(res, 400, { error: '快递单路径不正确' });
    }

    const result = await get(pathname, {
      access: 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    if (!result) {
      return json(res, 404, { error: '找不到快递单照片' });
    }

    res.statusCode = 200;
    res.setHeader(
      'content-type',
      result.blob.contentType || 'application/octet-stream'
    );

    if (result.blob.size) {
      res.setHeader('content-length', String(result.blob.size));
    }

    return result.stream.pipe(res);
  } catch (error) {
    console.error(error);

    return json(res, 500, {
      error: error.message || '快递单照片读取失败'
    });
  }
}
