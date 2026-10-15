# Panier

Application de liste de courses partagée, construite avec TanStack Start, React, Vite et Supabase.

## Développement local

Vous avez besoin de Node.js 22.12 ou plus récent et de npm.

```sh
git clone <repository-url>
cd list-together
npm install
npm run dev
```

## Scripts

```sh
npm run build
npm run test
npm run lint
```

## Déploiement Cloudflare Workers

Le Worker est configuré dans `wrangler.jsonc`. Les déploiements GitHub utilisent cette configuration comme source de vérité.

Avant le premier déploiement autonome, configure les variables suivantes dans Cloudflare Workers > `list-together` > Settings > Variables and Secrets :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Ajoute `SUPABASE_SERVICE_ROLE_KEY` comme secret uniquement si une route serveur utilise les opérations administrateur Supabase. N’ajoute jamais cette clé avec le préfixe `VITE_`.

Les variables `VITE_*` sont intégrées pendant le build ; les variables sans préfixe `VITE_` doivent aussi être présentes dans l’environnement d’exécution du Worker. La configuration conserve les variables définies dans le tableau de bord Cloudflare.

## Technologies

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Supabase
