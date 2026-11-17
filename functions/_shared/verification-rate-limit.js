// Conservative two-dimensional verification throttling.
// The contact reservation is intentionally retained if the network limit blocks.
export async function reserveVerificationLimits(rateLimit, db, contactKey, ipKey) {
  const contact = await rateLimit(db, contactKey, 3, 3600);
  if (!contact.allowed) {
    return { allowed: false, scope: "email", retryAfterSeconds: contact.retryAfterSeconds };
  }

  const network = await rateLimit(db, ipKey, 10, 3600);
  if (!network.allowed) {
    return { allowed: false, scope: "network", retryAfterSeconds: network.retryAfterSeconds };
  }

  return { allowed: true };
}
