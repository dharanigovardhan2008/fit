// Edge Function: attendance-scan (member only)
// Verifies a QR payload and GPS reading. Check-in creates an approval request (create_attendance_request),
// check-out is recorded straight away (record_attendance). Also handles GPS-only requests ({ gpsOnly: true }).
import { getCaller, hmacSign } from "../_shared/client.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { admin, caller } = await getCaller(req);
    if (!caller) return jsonResponse({ error: "Please sign in again." }, 401);
    const gymId = caller.gym_id;
    if (caller.role !== "member") {
      return jsonResponse({ error: "You do not have permission to do this." }, 403);
    }

    const { token, latitude, longitude, accuracy, gpsOnly } = await req.json();

    const member = { user_id: caller.user_id };

    // Check-in always goes through approval: the member's request waits for the trainer or owner.
    // A QR scan does not need GPS. Only a GPS-only request uses the location.
    const requestApproval = async (method: "qr_gps" | "gps_only") => {
      const useGps = method === "gps_only";
      const { data: result, error } = await admin.rpc("create_attendance_request", {
        p_member: member.user_id,
        p_method: method,
        p_lat: useGps ? latitude ?? null : null,
        p_lng: useGps ? longitude ?? null : null,
        p_accuracy: useGps ? accuracy ?? null : null,
      });
      if (error) throw error;
      if (!result?.ok) return jsonResponse({ ok: false, message: result?.error ?? "Request failed" }, 400);
      return jsonResponse({
        ok: true,
        message: "Waiting for approval",
        status: "pending",
        requestId: result.request_id,
      });
    };

    // GPS-only request: no QR code, shown to approvers with a "No QR" tag.
    if (gpsOnly === true) return await requestApproval("gps_only");

    if (!token) return jsonResponse({ error: "Invalid QR code" }, 400);

    const parts = token.split("|");
    if (parts.length !== 4) return jsonResponse({ error: "Invalid QR code" }, 400);
    const [tokenGym, tokenDate, direction, signature] = parts;

    const secret = Deno.env.get("QR_SECRET")!;
    const expectedSignature = await hmacSign(`${tokenGym}|${tokenDate}|${direction}`, secret);
    if (expectedSignature !== signature) {
      return jsonResponse({ error: "Invalid QR code" }, 400);
    }

    if (tokenGym !== gymId) {
      return jsonResponse({ error: "This QR code belongs to a different gym" }, 400);
    }

    const today = new Date().toISOString().slice(0, 10);
    if (tokenDate !== today) {
      return jsonResponse({ error: "This QR code is from another day" }, 400);
    }

    if (direction === "in") return await requestApproval("qr_gps");

    const { data: result, error } = await admin.rpc("record_attendance", {
      p_member: member.user_id,
      p_type: direction,
      p_lat: null,
      p_lng: null,
      p_method: "qr_gps",
    });
    if (error) throw error;

    const friendlyErrors: Record<string, string> = {
      "No active subscription": "You do not have an active subscription",
      "You are too far from the gym": "You are too far from the gym to check out",
      "No check-in yet today": "You have not checked in yet today",
      "Already checked out today": "You already checked out today",
    };

    const message = friendlyErrors[result] ?? result;
    const ok = result === "Checked out";
    return jsonResponse({ ok, message, status: ok ? "approved" : undefined }, ok ? 200 : 400);
  } catch {
    return jsonResponse({ error: "We could not record your attendance. Please try again." }, 500);
  }
});
