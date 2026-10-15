# Panier

Liste unique pour l'appartement, construite avec TanStack Start, React, Cloudflare Workers et D1.

## Développement local

Node.js 22.12+ et npm sont requis.

```sh
npm install
npm run dev
```

Pour tester la première connexion owner en local, copie `.dev.vars.example` vers `.dev.vars` et définis `OWNER_BOOTSTRAP_PASSWORD`. Ce fichier est ignoré par Git.

## Déploiement et première configuration

Le Worker et le binding D1 `DB` sont définis dans `wrangler.jsonc`; les migrations D1 versionnées se trouvent dans `d1/migrations/`.

Après le déploiement du code, définis une seule fois le secret de bootstrap, sans le placer dans un fichier ou un commit :

```powershell
npx.cmd wrangler secret put OWNER_BOOTSTRAP_PASSWORD
```

Saisis un mot de passe de 10 caractères minimum. Connecte-toi ensuite sur le site avec `lowan.rtn@icloud.com` et ce mot de passe : il sera hashé puis enregistré dans D1. Enfin, supprime le secret temporaire :

```powershell
npx.cmd wrangler secret delete OWNER_BOOTSTRAP_PASSWORD
```

## Vérifications

```sh
npm run build
npm run test
npx wrangler deploy --dry-run
```
