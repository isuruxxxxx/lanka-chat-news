# Lanka Chat feeds

Hourly data for the Lanka Chat room (https://lanka-chat-room.blogspot.com):
- `news.json` — Google News headlines for Sri Lanka, English + Sinhala, 6 categories.
- `live.json` — which of the 7 Sri Lankan TV channels is live on YouTube right now (live video ID, or null).

Updated by the `Update Lanka Chat feeds` GitHub Action every hour. The chat page
fetches these files directly from raw.githubusercontent.com — no key, no relay.
