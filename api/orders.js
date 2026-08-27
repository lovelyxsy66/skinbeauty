import { neon } from '@neondatabase/serverless';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getSql() {
  const connectionString =
    process.env.STORAGE_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Database connection is not configured');
  }

  return neon(connectionString);
}

export default async function handler(req, res) {
  try {
    const sql = getSql();
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_events JSONB DEFAULT '[]'::jsonb`;

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT
          id,
          username,
          customer_phone AS "customerPhone",
          customer_name AS "customerName",
          address_phone AS "addressPhone",
          postal_code AS "postalCode",
          road_address AS "roadAddress",
          detail_address AS "detailAddress",
          items,
          subtotal,
          shipping_fee AS "shippingFee",
          total,
          payer_name AS "payerName",
          status,
          transfer_confirmed AS "transferConfirmed",
          attribution,
          status_events AS "statusEvents",
          shipping_receipt_url AS "shippingReceiptUrl",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM orders
        ORDER BY created_at DESC
      `;

      return json(res, 200, { orders: rows });
    }
if (req.method === 'PATCH') {
  const { id, status, transferConfirmed, shippingReceiptUrl, statusEvents } = req.body || {};

  if (!id) {
    return json(res, 400, { error: '订单号不能为空' });
  }

  const rows = await sql`
    UPDATE orders
    SET
      status = COALESCE(${status ?? null}, status),
      transfer_confirmed = COALESCE(${transferConfirmed ?? null}, transfer_confirmed),
      shipping_receipt_url = COALESCE(${shippingReceiptUrl ?? null}, shipping_receipt_url),
      status_events = COALESCE(${statusEvents ? JSON.stringify(statusEvents) : null}::jsonb, status_events),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id
  `;

  if (!rows.length) {
    return json(res, 404, { error: '订单不存在' });
  }

  return json(res, 200, {
    ok: true,
    id: rows[0].id
  });
}
    if (req.method === 'POST') {
      const order = req.body || {};
      const address = order.address || {};

      if (!order.id) {
        return json(res, 400, { error: '订单号不能为空' });
      }

      const rows = await sql`
        INSERT INTO orders (
          id,
          username,
          customer_phone,
          customer_name,
          address_phone,
          postal_code,
          road_address,
          detail_address,
          items,
          subtotal,
          shipping_fee,
          total,
          payer_name,
          status,
          transfer_confirmed,
          attribution,
          status_events,
          created_at,
          updated_at
        )
        VALUES (
          ${order.id},
          ${order.username || ''},
          ${order.customerPhone || ''},
          ${address.name || ''},
          ${address.phone || ''},
          ${address.zip || ''},
          ${address.road || ''},
          ${address.detail || ''},
          ${JSON.stringify(order.items || [])}::jsonb,
          ${Number(order.subtotal || 0)},
          ${Number(order.shippingFee || 0)},
          ${Number(order.total || 0)},
          ${order.payerName || ''},
          ${order.status || '接单前'},
          ${Boolean(order.transferConfirmed)},
          ${JSON.stringify(order.attribution || {})}::jsonb,
          ${JSON.stringify(order.statusEvents || [])}::jsonb,
          ${order.createdAt || new Date().toISOString()},
          NOW()
        )
        RETURNING id
      `;

      return json(res, 201, {
        ok: true,
        id: rows[0].id
      });
    }

    return json(res, 405, {
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error(error);

    return json(res, 500, {
      error: error.message || 'Database error'
    });
  }
}
