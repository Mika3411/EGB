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

`VITE_SUPABASE_STORAGE_BUCKET` reste supporte uniquement comme fallback temporaire pour les anciens deploiements. Si cette variable legacy est la seule configuree, les uploads publics et prives retomberont sur le meme bucket, ce qui n'offre pas l'isolation attendue en production.

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

## Avertissement securite

La securite reelle ne vient pas du code frontend. Elle depend des RLS et des Storage Policies configurees dans Supabase.

Les helpers frontend comme `uploadPrivateUserFile()` aident a construire des chemins plus prudents, mais ils ne remplacent jamais les policies serveur. Tout client navigateur peut etre modifie par un utilisateur malveillant.

## Policies attendues pour `users/{userId}/...`

Les exemples suivants supposent :

- bucket prive : `escape-game-private-data`
- chemins utilisateur : `users/{auth.uid()}/...`
- utilisateurs authentifies uniquement

Adapter les policies si vos identifiants utilisateur ne correspondent pas a `auth.uid()`.

```sql
-- Lecture de ses propres fichiers prives.
create policy "Users can read their own private files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'escape-game-private-data'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Creation de fichiers dans son propre dossier.
create policy "Users can upload their own private files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'escape-game-private-data'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Remplacement volontaire de ses propres fichiers.
create policy "Users can update their own private files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'escape-game-private-data'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'escape-game-private-data'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Suppression de ses propres fichiers, seulement si l'application en a besoin.
create policy "Users can delete their own private files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'escape-game-private-data'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);
```

Pour le bucket public, autoriser la lecture publique uniquement sur `escape-game-public-assets` :

```sql
create policy "Anyone can read public assets"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'escape-game-public-assets'
);
```

Limiter l'ecriture publique aux comptes authentifies ou a une API serveur :

```sql
create policy "Authenticated users can upload public assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'escape-game-public-assets'
);
```

## Exemple `.env`

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY

# Buckets utilises par le client actuel.
VITE_SUPABASE_PUBLIC_ASSETS_BUCKET=escape-game-public-assets
VITE_SUPABASE_PRIVATE_DATA_BUCKET=escape-game-private-data

# Fallback temporaire pour anciens deploiements seulement.
VITE_SUPABASE_STORAGE_BUCKET=escape-game-private-data

# Cote serveur uniquement. Ne jamais exposer avec un prefixe VITE_.
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PUBLIC_ASSETS_BUCKET=escape-game-public-assets
SUPABASE_PRIVATE_DATA_BUCKET=escape-game-private-data

# Fallback serveur temporaire pour anciens deploiements seulement.
SUPABASE_STORAGE_BUCKET=escape-game-private-data

# Admin optionnel par email explicite. Preferer les roles Supabase.
ADMIN_EMAIL=admin@example.com
VITE_ADMIN_EMAIL=admin@example.com
```

Ne jamais placer `SUPABASE_SERVICE_ROLE_KEY` dans le code frontend ou dans une variable `VITE_*`.
