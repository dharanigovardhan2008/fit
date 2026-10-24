import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useInvalidateDb } from "../../api/db";
import { useToast } from "../ui/Toast";
import { verifyOnlinePayment, type CreatedCredentials } from "../../lib/backend";
import { CredentialsPanel } from "../../pages/owner/OwnerTrainers";

// After paying on Cashfree the person lands back on the app with ?cf_order=<id>.
// This confirms the payment with the server and finishes the job (create the member or renew the plan).
export function PaymentReturnHandler() {
  const { session } = useAuth();
  const invalidate = useInvalidateDb();
  const { notify } = useToast();
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!session || started.current) return;
    const orderId = new URLSearchParams(window.location.search).get("cf_order");
    if (!orderId) return;
    started.current = true;
    // Clean the address so a refresh does not run this again.
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);

    (async () => {
      try {
        const result = await verifyOnlinePayment(orderId);
        invalidate();
        if (result.status === "paid" && result.kind === "member" && result.credentials) {
          setCredentials({ ...result.credentials, name: result.name, phone: result.phone });
          notify("Payment received. Member created.");
        } else if (result.status === "paid") {
          notify("Payment received. Your plan is renewed.");
        } else if (result.status === "done") {
          notify(
            result.kind === "member"
              ? "Payment received and the member was created. Their login details are in your notifications (bell icon)."
              : "This payment was already completed.",
          );
        } else if (result.status === "processing") {
          notify("Finishing your payment. Please refresh in a moment.");
        } else if (result.status === "unpaid") {
          notify("The payment was not completed.", "error");
        } else {
          notify("The payment failed or expired. Please try again.", "error");
        }
      } catch (err) {
        notify(err instanceof Error ? err.message : "We could not confirm the payment.", "error");
      }
    })();
  }, [session, invalidate, notify]);

  return credentials ? <CredentialsPanel credentials={credentials} onClose={() => setCredentials(null)} /> : null;
}
