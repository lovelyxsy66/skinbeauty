# skinbeauty

Mobile-first skinbeauty storefront.

## Deploy

This repository can be imported directly into Vercel. The included `vercel.json` rewrites all routes to `index.html` so the `/admin` client route works after refresh.

## SMS

Real SMS login uses the Vercel serverless functions in `api/`.

Set these Vercel environment variables before expecting phones to receive messages:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
