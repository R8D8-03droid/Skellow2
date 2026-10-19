import { useRef, useState } from 'react';
import { ArrowRight, LogOut, Store, Users } from 'lucide-react';
import type { Account } from '../backend/account';
import { Brand, Button } from './ui';
import { useAsyncAction } from '../backend/useAsyncAction';
import { WorkspaceError } from '../backend/contracts';
export default function RestaurantWelcome({ account, invited, onCreate, onAccept, onDismiss, onLogout, onBack }: {
  account: Account; invited: boolean; onCreate: (id: string, name: string) => Promise<void>;
  onAccept: () => Promise<void>; onDismiss: () => void; onLogout: () => Promise<void>; onBack?: () => void;
}) {
  const [name, setName] = useState('');
  const request = useRef({ id: crypto.randomUUID(), name: '' });
  const { pending, error, run } = useAsyncAction();
  return <main className="welcome-page">
    <header><Brand/><Button disabled={pending} variant="ghost" onClick={() => void run(onLogout)}><LogOut size={16}/>Se déconnecter</Button></header>
    <section className="welcome-layout">
      <div className="welcome-story"><Store size={34}/><h1>Une équipe.<br/>Votre établissement.<br/><span>Tout à sa place.</span></h1><p>Le planning du service, les informations de votre équipe et les bons accès pour chacun.</p><div className="welcome-signature">Skellow, à vos côtés avant le coup de feu.</div></div>
      <div className="welcome-form">
        <p className="account-email">Connecté avec {account.email}</p>
        <h2>{invited ? 'Votre équipe vous attend.' : 'Bienvenue chez vous.'}</h2>
        <p>{invited ? 'Acceptez l’invitation pour rejoindre l’établissement. Le lien est réservé à l’adresse e-mail invitée.' : 'Donnez un nom à votre établissement. Vous pourrez ensuite ajouter vos salariés et inviter les personnes qui ont besoin d’un accès.'}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {invited ? <div className="welcome-actions"><Button disabled={pending} variant="primary" onClick={() => void run(onAccept)}><Users size={17}/>{pending ? 'Ouverture…' : 'Rejoindre l’établissement'}</Button><Button disabled={pending} variant="ghost" onClick={onDismiss}>Ignorer cette invitation</Button></div> : <form onSubmit={e => { e.preventDefault(); void run(async () => { const trimmed = name.trim(); if (trimmed.length < 2) throw new WorkspaceError('Le nom de l’établissement doit contenir au moins deux caractères.'); if(request.current.name !== trimmed) request.current = { id: crypto.randomUUID(), name: trimmed }; await onCreate(request.current.id, trimmed); }); }}>
          <fieldset className="form-fields" disabled={pending}><label className="field">Nom de l’établissement<input value={name} onChange={e => setName(e.target.value)} placeholder="Le Jardin" minLength={2} maxLength={100} required autoComplete="organization" autoFocus/></label><Button variant="primary" type="submit">{pending ? 'Création…' : 'Créer mon établissement'}<ArrowRight size={17}/></Button></fieldset>
          <p className="welcome-hint">Vous êtes salarié ? Demandez un lien d’invitation au propriétaire de votre établissement.</p>
        </form>}
        {onBack && <Button variant="ghost" disabled={pending} onClick={onBack}>Retour à mon établissement</Button>}
      </div>
    </section>
  </main>;
}
