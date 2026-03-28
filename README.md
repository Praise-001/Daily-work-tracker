# Work Journal (Next.js + TypeScript)

- Online-only: Firestore reads/writes, no localStorage/IndexedDB for app data.
- Auth: Firebase Auth with session persistence only (per-tab).
- Realtime: Firestore `onSnapshot` keeps UI in sync; refresh always pulls live data.
- Service worker: limit to static assets only (configure with Next/Workbox if desired).

## Env
Create `.env.local` with:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=...
```

## Cloudinary setup (required for image proof uploads)
Image proof uploads use Cloudinary, while app data still uses Firestore.

1. Create a Cloudinary account/project and copy your **cloud name**.
2. Create an **unsigned upload preset** in Cloudinary settings.
3. Set:
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
   - `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
4. (Recommended) Restrict the unsigned preset:
   - `resource_type: image`
   - folder restrictions
   - max file size

## Run
```
npm install
npm run dev
```
