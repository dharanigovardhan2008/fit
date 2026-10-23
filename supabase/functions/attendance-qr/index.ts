// Edge Function: attendance-qr (owner only)
// Returns today's check-in and check-out QR payloads, each signed with QR_SECRET.
// Payload shape: gymId|YYYY-MM-DD|in-or-out|HMAC-SHA256(gymId|date|direction)
import { getCaller, hmacSign } from "../_shared/client.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { admin, caller } = await getCaller(req);
    if (!caller) return jsonResponse({ error: "Please sign in again." }, 401);
    const gymId = caller.gym_id;
    if (caller.role !== "owner") {
      return jsonResponse({ error: "You do not have permission to do this." }, 403);
    }

    const secret = Deno.env.get("QR_SECRET")!;
    const today = new Date().toISOString().slice(0, 10);

    const makePayload = async (direction: "in" | "out") => {
      const base = `${gymId}|${today}|${direction}`;
      const signature = await hmacSign(base, secret);
      return `${base}|${signature}`;
    };

    return jsonResponse({
      date: today,
      checkIn: await makePayload("in"),
      checkOut: await makePayload("out"),
    });
  } catch {
    return jsonResponse({ error: "We could not generate the QR codes right now." }, 500);
  }
});
