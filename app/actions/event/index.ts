// Barrel for the event server actions, split from the former 2.2k-line
// app/actions/event.ts into feature modules (L-3, security audit 2026-07).
// Keeps the historical "@/app/actions/event" import path working unchanged for
// app code and tests. Deliberately NOT a "use server" file: it re-exports
// types, and the authz helpers in ./shared must stay un-invocable.
export {
  verifyEventPassword,
  addRSVP,
  updateRSVP,
  deleteRsvpAsHost,
  approveRsvp,
  declineRsvp,
} from "./rsvp";
export {
  addRsvpField,
  updateRsvpField,
  deleteRsvpField,
  reorderRsvpFields,
  getRsvpFieldAnswers,
} from "./rsvpFields";
export { inviteGuest, inviteFriendAsGuest } from "./invites";
export { sendBlast, sendSmsBlast, addEventUpdate, deleteEventUpdate } from "./blasts";
export {
  createPoll,
  deletePoll,
  castVote,
  addPollOption,
  updatePollSettings,
  deletePollOption,
} from "./polls";
export { addPotluckItem, removePotluckItem, claimPotluckItem, unclaimPotluckItem } from "./potluck";
export { addComment } from "./comments";
export { addCoHost, removeCoHost } from "./cohosts";
export { addInfoSection, updateInfoSection, removeInfoSection } from "./infoSections";
export {
  saveEventField,
  saveEventLocation,
  saveEventTheme,
  saveEventSettings,
  saveEventDates,
  saveCoverImage,
  removeCoverImage,
  saveReminderSettings,
  getActiveThemePresets,
  deleteEvent,
} from "./settings";
export {
  getDashboardEvents,
  getDashboardInvites,
  getDashboardActivity,
  deleteActivityEvent,
} from "./dashboard";
export { getEventEmailPreview, sendEventEmailTest, getEventEmailTemplates } from "./emails";
export type { DashboardEvent, DashboardInvite, DashboardActivity } from "./types";
