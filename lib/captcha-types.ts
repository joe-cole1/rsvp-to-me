export const CAPTCHA_ACTIONS = [
  "signin",
  "register",
  "event_password",
  "event_create",
  "event_edit",
  "event_theme",
  "event_settings",
  "event_content",
  "rsvp_field",
  "rsvp_create",
  "rsvp_edit",
  "rsvp_moderation",
  "walkin_create",
  "comment",
  "poll_manage",
  "poll_option",
  "potluck_manage",
  "guest_invite",
  "host_invite",
  "cohost_manage",
  "message_send",
  "event_update",
  "email_test",
  "profile_edit",
  "image_upload",
  "image_assign",
] as const;

export type CaptchaAction = (typeof CAPTCHA_ACTIONS)[number];

export const CAPTCHA_RESPONSE_FIELD = "cf-turnstile-response";
export const CAPTCHA_ERROR_MESSAGE = "We couldn't verify that you're human. Please try again.";
