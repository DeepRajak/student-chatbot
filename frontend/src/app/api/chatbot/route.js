const BACKEND_URL = process.env.CHATBOT_BACKEND_URL || "http://localhost:5000"
const TIMEOUT_MS  = parseInt(process.env.FETCH_TIMEOUT_MS || "30000", 10)

function makeController() {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  return { ctrl, clearId: () => clearTimeout(id) }
}

async function parseBody(req) {
  // B1 (route side): parse JSON safely; SyntaxError becomes a 400
  try {
    return await req.json()
  } catch {
    return null
  }
}

function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({ response: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export async function POST(req) {
  const body = await parseBody(req)
  if (!body) {
    return errorResponse("Invalid JSON in request body.", 400)
  }

  const message    = typeof body?.message === "string" ? body.message.trim() : ""
  const sessionId  = body?.session_id ?? null
  const wantStream = body?.stream === true

  if (!message) {
    return errorResponse("Please enter a message before sending.", 400)
  }
  if (message.length > 2000) {
    return errorResponse("Message is too long (max 2000 characters).", 400)
  }

  const { ctrl, clearId } = makeController()

  try {
    if (wantStream) {
      // ── SSE streaming path (E3) ──────────────────────────────────
      const upstream = await fetch(`${BACKEND_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, session_id: sessionId }),
        signal: ctrl.signal,
      })

      if (!upstream.ok) {
        // B12: cap error body to 500 bytes to avoid memory blow-up
        const raw = await upstream.text()
        const snippet = raw.slice(0, 500)
        throw new Error(`Backend ${upstream.status}: ${snippet}`)
      }

      return new Response(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-store",
          "Connection": "keep-alive",
        },
      })
    } else {
      // ── Regular JSON path ────────────────────────────────────────
      const upstream = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, session_id: sessionId }),
        signal: ctrl.signal,
      })

      if (!upstream.ok) {
        const raw = await upstream.text()
        throw new Error(`Backend ${upstream.status}: ${raw.slice(0, 500)}`)
      }

      // B1: catch JSON parse errors from upstream
      let data
      try {
        data = await upstream.json()
      } catch {
        throw new Error("Backend returned non-JSON response")
      }

      return new Response(JSON.stringify({ response: data.response }), {
        headers: { "Content-Type": "application/json" },
      })
    }
  } catch (error) {
    const isTimeout = error.name === "AbortError"
    console.error("Chatbot route error:", isTimeout ? "Timeout" : error.message)

    return errorResponse(
      isTimeout
        ? "The request timed out. The server may be busy — please try again."
        : "Sorry, I'm having trouble connecting to my brain. Please try again later.",
    )
  } finally {
    clearId()
  }
}

export async function POST_feedback(req) {
  // Proxy feedback to backend
  const body = await parseBody(req)
  if (!body) return errorResponse("Invalid JSON", 400)

  try {
    const upstream = await fetch(`${BACKEND_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await upstream.json()
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch {
    return errorResponse("Feedback submission failed")
  }
}
