import { handleDbApi } from "../../../server/turso-db.js";

export const prerender = false;

async function respond(action, request) {
  let body = null;
  if (request.method === "PUT" || request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      body = null;
    }
  }
  const result = await handleDbApi({ action, method: request.method, body });
  return new Response(JSON.stringify(result.data), {
    status: result.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export async function GET({ params, request }) {
  return respond(params.action, request);
}

export async function PUT({ params, request }) {
  return respond(params.action, request);
}

export async function POST({ params, request }) {
  return respond(params.action, request);
}
