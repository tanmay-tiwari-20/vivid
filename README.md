# Vivid Media Works

A responsive agency website with a private content studio, built with Next.js App Router, React, and strict TypeScript. Reels, creator profiles, and brands share one persistent content store across the home page, `/work`, and `/creators`.

## Run locally

Requires Node.js 20.9 or later. The test scripts use Node.js 22 or later.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. For production:

```sh
npm run typecheck
npm test
npm run build
npm start
```

## Private studio

Open **`/studio`** directly; it is absent from public navigation. Access is protected by a server-side password and a signed, HttpOnly session lasting 12 hours. Admin writes and uploads require a matching request origin. No password is bundled into browser code.

This workspace has a generated **`.env.local`** containing private `VIVID_ADMIN_PASSWORD` and `VIVID_SESSION_SECRET` values. Use its password to sign in. Keep that file private; it is ignored by Git. For another installation, copy `.env.example` to `.env.local`, choose a password of at least 12 characters and a random signing secret of at least 32 characters, then restart the server. Changing either value invalidates existing sessions. The studio remains locked when configuration is missing.

The studio lets an admin:

- Add, edit, delete, search, and reorder reels, creators, and brands.
- Select **Featured on home** independently from **Published** for reels and creators. Published items appear in the full collection; published featured items also appear on home. Drafts are excluded from public data.
- Upload reel videos, covers, creator images, and brand logos. All image and video fields use file uploads; new or changed media links are rejected by the server. Existing sample and previously saved media remain usable when editing other details.
- Add creator bios, category, signature line, handle, follower count, and social profile link; link reels to a creator so name changes stay consistent.
- Add brand names, categories, descriptions, logos, and website links. Published brands automatically appear in the home details grid, home marquee, and work details grid, in display order. Link reels to brands to keep their names consistent. Removing a brand preserves its reels and their brand names.
- Preview covers, retain unsaved edits, and see saving, upload, conflict, and error feedback.

The admin uses a compact content list with large touch controls. Editors have one vertical content area and a save bar that stays visible; phone editors resize with the on-screen keyboard. Optional metrics expand only when needed. Uploads show progress and accept supported mobile files even when the file picker omits their MIME type. Creator profile and brand website destinations remain editable HTTPS links.

Unsaved editor drafts are kept in this tab's session storage for up to 24 hours, so a reload or expired sign-in can restore them. Saving, discarding, or signing out clears the local draft. Network interruptions preserve edits and reload the latest saved content before another attempt; mutations are never automatically retried. If browser storage is unavailable, in-memory recovery remains available while the tab stays open.

Creator profiles open in accessible dialogs with their social link and related reels. Full collection pages include search and category filters. Home hero images use the first three published featured creators, in display order. Public pages read the latest saved content on each request; an open tab also refreshes on focus and every 30 seconds while visible.

**Media:** JPG, PNG, WebP, and GIF images up to 10 MB; MP4 and WebM videos up to 100 MB. Upload signatures and types are checked on the server. Videos support byte-range requests for seeking. New published brands require an uploaded logo. Existing sample wordmarks stay available; upload a logo before republishing one after it has become a draft. Previously saved video links retain their existing player behavior for compatibility.

## Storage and deployment

Content is written atomically to **`.data/content.json`**, with uploaded media in **`.data/media/`**. Initial sample content remains available until the first save. Revision checks prevent an older editor session from overwriting newer content; filesystem locks coordinate writes on the same volume and recover abandoned locks.

Run this version on a **Node.js server with persistent writable disk**. Set `VIVID_DATA_DIR` to an absolute mounted data directory when deploying, and back up that directory. Supply the secrets through your host's environment and serve production over HTTPS. If a reverse proxy changes the internal origin, set `VIVID_SITE_ORIGIN` to the exact public origin, such as `https://your-domain.com`.

Ephemeral serverless disks and separate server instances do not share this store. Those deployments require a shared database and object storage before deployment. Runtime data and environment files are excluded from build tracing.

## Verification

`npm test` checks actual backend validation, public draft filtering, signed sessions, origin checks, persistence, conflicting saves, stale locks, media signatures, and ranges. It also checks the admin's network failure handling, upload progress confirmation, mobile file types, and local draft recovery.

`scripts/test-cms.mjs` adds HTTP integration checks against a separate local production server. It requires a loopback `BASE_URL` (default port 3100) and `VIVID_DATA_DIR` ending in `verification`; use that same isolated directory for both the server and the test command. It temporarily changes test content, restores the original records, and leaves uploads in the test volume. Never point it at the live store. See the script's opening instructions.

## Design and existing features

Public styling lives in `src/styles.css`, `src/sections.css`, `src/content.css`, and `src/brands.css`; studio styling is in `src/admin/studio.css`. The supplied logo, local Manrope font, editorial collage, brand marquee, strategy accordion, mobile navigation, keyboard dialog controls, and reduced-motion support are preserved.

The initial creator names, brand associations, and metrics are illustrative, with stock media sources documented under `public/` and `docs/`. The studio's **Sample content** setting controls their disclosures, including the seeded brand lineup. The existing contact form creates a downloadable local brief; it does not send enquiries. Search indexing remains disabled in the demo metadata until the site is ready for publication.
