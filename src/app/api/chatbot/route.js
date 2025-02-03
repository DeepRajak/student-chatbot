export async function POST(req) {
  try {
    const { message } = await req.json();

    // Connect to the Python Flask backend
    const response = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Return the response from the Python backend
    return new Response(JSON.stringify({ response: data.response }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    
    // Return error response
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