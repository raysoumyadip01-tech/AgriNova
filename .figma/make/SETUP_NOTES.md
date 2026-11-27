# Initial import setup

## Verified

- Added executable `install` and `dev` lifecycle scripts.
- Installation uses `npm ci` with the existing npm lockfile.
- Development runs the existing Express/Vite application with Figma's `PORT`.
- `figma make verify-bootstrap` passed preflight, install, and dev startup.
- Added dependency-install and server-config restart triggers.

## Deployment requires a hosting decision

The application needs `server.ts` for authentication, API endpoints, and a
writable SQLite database. Vite's `dist` directory contains only the frontend;
deploying it alone would break core application features.

`figma make verify-deploy-preview --skip` returned `state: skipped`.
`figma make verify-deploy` reported the missing deploy script. No static deploy
script was generated because it would misrepresent full application support.

Before configuring publishing, confirm either:

1. A Node hosting environment with persistent writable storage for the existing
   Express/SQLite application; or
2. A separately hosted API and its public base URL for a static frontend.

Do not replace the deployment adapter or alter application architecture without
confirmation.

## Integration and compatibility caveats

- `GEMINI_API_KEY` was requested through the secure environment input card.
  Submission and credential validity have not been confirmed. FoodBot and
  server-side transcription require it; startup success does not verify it.
- Install succeeded on the existing Node 22 toolchain, but Firebase packages
  reported a Node >=24.12.0 requirement. Resolve the toolchain compatibility
  warning before production use.
- Startup also reported Vite configuration deprecations. Application and
  framework source files were left unchanged.
