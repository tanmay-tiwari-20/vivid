# Vivid Media Works

A responsive, single-page influencer agency demo built with **Next.js App Router, React, and strict TypeScript**. White and logo green (#1EC89A) with dark neutral text; locally hosted typography and photography; responsive creator and campaign layouts.

## Run locally

Requires Node.js 20.9 or later.

```sh
npm install
npm run dev
```

Open http://localhost:3000. For a production build:

```sh
npm run typecheck
npm run build
npm start
```

## Included

- Responsive hero with the supplied logo and interactive creator collage.
- Agency introduction and three service pillars.
- Continuous brand carousel with pause/resume and reduced-motion support.
- Swipeable reel carousel, previous/next controls, and video dialogs.
- Creator showcase and interactive strategy accordion.
- Contact dialog with brand/creator choices, required-field validation, and downloadable briefs.
- Keyboard focus management, Escape-to-close dialogs, accessible labels, and a skip link.

## Customization

- **Logo:** replace `public/images/vivid-logo-light.png`. The dark-background variant and original are preserved as `public/images/vivid-logo-dark.png` and `public/images/vivid-logo-original.png`.
- **Campaigns:** edit the typed `campaigns` data in `src/App.tsx`. Images and videos are stored under `public/`.
- **Creators, brands, services, strategy:** edit `src/Sections.tsx`.
- **Colors and main layout:** `src/styles.css`; additional section styles: `src/sections.css`.
- **Metadata:** `app/layout.tsx`.

This is a visual demonstration. Brand associations, creator names, and campaign metrics are illustrative. Photos and video footage are stock assets, not those creators or actual branded campaigns. Asset sources are documented alongside the assets.

The contact flow creates a local text download. It does not transmit or persist details. Connect an approved email or form service before using it for real enquiries. Search indexing is disabled in demo metadata; enable it when real content is ready for publication.
