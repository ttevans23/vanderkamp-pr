// Vercel serverless function: /api/storage
// Backed by Vercel KV. Provides shared key/value storage across the team
// so the dashboard, library, and SEO tracker stay in sync.
//
// Methods:
//   GET    /api/storage?key=...     -> { value }
//   POST   /api/storage             -> body: { key, value }
//   DELETE /api/storage?key=...     -> { ok: true }
//
// Keys are namespaced under "vk:" so they don't collide with anything else
// in the KV store.

import { kv } from "@vercel/kv";

export const config = { runtime: "edge" };

const ns = (k) => `vk:${k}`;

export default async function handler(req) {
  const url = new URL(req.url);

  try {
    if (req.method === "GET") {
      const key = url.searchParams.get("key");
      if (!key) return json({ error: "key required" }, 400);
      const value = await kv.get(ns(key));
      return json({ value });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body?.key) return json({ error: "key required" }, 400);
      await kv.set(ns(body.key), body.value);
      return json({ ok: true });
    }

    if (req.method === "DELETE") {
      const key = url.searchParams.get("key");
      if (!key) return json({ error: "key required" }, 400);
      await kv.del(ns(key));
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
