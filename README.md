# Vox Mandate

Vox Mandate is a civic communication platform prototype with accounts, direct messaging, channels, groups, contacts, trending, and politician/community discussion flows.

## Local development

```cmd
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production

```cmd
npm install
npm run build
npm start
```

The Express server serves the built frontend and API on the port provided by `PORT` (default `3001` locally).

## Deploy

See `DEPLOY.md` for GitHub + Render instructions.
