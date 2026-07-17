# Render build fix

This version pins Node.js to 20.19.5 to avoid the npm `Exit handler never called!` failure seen with Node.js 22.22.0.

Changed files:

- `web/.node-version`
- `web/package.json`
- `web/package-lock.json`
- `render.yaml`

After pushing these files to the `main` branch, Render should automatically start a new deploy. If it does not, use **Manual Deploy → Deploy latest commit** in the Render dashboard.
