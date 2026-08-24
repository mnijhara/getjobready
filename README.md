# GetJobReady

AI-powered campus-to-corporate preparation platform.

## Product direction

GetJobReady helps students prepare for summer internships and full-time campus placements by combining CV/JD analysis, personalised preparation, AI mock interviews, actionable feedback, corporate-readiness skills, and AI-powered business challenges.

## Production architecture

- React + Vite frontend in `src/main.jsx`
- Shared production styling in `src/styles.css` and `src/voice.css`
- Express production server in `server.cjs`
- Gemini access stays behind the configured AI proxy in `ai-router.cjs`; Gemini keys are not shipped to the browser
- Production builds are verified by GitHub Actions and refreshed into `dist/` and `server.js`

## Deployment

The intended deployment is the GitHub → Hostinger Node.js flow used for the production site.

Use:

- Repository: `mnijhara/getjobready`
- Branch: `main`
- Node.js: 22
- Build command: `npm run build`
- Start command: `npm start`
- Application entry: `server.cjs`

The server reads the platform-provided `PORT` value. Do not hard-code a production port.

## Local verification

```bash
npm install
npm run build
node --check server.cjs
npm start
```

The production UI entrypoint is `index.html` → `/src/main.jsx`; do not switch it back to the legacy `app.js` entrypoint.
