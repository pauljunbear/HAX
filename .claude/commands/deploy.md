# /deploy - Deploy to Vercel

Deploy the application to Vercel production.

## Instructions

1. First, verify the build succeeds locally:

```bash
npm run build
```

2. Check for uncommitted changes:

```bash
git status
```

3. If there are uncommitted changes, offer to commit them first (use /commit workflow).

4. Push to trigger Vercel deployment:

```bash
git push origin main
```

5. Provide the deployment URL:
   - Production: https://imhax.vercel.app (or configured domain)
   - Preview: Check Vercel dashboard

## Pre-deployment Checklist

- [ ] Build passes (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] All changes committed

## Notes

- Vercel auto-deploys on push to `main`
- Preview deployments for PRs
- Check Vercel dashboard for deployment status
