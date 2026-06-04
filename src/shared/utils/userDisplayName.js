export const getUserDisplayName = (user = null, authorProfile = null) => {
  const email = String(user?.email || '').trim();
  const emailName = email.includes('@') ? email.split('@')[0] : email;
  const candidates = [
    authorProfile?.displayName,
    user?.displayName,
    user?.name,
    user?.pseudo,
    user?.username,
    emailName,
    email,
  ];

  return candidates
    .map((value) => String(value || '').trim())
    .find(Boolean) || 'Utilisateur';
};
