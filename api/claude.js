// Vercel serverless function: /api/claude
// Streams Claude's response back to the browser using Server-Sent Events
// so the proxy itself completes immediately (within Vercel's timeout)
// and the browser receives chunks as they arrive.

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Force streaming on so the upstream response arrives in chunks
  payload.stream = true;

  // Optional override: set ANTHROPIC_MODEL in Vercel env vars to change the
  // model without a code change (e.g. when a model is retired).
  if (process.env.ANTHROPIC_MODEL) payload.model = process.env.ANTHROPIC_MODEL;

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Upstream connection failed: ${err?.message || err}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!upstream.ok) {
    // Upstream returned a non-streaming error — pass it through as JSON
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Pipe the SSE stream straight through to the browser. The Edge runtime
  // releases the function the moment streaming starts, so the 10s timeout
  // doesn't apply to the duration of the upstream request.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
