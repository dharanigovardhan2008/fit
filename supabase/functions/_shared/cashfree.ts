// Small helper for the Cashfree Payment Gateway API. Uses the test (sandbox) servers unless
// the CASHFREE_ENV secret is set to "production".
export function cashfreeConfig() {
  const appId = Deno.env.get("CASHFREE_APP_ID");
  const secret = Deno.env.get("CASHFREE_SECRET_KEY");
  const production = (Deno.env.get("CASHFREE_ENV") ?? "sandbox").toLowerCase() === "production";
  if (!appId || !secret) return null;
  return {
    production,
    base: production ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": "2023-08-01",
      "x-client-id": appId,
      "x-client-secret": secret,
    },
  };
}
