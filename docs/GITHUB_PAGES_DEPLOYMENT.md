# Deploying to GitHub Pages

The repository ships with `.github/workflows/deploy.yml`, which lints, type-checks, runs the unit tests, builds the
static site and publishes it with the official Pages actions (`upload-pages-artifact` + `deploy-pages`).

## One-time repository setup

1. Push the project to a GitHub repository (default branch `main`).
2. In the repository open **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Push to `main` (or run the workflow manually from **Actions → Deploy to GitHub Pages → Run workflow**).
5. When the `deploy` job finishes, the site URL appears on the job summary and under Settings → Pages,
   typically `https://<owner>.github.io/<repository>/`.

No secrets, API keys or backend configuration are needed.

## Base path

`vite.config.ts` → `resolveBasePath()`:

| Situation | Base |
| --- | --- |
| `VITE_BASE_PATH` set (repository variable or env) | that value, e.g. `/` for a custom domain |
| GitHub Actions, project site (`owner/repo`) | `/repo/` (from `GITHUB_REPOSITORY`) |
| GitHub Actions, user/org site (`owner/owner.github.io`) | `/` |
| Local development / plain builds | `/` |

To override, add a repository **variable** (Settings → Secrets and variables → Actions → Variables) named
`VITE_BASE_PATH`.

## Routing

The app uses `HashRouter`, so URLs look like `https://owner.github.io/repo/#/sales/invoices`. Direct links,
refreshes and back/forward navigation work without a `404.html` redirect trick.

## Workflow permissions

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

The deploy job uses the `github-pages` environment. Pushes to `main` and manual dispatch trigger it; concurrent
deployments are serialised.

## Verifying locally

```bash
VITE_BASE_PATH=/it-finance-demo/ npm run build
npx vite preview          # then open http://localhost:4173/it-finance-demo/
npm run test:e2e          # Playwright builds and serves under /it-finance-demo/ automatically
```
