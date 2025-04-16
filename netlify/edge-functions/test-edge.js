// Simple test edge function to verify edge functions are working
export default async (request, context) => {
  return new Response(
    JSON.stringify({
      message: "Edge function is working!",
      timestamp: new Date().toISOString(),
      url: request.url,
      method: request.method,
      headers: Object.fromEntries([...request.headers]),
      env: {
        NETLIFY: context.env.get("NETLIFY") || "not set",
        CONTEXT: context.env.get("CONTEXT") || "not set",
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
};
