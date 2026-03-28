# JoinMe Anonymous Calls

Anonymous 1:1 browser-based audio and video calls with link-only access, no accounts, and no app-level call history.

## Why this version deploys free on Vercel

Vercel does not host long-lived custom WebSocket servers inside regular functions, so this app runs as a static Vite frontend on Vercel and uses Firebase Realtime Database for signaling and presence.

- Vercel hosts the frontend for free
- Firebase Realtime Database handles the signaling channel
- WebRTC carries the actual audio/video directly between browsers whenever possible

## Features

- 1:1 audio/video calls over WebRTC
- Link-only room creation with no signup
- Friendly pre-join flow with camera and microphone preview
- Large icon-based call controls for non-technical users
- Presence-based room lifecycle with no custom backend server
- Vercel-ready SPA routing

## Setup

1. Create a free Firebase project.
2. Turn on Realtime Database in test mode while developing.
2. Copy `.env.example` to `.env`.
3. Add your Firebase web app config values.
4. Install dependencies with `npm install`.
5. Run `npm run dev`.

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Set the Firebase `VITE_FIREBASE_*` values in the Vercel project environment variables.
4. Keep the Vercel framework preset as `Vite`.
5. Leave the build command as `npm run build`.
6. Set the output directory to `dist`.
4. Deploy.

## Notes

- The app does not record or store media.
- Realtime signaling is temporary and room presence disappears when participants leave.
- For best production connectivity, add TURN support later through a provider such as Metered or Twilio if you need stronger NAT traversal coverage.
