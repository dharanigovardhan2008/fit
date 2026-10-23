// Sends a device push when a notification row is created. Called by a database trigger.
import webpush from "npm:web-push@3.6.7";
import { adminClient } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  try {
    const { user_id, message } = await req.json();
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@opsyl.in",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );
    const admin = adminClient();
    const { data: subs } = await admin.from("push_subscription").select("*").eq("user_id", user_id);
    const payload = JSON.stringify({ title: "Opsyl Fit", body: message });
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await admin.from("push_subscription").delete().eq("id", s.id);
        }
      }),
    );
    return new Response("ok");
  } catch {
    return new Response("error", { status: 500 });
  }
});
