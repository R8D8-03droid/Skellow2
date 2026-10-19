export type MembershipRole = 'owner' | 'admin' | 'employee';
export interface Restaurant { id: string; name: string; role: MembershipRole }
export interface Account { id: string; email: string; name: string }
export interface AccessMember { user_id: string; email: string; role: MembershipRole; employee_id: string | null; active: boolean; available: boolean; revision: number }
export interface Invitation { id: string; email: string; role: 'admin' | 'employee'; employee_id: string | null; expires_at: string }
export interface RestaurantAccess { members: AccessMember[]; invitations: Invitation[] }

// Invitation is a capability bound server-side to a verified email. Strip it from
// the address bar before rendering; retain it across the auth redirect in this tab.
const invitationKey = 'skellow:pending-invitation';
export function readInvitation(): string | null {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('invite');
  if (token && /^[a-f0-9]{64}$/.test(token)) sessionStorage.setItem(invitationKey, token);
  if (url.searchParams.has('invite')) { url.searchParams.delete('invite'); history.replaceState(null, '', url); }
  return sessionStorage.getItem(invitationKey);
}
export function clearInvitation() { sessionStorage.removeItem(invitationKey); }
export function authRedirect(recovery = false): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  if (recovery) url.searchParams.set('flow', 'recovery');
  const token = sessionStorage.getItem(invitationKey);
  if (token) url.searchParams.set('invite', token);
  return url.toString();
}
export function invitationLink(token: string): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set('invite', token);
  return url.toString();
}
export function newInvitationToken(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join(''); }
