export const PLACEHOLDER_CONTACT_EMAIL = "contact@example.com";

const CONTACT_EMAIL_VALUE = "jd2cv.admin@gmail.com";

// Compile-time guard: resolves to `never` when the address is the placeholder (any case),
// so assigning it to CONTACT_EMAIL fails `tsc` and therefore `pnpm build`.
type NotPlaceholder<T extends string> =
  Lowercase<T> extends Lowercase<typeof PLACEHOLDER_CONTACT_EMAIL> ? never : T;

export const CONTACT_EMAIL: NotPlaceholder<typeof CONTACT_EMAIL_VALUE> = CONTACT_EMAIL_VALUE;

export function isReleaseReady(email: string): boolean {
  const v = email.trim().toLowerCase();
  return v.includes("@") && v !== PLACEHOLDER_CONTACT_EMAIL;
}
