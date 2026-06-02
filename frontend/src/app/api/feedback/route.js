// Dedicated feedback route for E15 thumbs up/down
const BACKEND_URL = process.env.CHATBOT_BACKEND_URL || "http://localhost:5000"

export async function POST(req) {
  try {
    const body = await req.json()
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
  } catch (error) {
    console.error("Feedback route error:", error.message)
    return new Response(JSON.stringify({ error: "Feedback failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
