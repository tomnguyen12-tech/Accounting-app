/**
 * Normalizes a card number to the masked form "4835-****-****-7498".
 * Accepts already-masked, spaced, or hyphenated 16-digit inputs.
 */
export function maskCardNumber(raw: string): { masked: string; last4: string } {
  const digits = (raw ?? "").replace(/[^0-9]/g, "");
  if (digits.length >= 8) {
    const first4 = digits.slice(0, 4);
    const last4 = digits.slice(-4);
    return { masked: `${first4}-****-****-${last4}`, last4 };
  }
  // Already masked like 4835-****-****-7498
  const m = (raw ?? "").match(/(\d{4}).*?(\d{4})\s*$/);
  if (m) return { masked: `${m[1]}-****-****-${m[2]}`, last4: m[2] };
  return { masked: raw || "UNKNOWN", last4: digits.slice(-4) || "0000" };
}
