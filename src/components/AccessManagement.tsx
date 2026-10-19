import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, KeyRound, Plus, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import type { Employee } from '../types';
import type { AccessMember, MembershipRole, Restaurant, RestaurantAccess } from '../backend/account';
import { invitationLink, newInvitationToken } from '../backend/account';
import { accountRepository } from '../backend/runtime';
import { errorMessage } from '../backend/contracts';
import { useAsyncAction } from '../backend/useAsyncAction';
import { Badge, Button, EmptyState, personName } from './ui';

const roleLabel = { owner: 'Propriétaire', admin: 'Administrateur', employee: 'Salarié' };
interface Props {
  restaurant: Restaurant;
  accountId: string;
  employees: Employee[];
  onChange: (action: () => Promise<unknown>) => Promise<unknown>;
  onAddEmployee: () => void;
  notify: (message: string, tone?: 'success' | 'error') => void;
}
export default function AccessManagement({ restaurant, accountId, employees, onChange, onAddEmployee, notify }: Props) {
  const [data, setData] = useState<RestaurantAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { pending, error, run } = useAsyncAction();
  const invitation = useRef<{ fingerprint: string; token: string }>();
  const live = useRef(true);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const next = await accountRepository!.access(restaurant.id);
      if (live.current && request === generation.current) { setData(next); setLoadError(''); }
    } catch (cause) {
      if (live.current && request === generation.current) { setLoadError(errorMessage(cause)); setData(null); }
    } finally { if (live.current && request === generation.current) setLoading(false); }
  }, [restaurant.id]);
  useEffect(() => { live.current = true; void load(); return () => { live.current = false; ++generation.current; }; }, [load]);
  // A suspended membership still owns its staff record. Its access is restored
  // from the member list instead of creating another invitation for that record.
  const activeEmployees = employees.filter(e => e.active);
  const linkedEmployeeIds = new Set(data?.members.map(member => member.employee_id));
  const eligibleEmployees = data ? activeEmployees.filter(e => !linkedEmployeeIds.has(e.id)) : [];
  const selectedEmployee = eligibleEmployees.find(e => e.id === employeeId);
  const inviteEmail = role === 'employee' ? selectedEmployee?.email || '' : email.trim().toLowerCase();
  const invite = async () => {
    const fingerprint = JSON.stringify([restaurant.id, inviteEmail, role, employeeId]);
    if (invitation.current?.fingerprint !== fingerprint) invitation.current = { fingerprint, token: newInvitationToken() };
    const token = invitation.current.token;
    await onChange(() => accountRepository!.invite(restaurant.id, inviteEmail, role, role === 'employee' ? employeeId : null, token));
    invitation.current = undefined;
    if (!live.current) return;
    setLink(invitationLink(token)); setCopied(false);
    await load();
  };
  const changeMember = async (member: AccessMember, nextRole: MembershipRole, active: boolean) => {
    await onChange(() => accountRepository!.updateAccess(restaurant.id, member.user_id, nextRole, active, member.revision));
    if (live.current) { notify('Les droits ont été enregistrés.'); await load(); }
  };
  return <div className="page access-page">
    <header className="page-header"><div><h1>Les bons accès<span className="heading-dot">.</span></h1><p>Qui peut faire quoi chez {restaurant.name}.</p></div><Button variant="primary" disabled={pending} onClick={() => { setExpanded(v => !v); setLink(''); }} aria-expanded={expanded}><UserPlus size={17}/>{expanded ? 'Fermer l’invitation' : 'Inviter une personne'}</Button></header>
    <div className="access-guide"><ShieldCheck size={20}/><p><strong>Propriétaire</strong> : accès et gestion complète. <strong>Administrateur</strong> : équipe, planning et préparation de paie. <strong>Salarié</strong> : sa fiche et son planning uniquement.</p></div>
    {expanded && <section className="invite-panel" aria-label="Nouvelle invitation">
      <div><h2>Une place dans votre équipe.</h2><p>Créez un lien valable 7 jours, puis partagez-le avec la personne. Aucun e-mail n’est envoyé automatiquement.</p></div>
      <form onSubmit={e => { e.preventDefault(); void run(invite); }}>
        <fieldset disabled={pending} className="form-fields">
          <div className="invite-fields"><label className="field">Niveau d’accès<select value={role} onChange={e => { setRole(e.target.value as typeof role); setLink(''); }}><option value="employee">Salarié</option><option value="admin">Administrateur</option></select></label>
          {role === 'employee' ? <label className="field">Fiche salarié<select required value={eligibleEmployees.some(e => e.id === employeeId) ? employeeId : ''} onChange={e => { setEmployeeId(e.target.value); setLink(''); }}><option value="">Choisir un salarié</option>{eligibleEmployees.map(e => <option value={e.id} key={e.id}>{personName(e)} · {e.email}</option>)}</select></label> : <label className="field">Adresse e-mail<input type="email" required value={email} onChange={e => { setEmail(e.target.value); setLink(''); }} autoComplete="off" maxLength={254} placeholder="camille@restaurant.fr"/></label>}</div>
          {role === 'employee' && selectedEmployee && <p className="small muted">Invitation réservée à {selectedEmployee.email}.</p>}
          {role === 'employee' && !loading && data && activeEmployees.length > 0 && !eligibleEmployees.length && <p className="small muted">Toutes les fiches actives sont déjà liées à un compte. Pour rétablir un accès suspendu, utilisez la liste des comptes autorisés.</p>}
          {role === 'employee' && !activeEmployees.length ? <Button onClick={onAddEmployee}><Plus size={16}/>Créer d’abord une fiche salarié</Button> : <Button variant="primary" type="submit" disabled={!inviteEmail || loading || !data}>{pending ? 'Création…' : 'Créer le lien d’invitation'}</Button>}
        </fieldset>
      </form>
      {link && <div className="invitation-result"><label className="field">Lien à partager<input readOnly value={link} onFocus={e => e.target.select()}/></label><Button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { notify('Sélectionnez le lien pour le copier manuellement.', 'error'); } }}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Lien copié' : 'Copier le lien'}</Button><p className="small muted">La personne s’inscrit ou se connecte avec l’adresse invitée, puis accepte l’invitation.</p></div>}
    </section>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="access-section" aria-label="Comptes autorisés">
      <div className="access-section-title"><h2>Comptes autorisés {data && <span>{data.members.length}</span>}</h2><Button variant="ghost" disabled={pending || loading} onClick={() => void load()}><RefreshCw size={15}/>Actualiser</Button></div>
      {loading && <p role="status" className="access-loading">Chargement des accès…</p>}
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {data?.members.map(member => <MemberRow key={`${member.user_id}:${member.revision}`} member={member} self={member.user_id === accountId} pending={pending} onSave={(role, active) => void run(() => changeMember(member, role, active))}/>)}
    </section>
    <section className="access-section" aria-label="Invitations en attente"><div className="access-section-title"><h2>Invitations en attente {data && <span>{data.invitations.length}</span>}</h2></div>
      {data?.invitations.length === 0 && <EmptyState title="L’équipe peut s’agrandir." description="Les invitations en attente apparaîtront ici jusqu’à leur acceptation ou leur expiration."/>}
      {data?.invitations.map(invite => <div key={invite.id} className="access-row"><div className="access-person"><UserPlus size={18}/><div><strong>{invite.email}</strong><span>{roleLabel[invite.role]} · Expire le {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(invite.expires_at))}</span></div></div><Button variant="ghost" disabled={pending} onClick={() => void run(async () => { await onChange(() => accountRepository!.revokeInvitation(restaurant.id, invite.id)); if (live.current) { invitation.current = undefined; setLink(''); await load(); } })}>Révoquer l’invitation</Button></div>)}
    </section>
  </div>;
}
function MemberRow({ member, self, pending, onSave }: { member: AccessMember; self: boolean; pending: boolean; onSave: (role: MembershipRole, active: boolean) => void }) {
  const [role, setRole] = useState(member.role);
  const [active, setActive] = useState(member.active);
  const dirty = role !== member.role || active !== member.active;
  return <div className="access-row">
    <div className="access-person"><KeyRound size={18}/><div><strong>{member.email} {self && <span className="small muted">(vous)</span>}</strong><span>{!member.active ? 'Accès suspendu' : !member.available ? 'Fiche archivée ou compte indisponible' : roleLabel[member.role]}</span></div></div>
    <div className="access-controls"><label className="sr-only" htmlFor={`role-${member.user_id}`}>Rôle de {member.email}</label><select id={`role-${member.user_id}`} disabled={pending} value={role} onChange={e => setRole(e.target.value as MembershipRole)}>{member.employee_id && <option value="employee">Salarié</option>}<option value="admin">Administrateur</option><option value="owner">Propriétaire</option></select>
    <label className="access-active"><input type="checkbox" checked={active} disabled={pending} onChange={e => setActive(e.target.checked)}/>Accès actif</label>
    {dirty ? <Button disabled={pending} variant="primary" onClick={() => onSave(role, active)}>Enregistrer</Button> : <Badge tone={member.active && member.available ? 'sage' : 'stone'}>{member.active && member.available ? 'Actif' : 'Inactif'}</Badge>}</div>
  </div>;
}
