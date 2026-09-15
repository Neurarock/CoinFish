// One CoinFish company can hold several kinds of access. Role is the first
// surface they enrolled in; can_* flags are what they are allowed to open.

export function hasAccess(account, role) {
  if (!account) return false;
  if (role === "lender") return account.can_lend ?? account.role === "lender";
  if (role === "borrower") return account.can_borrow ?? account.role === "borrower";
  if (role === "partner") return Boolean(account.can_partner);
  return account.role === role;
}

export function enterPath(role) {
  if (role === "lender") return "/lender/deposit";
  if (role === "borrower") return "/borrower/collateral";
  return "/app";
}
