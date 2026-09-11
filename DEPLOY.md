# Deploy Vox Mandate to GitHub + Render

## 1) GitHub
Create a new GitHub repository named `vox-mandate` and upload the contents of this folder to the repository root.

## 2) Render
In Render Dashboard choose **New → Web Service**, connect the GitHub repository, and use:

- Runtime: Node
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Plan: Free (for testing)

Render should detect the `render.yaml` as well.

## 3) Important prototype note
The current auth prototype stores users and sessions in JSON files under `data/`. On a hosted service this filesystem is not a reliable permanent database. Use PostgreSQL before treating this as a production authentication system.

## 4) Public URL
After the deploy succeeds, Render gives the service a public `https://<service-name>.onrender.com` URL.
