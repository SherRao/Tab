/** Query-string errors shown on /e/[token]. Producers must use these strings. */

export const EVENT_ERRORS = {
  accountNotFound: "Account not found",
  accountAlreadyInEvent: "That account is already in this event",
  nameRequired: "Name is required",
  invalidEmail: "Enter a valid email address",
  emailAlreadyInvited: "That email is already invited to this event",
  participantNotFound: "Participant not found",
  alreadyLinked: "That participant is already linked to an account",
  alreadyParticipate: "You already participate in this event",
  cannotClaim: "That participant cannot be claimed",
  onlyOwnerCanDecideClaims: "Only the event owner can decide claims",
} as const;

export const DELETE_ERROR_ONLY_OWNER = "only_owner";
export const DELETE_ERRORS = {
  [DELETE_ERROR_ONLY_OWNER]: "Only the event owner can delete this event",
} as const;

const KNOWN_EVENT_ERRORS = new Set<string>(Object.values(EVENT_ERRORS));

export function resolveEventError(
  addError?: string,
  claimError?: string,
  deleteError?: string,
): string | undefined {
  const message = addError ?? claimError;
  if (message && KNOWN_EVENT_ERRORS.has(message)) return message;
  if (deleteError && Object.hasOwn(DELETE_ERRORS, deleteError)) {
    return DELETE_ERRORS[deleteError as keyof typeof DELETE_ERRORS];
  }
  return undefined;
}
