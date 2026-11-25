# Vivid Media Works

A responsive agency website with a private content studio, built with Next.js App Router, React, and strict TypeScript. Reels, creator profiles, and brands share one persistent content store across the home page, `/work`, and `/creators`.

The `/about` page introduces the agency, its creative principles, and approach, with links to the work and creator collective. Its creator imagery also reads from the shared public content store.

The `/approach` page explains the campaign process through keyboard-accessible stage tabs, practical deliverables, campaign capabilities, measurement principles, and FAQs. Its brief buttons open the shared enquiry dialog.

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
- Paste an **Instagram reel link** or upload an MP4/WebM reel video. Upload covers, creator images, and brand logos; image fields remain upload-only. Existing sample and previously saved media remain usable when editing other details.
- Add creator bios, category, signature line, handle, follower count, and social profile link; link reels to a creator so name changes stay consistent.
- Add brand names, categories, descriptions, logos, and website links. Published brands automatically appear in the home details grid, home marquee, and work details grid, in display order. Link reels to brands to keep their names consistent. Removing a brand preserves its reels and their brand names.
- Preview covers, retain unsaved edits, and see saving, upload, conflict, and error feedback.

The admin uses a compact content list with large touch controls. Editors have one vertical content area and a save bar that stays visible; phone editors resize with the on-screen keyboard. Optional metrics expand only when needed. Uploads show progress and accept supported mobile files even when the file picker omits their MIME type. Creator profile and brand website destinations remain editable HTTPS links.

Unsaved editor drafts are kept in this tab's session storage for up to 24 hours, so a reload or expired sign-in can restore them. Saving, discarding, or signing out clears the local draft. Network interruptions preserve edits and reload the latest saved content before another attempt; mutations are never automatically retried. If browser storage is unavailable, in-memory recovery remains available while the tab stays open.

Creator profiles open in accessible dialogs with their social link and related reels. Full collection pages include search and category filters. The home hero shows the first three published reels marked **Featured on home**, in the priority order set with the studio's up/down arrows: priority 1 is the main center card, priority 2 is the left card, and priority 3 is the right card. Views and reach do not change that order. Each selected reel's hero position is shown in the studio. Public pages read the latest saved content on each request; an open tab also refreshes on focus and every 30 seconds while visible.

**Instagram reels:** In `/studio`, add or edit a reel, upload its cover image, choose **Instagram link**, and paste the copied reel URL. Save with **Published** enabled to show it on `/work`; select **Featured on home** to include it on the home page. Public Instagram `/reel/`, `/reels/`, `/p/`, and `/tv/` links are supported, and share tracking parameters are removed when saving. Reels play inside an Instagram embed when opened on the website. The account must be public and allow embedding. Instagram controls playback and may require interaction or sign-in; private, deleted, or restricted posts may be unavailable. A **Watch on Instagram** link stays visible below the embed. Cards and hero artwork use the uploaded cover; the website does not automatically retrieve Instagram thumbnails. Other new external video links are rejected.

**Media:** JPG, PNG, WebP, and GIF images up to 10 MB; MP4 and WebM videos up to 100 MB. With Cloudinary configured, the server authorizes each upload and the browser sends the file directly to Cloudinary. The server verifies the stored asset's ownership, format, size, and file signature before accepting its URL. Images and videos use Cloudinary's HTTPS CDN URLs, including native video playback and seeking. New published brands require an uploaded logo. Existing sample wordmarks stay available; upload a logo before republishing one after it has become a draft. Previously saved video links retain their existing player behavior for compatibility. Every reel editor offers **Instagram link** and **Upload video**, so an existing uploaded reel can be switched to an Instagram link.

## Storage and deployment

### Cloudinary, including Vercel

1. Create or use your Cloudinary account. Copy **Cloud name**, **API key**, and **API secret** from its console into **`CLOUDINARY_CLOUD_NAME`**, **`CLOUDINARY_API_KEY`**, and **`CLOUDINARY_API_SECRET`** in `.env.local` or your hosting project's environment variables. Alternatively, set **`CLOUDINARY_URL`** to the console's `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` value. Keep the API secret server-only; never prefix it with `NEXT_PUBLIC_`.
2. Optionally set **`VIVID_CLOUDINARY_FOLDER`** to a namespace for this site; it defaults to `vivid`. Use a separate folder or account for Preview deployments that should not edit production content.
3. Set **`VIVID_ADMIN_PASSWORD`** (at least 12 characters) and **`VIVID_SESSION_SECRET`** (at least 32 random characters). Keep your existing values if studio sign-in already works.
4. Restart or redeploy the app. Sign in at `/studio`, upload an image and an MP4/WebM video, save, and check the public pages. Also save a reel with a public Instagram link and check its embed and **Watch on Instagram** link. Reload the studio to confirm saved content remains available.

No unsigned upload preset is needed. The server signs each upload for a unique media asset in the configured folder, and the browser uploads directly to Cloudinary. Only small authorization and verification requests pass through the app. These [direct Cloudinary uploads](https://cloudinary.com/documentation/upload_images#uploading_with_a_direct_call_to_the_rest_api) bypass Vercel's **4.5 MB** function request-body limit while retaining the app's 10 MB image and 100 MB video limits. Cloudinary account limits also apply.

Cloudinary stores media under **`vivid/media/`** and studio content as authenticated raw JSON snapshots such as **`vivid/content/000000000001.json`** (or your configured namespace). Each save creates the next immutable snapshot, retaining earlier versions. Signed server requests read the latest content directly without relying on a search index; public pages receive only published records through the app. Content revisions and writes with `overwrite: false` reject conflicting saves across server instances. Keep the numbered content snapshots intact: deleting, renaming, or overwriting individual snapshots can break revision discovery. Each snapshot is limited to 8 MB. The API secret never reaches the browser. Uploaded media is public through Cloudinary's CDN; publishing controls which records the website displays. No local disk is needed on Vercel. Without Cloudinary credentials, public sample content still renders on Vercel, but studio saves and uploads report a configuration error.

To work with saved local content while Cloudinary is configured, set **`VIVID_STORAGE_MODE=local`** in `.env.local` and restart the server. This uses `.data/content.json` and `.data/media/` (or `VIVID_DATA_DIR`). Remove that setting to resume Cloudinary access. Vercel deployments ignore the local override and require Cloudinary.

An empty Cloudinary namespace starts with sample content until its first save. Existing content and uploads are not transferred automatically when changing providers. Before switching a deployed site, back up its content and original media, then upload the media to Cloudinary and restore the records with the new URLs. The Vercel Blob integration has been removed, so old `/api/media/` links backed by a Blob store need replacement. Existing local `.data` media continues to work in local mode. Back up Cloudinary content and media independently of deployments.

### Persistent Node.js server

Without Cloudinary credentials, or with the explicit local override, content is written atomically to **`.data/content.json`**, with uploaded media in **`.data/media/`**. Revision checks prevent an older editor session from overwriting newer content; filesystem locks coordinate writes on the same volume and recover abandoned locks. Partially supplied Cloudinary credentials report a configuration error.

Use a **Node.js server with persistent writable disk** for this local storage mode. Set `VIVID_DATA_DIR` to an absolute mounted data directory when deploying, and back up that directory. Supply the secrets through your host's environment and serve production over HTTPS. If a reverse proxy changes the internal origin, set `VIVID_SITE_ORIGIN` to the exact public origin, such as `https://your-domain.com`. The reverse proxy must allow request bodies of at least 101 MB for 100 MB videos plus multipart overhead (for example, nginx `client_max_body_size 110m;`).

Runtime data and environment files are excluded from build tracing. Ephemeral serverless disks and separate server instances do not share the local store; configure Cloudinary for those deployments.

## Verification

`npm test` checks actual backend validation, public draft filtering, signed sessions, origin checks, persistence, conflicting saves, stale locks, media signatures, and local video ranges. Cloudinary tests use controlled storage responses to check signed upload authorization, asset ownership, size and format limits, signature verification, private content, and save conflicts. Browser tests check direct file transfer, upload progress confirmation, mobile file types, network failures, and local draft recovery. Instagram tests check supported links, URL normalization, embedded playback, and fallback links.

`scripts/test-cms.mjs` adds HTTP integration checks against a separate local production server. It requires a loopback `BASE_URL` (default port 3100) and `VIVID_DATA_DIR` ending in `verification`; use that same isolated directory for both the server and the test command. It temporarily changes test content, restores the original records, and leaves uploads in the test volume. Never point it at the live store. See the script's opening instructions.

## Design and existing features

Public styling lives in `src/styles.css`, `src/sections.css`, `src/content.css`, and `src/brands.css`; studio styling is in `src/admin/studio.css`. The supplied logo, local Manrope font, editorial collage, brand marquee, strategy accordion, mobile navigation, keyboard dialog controls, and reduced-motion support are preserved.

The initial creator names, reel brand associations, and metrics are illustrative, with stock media sources documented under `public/` and `docs/`. The default brand directory contains the configured 19-brand lineup with bundled logos and website links; logo sources are recorded in `docs/brand-logo-sources.json`. The studio's **Sample content** setting controls individual record disclosures. The contact dialog provides direct email and phone links. Search indexing remains disabled in the demo metadata until the site is ready for publication.
