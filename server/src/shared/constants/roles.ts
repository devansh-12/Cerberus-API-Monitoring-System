export const ROLES = ['super_admin', 'client_admin', 'client_viewer'] as const;
export type Role = (typeof ROLES)[number];

export const CLIENT_ROLES = ['client_admin', 'client_viewer'] as const;
export type ClientRole = (typeof CLIENT_ROLES)[number];

export const APPLICATION_ROLES = {
  SUPER_ADMIN: 'super_admin',
  CLIENT_ADMIN: 'client_admin',
  CLIENT_VIEWER: 'client_viewer',
} as const;
export type ApplicationRole = (typeof APPLICATION_ROLES)[keyof typeof APPLICATION_ROLES];

export const isValidClientRole = (role: string): role is ClientRole =>
  (CLIENT_ROLES as readonly string[]).includes(role);

export const isValidRole = (role: string): role is Role =>
  (ROLES as readonly string[]).includes(role);
