// One company credential: Neon Auth when configured, else the demo Account hash.
// Lender, borrower, and partner all share that password for the same email.
import { api } from "./api.js";
import { neonAuthEnabled, neonChangePassword } from "./neonAuth.js";

export async function changeAccountPassword({ currentPassword, newPassword }) {
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }
  if (currentPassword === newPassword) {
    throw new Error("New password must be different from the current password.");
  }
  if (neonAuthEnabled) {
    await neonChangePassword({ currentPassword, newPassword });
    return { provider: "neon" };
  }
  await api.changePassword({
    current_password: currentPassword,
    new_password: newPassword,
  });
  return { provider: "demo" };
}
