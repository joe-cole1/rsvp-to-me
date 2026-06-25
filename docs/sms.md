# SMS Setup Guide (Twilio)

SMS messaging in rsvp-to-me is powered by Twilio and is entirely optional. This guide walks you through creating a Twilio account, acquiring a phone number, and connecting it to your installation.

---

## Table of Contents

1. [What SMS Enables](#what-sms-enables)
2. [What You Need](#what-you-need)
3. [Step 1 — Create a Twilio Account](#step-1--create-a-twilio-account)
4. [Step 2 — Get a Phone Number](#step-2--get-a-phone-number)
5. [Step 3 — Find Your Credentials](#step-3--find-your-credentials)
6. [Step 4 — Configure rsvp-to-me](#step-4--configure-rsvp-to-me)
7. [Testing SMS](#testing-sms)
8. [Trial Account Limitations](#trial-account-limitations)
9. [Costs](#costs)
10. [Disabling SMS](#disabling-sms)
11. [Troubleshooting](#troubleshooting)

---

## What SMS Enables

Without SMS configured, the app works entirely through email. With Twilio connected, you gain:

| Feature                         | Description                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Magic Link Sign-In via Text** | Users can sign in by entering their phone number instead of email.                                               |
| **SMS Invitations**             | Send event invitations directly to guest phone numbers.                                                          |
| **RSVP Confirmations**          | Guests receive an automated text confirming their Going/Maybe status.                                            |
| **Host RSVP Alerts**            | Hosts receive a text when a guest RSVPs, including the guest's name, status, note, and a link to the guest list. |
| **Approval Notifications**      | Guests receive updates when their RSVPs are approved/declined.                                                   |
| **Event Update Blasts**         | Send immediate text notifications to all Going/Maybe guests.                                                     |
| **Automated Reminders**         | Schedule text reminders 7 days, 1 day, or N hours before the event.                                              |

Each user can control their own notification preferences (Email vs SMS) in their Profile. Hosts can also toggle each notification type individually per event under **Event Settings → RSVP Options → Notification Settings**.

---

## What You Need

- A Twilio account (a free trial is available).
- A credit card (to verify identity, even on free trial accounts).
- A Twilio phone number with SMS capabilities (~$1.15/month in the US).

---

## Step 1 — Create a Twilio Account

1. Go to [Twilio Signup](https://www.twilio.com/try-twilio).
2. Fill in your name, email, and choose a password.
3. Verify your email address by clicking the verification link sent to your inbox.
4. Verify your personal phone number by entering the verification code sent via SMS.
5. Answer the developer onboarding questions (any answers work; they just customize your dashboard view).

Your new trial account starts with approximately $15.00 in free credit.

---

## Step 2 — Get a Phone Number

Trial accounts include one free phone number. To purchase one:

1. Go to your [Twilio Console](https://console.twilio.com).
2. Look for the **Get a Twilio phone number** button on the home page, or navigate to **Phone Numbers** > **Manage** > **Buy a number** in the left sidebar.
3. Choose your country.
4. Under **Capabilities**, check the **SMS** box.
5. Click **Search** and select a number from the list.
6. Click **Buy** (it will use your free trial credit).
7. Note down the phone number in E.164 format.

### E.164 Phone Format

E.164 means: `+` country code + full phone number, with no spaces, dashes, or parentheses.

| Country        | Display Format   | E.164 Format    |
| -------------- | ---------------- | --------------- |
| USA / Canada   | `(555) 867-5309` | `+15558675309`  |
| United Kingdom | `07911 123456`   | `+447911123456` |
| Australia      | `0412 345 678`   | `+61412345678`  |

---

## Step 3 — Find Your Credentials

Your account keys are displayed on your Twilio Console home page under the **Account Info** section.

1. **Account SID**: A unique identifier starting with `AC` (e.g. `ACyour_account_sid_here`).
2. **Auth Token**: Click the eye icon (👁) to reveal your authentication token.
3. **Phone Number**: Your E.164 formatted Twilio phone number.

> **Warning:** Your Auth Token grants complete access to your Twilio account billing. Keep it private and never share it.

---

## Step 4 — Configure rsvp-to-me

Add the three Twilio configuration variables to your `.env` file:

```env
TWILIO_ACCOUNT_SID="ACyour_account_sid_here"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_PHONE_NUMBER="+15558675309"
```

Restart your container to load the environment changes:

```bash
docker compose restart app
```

---

## Testing SMS

You can test your connection directly from the Admin Panel:

1. Log in to the application as an `ADMIN` user.
2. Navigate to `/admin` and select the **System Configuration** tab.
3. Under the SMS settings panel, click **Send Test SMS**.
4. Type your verified phone number (in E.164 format) and click Send.
5. Verify that the text message arrives.

_Note: If using a trial account, you can only send test messages to verified caller IDs (see below)._

---

## Trial Account Limitations

Twilio trial accounts have two main restrictions:

### 1. Send Only to Verified Numbers

You can only send SMS messages to phone numbers that you have explicitly verified in your Twilio Console.

- To verify a number, go to **Phone Numbers** > **Verified Caller IDs** > [Add a Verified Caller ID](https://console.twilio.com/us1/account/verified-caller-ids/add).
- Enter the phone number and input the code Twilio sends to verify it.

### 2. Trial Account Watermark

All SMS messages sent from a trial account will begin with:
`Sent from your Twilio trial account - `

### Upgrading your Account

To remove both restrictions, click **Upgrade Project** at the top of the Twilio Console and add a credit card. Your remaining trial credit will carry over.

---

## Costs

Twilio bills on a per-message usage model.

- **US Phone Number Rent:** ~$1.15 per month.
- **Outbound SMS (US):** ~$0.0079 per message.
- **Outbound SMS (International):** Varies by country.

For an event with 30 guests receiving 2 text alerts, the estimated SMS cost is under $0.50.
For the latest pricing, see the [Twilio SMS Pricing Page](https://www.twilio.com/en-us/sms/pricing/us).

---

## Disabling SMS

To return to email-only mode, clear the three Twilio variables in your `.env` file:

```env
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
```

Restart your container:

```bash
docker compose restart app
```

---

## Troubleshooting

### "Authentication Error" / Code 20003

Your `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN` is incorrect. Recopy both values carefully from your Twilio Console.

### "Invalid From Phone Number" / Code 21606

The phone number set in `TWILIO_PHONE_NUMBER` is not formatted correctly, or is not owned by your Twilio account. Make sure it uses E.164 format and appears in your Active Numbers list.

### "Unverified Number" / Code 21608

You are trying to send a text to a guest's number on a trial account. You must verify their number in the Verified Caller IDs console first, or upgrade to a paid account.

### Messages are not arriving

- Check the Twilio Console **Monitor** > **Logs** > **Messaging** to check for delivery errors.
- Confirm that the recipient's phone number contains a country code in their Profile settings.
