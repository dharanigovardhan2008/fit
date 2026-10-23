import { useState } from "react";
import { resetDemoData } from "../../lib/backend";

// Development-only diagnostics page. Not linked from any navigation and excluded from production
// routing in App.tsx (only mounted when import.meta.env.DEV is true).
export default function DevTestPage() {
  const [message, setMessage] = useState("");

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-4 text-xl font-semibold">Local data tools</h1>
      <p className="mb-4 text-sm text-text-secondary">
        This page only exists in development builds. Use it to reset the local demo database.
      </p>
      <button
        type="button"
        className="rounded-xl bg-ink px-4 py-2 text-sm text-white"
        onClick={() => {
          resetDemoData();
          setMessage("Local data cleared. Reload the page to generate a fresh demo gym.");
        }}
      >
        Reset demo data
      </button>
      {message && <p className="mt-4 text-sm text-success">{message}</p>}
    </div>
  );
}
