const sessionMaxAgeSeconds = 30 * 24 * 60 * 60;

export function persistAccountCookies() {
  if (typeof document === "undefined") return;
  // Identity rewrites these as session cookies after login and token refresh.
  // Retain only existing cookies; token validity is still checked by Identity.
  for (const cookie of document.cookie.split(";")) {
    const entry = cookie.trim();
    const separator = entry.indexOf("=");
    const name = entry.slice(0, separator);
    if ((name === "nf_jwt" || name === "nf_refresh") && entry.slice(separator + 1)) {
      document.cookie = `${entry}; Path=/; Secure; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}`;
    }
  }
}
