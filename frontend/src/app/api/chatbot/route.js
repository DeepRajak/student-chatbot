export async function POST(req) {
  try {
    const body = await req.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!message) {
      return new Response(
        JSON.stringify({ response: 'Please enter a message before sending.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const backendUrl = process.env.CHATBOT_BACKEND_URL || 'http://localhost:5000';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return new Response(JSON.stringify({ response: data.response }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error:', error);

    return new Response(
      JSON.stringify({
        response: "Sorry, I'm having trouble connecting to my brain. Please try again later.",
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}