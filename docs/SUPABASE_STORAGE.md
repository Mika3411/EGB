# Supabase Storage

Cette application stocke deux familles de fichiers qui ne doivent pas avoir les memes garanties d'acces.

## Public vs prive

Les fichiers publics sont faits pour etre lus directement par le navigateur via une URL publique. Exemples typiques :

- images partagees publiquement
- assets de boutique
- apercus qui ne contiennent aucune donnee sensible

Les fichiers prives doivent rester proteges par Supabase Storage Policies. Exemples typiques :

- sauvegardes de projets utilisateur
- fichiers JSON sous `users/{userId}/...`
- donnees de compte ou donnees non publiees

Un fichier prive ne doit pas etre expose avec `getPublicUrl()`. Utiliser des signed URLs ou une API serveur si un acces temporaire est necessaire.

## Buckets recommandes

Le module `src/supabaseStorage.ts` utilise maintenant deux buckets separes :

- `escape-game-public-assets`
- `escape-game-private-data`

Configuration recommandee :

- `escape-game-public-assets` : bucket public, lecture publique autorisee, ecriture limitee aux utilisateurs authentifies ou au serveur.
- `escape-game-private-data` : bucket prive, aucune lecture publique, acces limite au prefixe `users/{userId}/...`.

Cette separation reduit le risque d'exposer par erreur des sauvegardes privees dans un bucket public.

`VITE_SUPABASE_STORAGE_BUCKET` et `SUPABASE_STORAGE_BUCKET` restent supportes uniquement comme fallback temporaire pour les anciens deploiements. Si une variable legacy est utilisee parce qu'un bucket explicite manque, le runtime affiche un warning `[supabase-storage]` unique. Le warning ne contient pas la valeur du bucket.

Pour les nouvelles installations, ne configurez pas les variables legacy. Cote serveur, aucun bucket historique implicite n'est choisi si les variables explicites et legacy sont absentes.

Comportement runtime :

- `visibility: "public"` utilise `VITE_SUPABASE_PUBLIC_ASSETS_BUCKET`, avec `VITE_SUPABASE_STORAGE_BUCKET` comme fallback legacy si le bucket public n'est pas configure.
- `visibility: "private"` utilise `VITE_SUPABASE_PRIVATE_DATA_BUCKET`, avec `VITE_SUPABASE_STORAGE_BUCKET` comme fallback legacy si le bucket prive n'est pas configure.
- Cote serveur, `SUPABASE_PUBLIC_ASSETS_BUCKET` et `SUPABASE_PRIVATE_DATA_BUCKET` sont lus en priorite, puis les variantes `VITE_*`, puis `SUPABASE_STORAGE_BUCKET` / `VITE_SUPABASE_STORAGE_BUCKET` en fallback legacy.
- Les jobs IA, les sauvegardes utilisateur et le manifeste boutique complet utilisent le bucket prive. L'index `public/projects.json` utilise le bucket public.
- `uploadPublicAsset()` force le bucket public.
- `uploadPrivateUserFile()` force le bucket prive sous `users/{userId}/...`.
- `downloadTextFile(path, { visibility: "public" })` lit dans le bucket public.
- `downloadTextFile(path, { visibility: "private" })` lit dans le bucket prive.
- `downloadTextFile(path, { bucket })` permet un bucket explicite pour les cas controles.

## Migration SQL

La migration [supabase/20260529_storage_buckets.sql](../supabase/20260529_storage_buckets.sql) cree ou met a jour les deux buckets recommandes et recree les policies `storage.objects` attendues.

Etapes d'application :

1. Ouvrir `supabase/20260529_storage_buckets.sql`.
2. Si vos variables d'environnement utilisent d'autres noms de buckets, modifier les deux fonctions SQL `escape_game_public_assets_bucket_id()` et `escape_game_private_data_bucket_id()` en haut du fichier avant execution. Supabase SQL ne lit pas directement les variables env Render/Netlify/Vite.
3. Executer le fichier dans le SQL Editor Supabase, ou l'integrer a votre flux Supabase CLI.
4. Verifier que les variables de deploiement pointent vers les memes buckets : `VITE_SUPABASE_PUBLIC_ASSETS_BUCKET`, `VITE_SUPABASE_PRIVATE_DATA_BUCKET`, `SUPABASE_PUBLIC_ASSETS_BUCKET`, `SUPABASE_PRIVATE_DATA_BUCKET`.
5. Laisser `VITE_SUPABASE_STORAGE_BUCKET` et `SUPABASE_STORAGE_BUCKET` non configurees sauf rollback legacy temporaire.

Verification utile apres execution :

```sql
select id, name, public
from storage.buckets
where id in ('escape-game-public-assets', 'escape-game-private-data')
order by id;

select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'Escape game%'
order by policyname;
```

## Avertissement securite

La securite reelle ne vient pas du code frontend. Elle depend des RLS et des Storage Policies configurees dans Supabase.

Les helpers frontend comme `uploadPrivateUserFile()` aident a construire des chemins plus prudents, mais ils ne remplacent jamais les policies serveur. Tout client navigateur peut etre modifie par un utilisateur malveillant.

## Policies appliquees

La migration suppose :

- bucket public : `escape-game-public-assets`
- bucket prive : `escape-game-private-data`
- chemins utilisateur : `users/{auth.uid()}/...`
- chemins generes par `buildStoragePath('users', userId, ...)`

Les policies creent ces garanties :

- Lecture publique : autorisee pour `anon` et `authenticated` uniquement sur `escape-game-public-assets`.
- Upload/update/delete publics : autorises seulement aux utilisateurs authentifies, uniquement sous `users/{auth.uid()}/...`.
- Lecture/insert/update/delete prives : autorises seulement aux utilisateurs authentifies, uniquement sous `users/{auth.uid()}/...` dans `escape-game-private-data`.
- Chemins refuses : chemins avec slash initial/final, `//`, segment `.` ou `..`, caracteres hors `[A-Za-z0-9._/-]`, ou sans fichier final.

La condition SQL centrale verifie :

```sql
(storage.foldername(name))[1] = 'users'
and (storage.foldername(name))[2] = auth.uid()::text
```

Cela correspond aux chemins produits par `buildStoragePath('users', userId, ...)`, par exemple `users/00000000-0000-0000-0000-000000000000/projects/project-1.json`.

Les objets publics globaux comme `public/projects.json` doivent etre ecrits par le serveur avec la service role, pas directement par le navigateur. La service role contourne les RLS Supabase ; elle doit rester strictement cote serveur.

## Exemple `.env`

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY

# Buckets utilises par le client actuel.
VITE_SUPABASE_PUBLIC_ASSETS_BUCKET=escape-game-public-assets
VITE_SUPABASE_PRIVATE_DATA_BUCKET=escape-game-private-data

# Fallback temporaire pour anciens deploiements seulement. Laisser unset sinon.
# VITE_SUPABASE_STORAGE_BUCKET=escape-game-private-data

# Cote serveur uniquement. Ne jamais exposer avec un prefixe VITE_.
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PUBLIC_ASSETS_BUCKET=escape-game-public-assets
SUPABASE_PRIVATE_DATA_BUCKET=escape-game-private-data

# Fallback serveur temporaire pour anciens deploiements seulement. Laisser unset sinon.
# SUPABASE_STORAGE_BUCKET=escape-game-private-data

# Admin optionnel par email explicite. Preferer les roles Supabase.
ADMIN_EMAIL=admin@example.com
VITE_ADMIN_EMAIL=admin@example.com
```

Ne jamais placer `SUPABASE_SERVICE_ROLE_KEY` dans le code frontend ou dans une variable `VITE_*`.
