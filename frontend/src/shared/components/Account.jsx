// Account security — password change for the shared company credential.
import Layout from "../../shared/components/Layout.jsx";
import ChangePasswordForm from "../../shared/components/ChangePasswordForm.jsx";
import { useAuth } from "../../shared/store.jsx";
import { neonAuthEnabled } from "../../shared/neonAuth.js";

export default function Account({ role }) {
  const { account } = useAuth();

  return (
    <Layout role={role}>
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--fg-soft)" }}>
            Signed in as <strong style={{ color: "var(--fg)" }}>{account?.email || "—"}</strong>
            {account?.company_name ? <> · {account.company_name}</> : null}
          </p>
        </div>

        <section className="card space-y-4 p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Change password</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--fg-soft)" }}>
              {neonAuthEnabled
                ? "Updates your Neon Auth password. The same password signs you into lender, borrower, and partner."
                : "Updates the password for this company account across lender, borrower, and partner."}
            </p>
          </div>
          <ChangePasswordForm />
        </section>
      </div>
    </Layout>
  );
}
