# WhatsApp providers

The WhatsApp channel of this template is built on the Meta WhatsApp Cloud API. The table records what was
evaluated and why.

| Provider | Fit | Notes |
|---|---|---|
| Meta Cloud API | **Chosen; this project is built on it.** Recommended for a multi-client template | Direct, no per-message markup from a reseller; native n8n nodes (`WhatsApp`, `WhatsApp Trigger`); the trigger node answers Meta's webhook verification and validates the payload signature itself |
| 360dialog | Agencies without a technical onboarding person | Recommended when the agency has no technical person for onboarding |
| Twilio | Evaluated, not used - trial verification refused our number | One provider for WhatsApp + SMS + voice; the SMS verification needed to create a trial account was refused for the author's Ukrainian phone number |
| Wati / ManyChat | Not a fit for this architecture | Not used with this architecture |

## How the Meta channel is wired

- **Inbound.** `wf1-inbound` has a `WhatsApp Trigger` node next to the Telegram Trigger. Both feed `Normalize`.
  Activating the workflow makes the node register the app-level webhook subscription with Meta (callback URL =
  the node's Production URL, field `messages`) and answer Meta's verification request. Meta allows one
  subscription per app, so one `WhatsApp Trigger` per Meta app.
- **Contact id.** Meta reports the sender as digits without a plus; the bot stores the contact as
  `wa:+<digits>` and the number as `+<digits>` in `Clients.phone`.
- **Status callbacks.** Meta posts `sent`, `delivered` and `read` to the same address. They start a run that
  ends in `Normalize`.
- **Non-text messages** (image, sticker, audio, ...) get the same "I can only read text" reply as a Telegram
  sticker.
- **Outbound.** `send_message` sends free-form text (no markup, up to 1500 characters) inside the 24-hour window
  and an approved template outside it.

## Meta test-number limits

The test sender number can message at most 5 recipient numbers, each added and verified in the Meta dashboard.
The temporary token Meta shows first expires in 24 hours, so production-like use needs a permanent System User
token with the `whatsapp_business_messaging` and `whatsapp_business_management` permissions. A business can send
free-form messages only inside the 24-hour customer service window that opens when the customer writes, and
reopening it later requires an approved message template (relevant to reminders sent more than 24 hours after
the client's last message). Production requires the client's own verified WhatsApp number.
