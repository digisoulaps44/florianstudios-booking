# Empty starter project

Set up a clean, blank starting point so the preview loads a real page instead of the template placeholder.

## What you'll see
- The preview opens to a simple, empty page with a short "Ready to build" heading.
- No extra pages, data, sign-in, or backend.

## Technical details
- Rewrite `src/routes/index.tsx`: remove the placeholder image, render a minimal centered heading using existing theme tokens.
- Give the home page its own head() (title, description, og:title, og:description, og:type, twitter:card).
- Replace the "Lovable App" placeholder title/description in `src/routes/__root.tsx` with neutral project values.
