import type { UserValidateEvent, UserSignupEvent } from "@netlify/functions";
import { isAdminEmail } from "../../lib/shared.js";

// Only the addresses listed in ADMIN_EMAILS (default: the shop's e-mail) can create an account.
// Those accounts receive the "admin" role; it takes effect on their next login or token refresh.
export default {
  userValidate(event: UserValidateEvent) {
    if (!isAdminEmail(event.user.email)) return event.deny();
  },
  userSignup(event: UserSignupEvent) {
    if (!isAdminEmail(event.user.email)) return;
    const roles = Array.from(new Set([...((event.user.appMetadata?.roles as string[]) || []), "admin"]));
    return { user: { ...event.user, appMetadata: { ...event.user.appMetadata, roles } } };
  },
};
