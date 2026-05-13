import './config.js';
import { getSupabaseAdminClient } from './supabase.js';

export const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
export const ADMIN_EMAIL = normalizeEmail(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || '');

const normalizeRole = (value = '') => String(value).trim().toLowerCase();
const hasTruthyAdminFlag = (value) => value === true || /^(1|true|yes)$/i.test(String(value || ''));
const getMetadataRoles = (metadata = {}) => {
  const roles = Array.isArray(metadata.roles)
    ? metadata.roles
    : typeof metadata.roles === 'string'
      ? metadata.roles.split(/[,\s]+/)
      : [];
  return [...roles, metadata.role].map(normalizeRole).filter(Boolean);
};

export const isConfiguredAdminEmail = (email = '') => Boolean(
  ADMIN_EMAIL && normalizeEmail(email) === ADMIN_EMAIL,
);

export const getBearerToken = (req) => {
  const authorization = req.headers.authorization || '';
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  return String(value).replace(/^Bearer\s+/i, '').trim();
};

export const isAdminUser = (user = {}) => {
  const metadata = {
    ...(user.app_metadata || {}),
    ...(user.user_metadata || {}),
  };
  return Boolean(
    hasTruthyAdminFlag(metadata.isAdmin)
    || hasTruthyAdminFlag(metadata.is_admin)
    || getMetadataRoles(metadata).includes('admin')
    || isConfiguredAdminEmail(user.email),
  );
};

export const verifySupabaseAdminRequest = async (req) => {
  const client = getSupabaseAdminClient();
  if (!client) {
    const error = new Error('Configuration Supabase admin manquante.');
    error.status = 500;
    throw error;
  }

  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Session admin manquante.');
    error.status = 401;
    throw error;
  }

  const { data, error } = await client.auth.getUser(token);
  const user = data.user || null;
  if (error || !user) {
    const accessError = new Error('Session admin invalide.');
    accessError.status = 401;
    throw accessError;
  }

  user.isAdmin = isAdminUser(user);
  if (!user.isAdmin) {
    const accessError = new Error('Acces admin refuse.');
    accessError.status = 403;
    throw accessError;
  }

  return user;
};

export const verifySupabaseUserRequest = async (req) => {
  const client = getSupabaseAdminClient();
  if (!client) {
    const error = new Error('Configuration Supabase manquante.');
    error.status = 500;
    throw error;
  }

  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Session manquante.');
    error.status = 401;
    throw error;
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.id) {
    const accessError = new Error('Session invalide.');
    accessError.status = 401;
    throw accessError;
  }

  return data.user;
};
