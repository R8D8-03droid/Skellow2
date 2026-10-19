import { FormEvent, useState, useEffect } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Moon,
  Users,
} from "lucide-react";
import { accountRepository } from "../backend/runtime";
import { useAsyncAction } from "../backend/useAsyncAction";
import { Brand, Button, IconButton } from "./ui";
export default function Login({
  mode,
  onLogin,
  onRegister,
  onRecover,
  recovery = false,
  recoveryRequested = false,
  onCancelRecovery,
  invited = false,
}: {
  mode: "demo" | "supabase";
  onRegister?: (name: string, email: string, password: string) => Promise<boolean>;
  onRecover?: (password: string) => Promise<void>;
  recovery?: boolean;
  recoveryRequested?: boolean;
  onCancelRecovery?: () => void;
  invited?: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [view, setView] = useState<'login' | 'signup' | 'reset'>(recoveryRequested && !recovery ? "reset" : "login");
  const [name, setName] = useState('');
  const [notice, setNotice] = useState(() => (recoveryRequested && !recovery) || new URLSearchParams(location.hash.slice(1)).has('error') ? 'Le lien de connexion a expiré ou est invalide. Demandez un nouveau lien.' : '');
  const [google, setGoogle] = useState(false);
  useEffect(() => { let live = true; void accountRepository?.googleAvailable().then(enabled => { if(live) setGoogle(enabled); }); return () => { live = false; }; }, []);
  const changeView = (next: typeof view) => { if (recoveryRequested) onCancelRecovery?.(); setView(next); setError(''); setNotice(''); setPassword(''); };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const { pending, error, setError, run } = useAsyncAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (recovery) { await onRecover?.(password); return; }
      if (view === 'signup') {
        const signedIn = await onRegister?.(name, email, password);
        if (!signedIn) { setNotice('Si cette adresse peut être inscrite, un e-mail de confirmation vient de lui être envoyé. Ouvrez le lien pour créer votre établissement ou rejoindre votre équipe. Si vous avez déjà un compte, connectez-vous.'); setPassword(''); }
      } else if (view === 'reset') {
        await accountRepository?.resetPassword(email);
        setNotice('Si un compte existe à cette adresse, vous recevrez un lien pour choisir un nouveau mot de passe.');
      } else await onLogin(email, password);
    });
  };
  const demo = (role: "admin" | "employee") => {
    setEmail(role === "admin" ? "admin@nightclub.fr" : "dj.max@nightclub.fr");
    setPassword(role === "admin" ? "admin123" : "max123");
    setError("");
  };
  return (
    <main className="login-page">
      <div className="login-brand">
        <Brand />
      </div>
      <div className="login-layout">
        <section className="login-story">
          <span className="login-orbit" aria-hidden="true">
            <Moon size={26} />
          </span>
          <h1>
            Les beaux services
            <br />
            commencent
            <br />
            <span>par une belle équipe.</span>
          </h1>
          <p>
            Le planning, les personnes et les petits détails.
            <br />
            Tout trouve sa place dans Skellow.
          </p>
          <div className="login-preview glass">
            <div>
              <CalendarDays size={17} />
              <strong>Un service bien organisé</strong>
              <span className="preview-dots">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="preview-shift tone-lilac">
              <Moon size={16} />
              <span>Service du soir</span>
              <strong>19:00 — 23:00</strong>
            </div>
            <div className="preview-shift tone-sage">
              <Users size={16} />
              <span>Une équipe au complet</span>
              <Check size={17} />
            </div>
          </div>
          <span className="login-footnote">
            Moins d’organisation. Plus de moments à partager.
          </span>
        </section>
        <section className="login-card">
          <h2>{recovery ? 'Un nouveau départ.' : view === 'signup' ? 'Votre équipe commence ici.' : view === 'reset' ? 'Retrouvons votre accès.' : 'Heureux de vous retrouver.'}</h2>
          <p>{recovery ? 'Choisissez votre nouveau mot de passe.' : invited ? 'Une invitation vous attend. Utilisez l’adresse e-mail invitée.' : view === 'signup' ? 'Créez votre compte, puis votre établissement.' : view === 'reset' ? 'Recevez un lien par e-mail pour changer votre mot de passe.' : 'Connectez-vous à votre espace de travail.'}</p>
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {google && !recovery && view !== 'reset' && <Button disabled={pending} className="google-signin" onClick={() => void run(() => accountRepository!.signInGoogle())}>Continuer avec Google<ArrowRight size={16}/></Button>}
          <form onSubmit={submit} className="login-form" aria-busy={pending}>
            <fieldset disabled={pending} className="form-fields">
            {view === 'signup' && !recovery && <label className="field">Votre nom<input name="name" autoComplete="name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Camille Martin" /></label>}
            {!recovery && <label className="field">
              Adresse e-mail
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="vous@etablissement.fr"
                required
              />
            </label>}
            {(view !== 'reset' || recovery) && <div className="field">
              <label htmlFor="auth-password">Mot de passe</label>
              <span className="password-field">
                <input
                  id="auth-password"
                  type={visible ? "text" : "password"}
                  name="password"
                  autoComplete={view === "signup" || recovery ? "new-password" : "current-password"}
                  minLength={view === "signup" || recovery ? 12 : undefined}
                  maxLength={128}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Votre mot de passe"
                  required
                />
                <IconButton
                  label={
                    visible
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </IconButton>
              </span>
              {(view === 'signup' || recovery) && <small>Au moins 12 caractères.</small>}
            </div>}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" className="login-submit">
              {pending ? (view === "login" && !recovery ? "Connexion…" : "Un instant…") : recovery ? "Enregistrer le mot de passe" : view === 'signup' ? "Créer mon compte" : view === 'reset' ? "Recevoir le lien" : "Se connecter"}
              <ArrowRight size={17} />
            </Button>
            </fieldset>
          </form>
          {mode === 'supabase' && !recovery && <div className="auth-links">
            {view === 'login' && <Button disabled={pending} variant="ghost" onClick={() => changeView('reset')}>Mot de passe oublié ?</Button>}
            <Button disabled={pending} variant="ghost" onClick={() => changeView(view === 'login' ? 'signup' : 'login')}>{view === 'login' ? 'Créer un compte' : 'Revenir à la connexion'}</Button>
          </div>}
          {recovery && <Button variant="ghost" disabled={pending} onClick={onCancelRecovery}>Revenir à mon espace</Button>}
          {mode === "demo" && <div className="demo-access">
            <span>Découvrir avec un compte de démonstration</span>
            <div>
              <Button disabled={pending} onClick={() => demo("admin")}>
                Administrateur
                <ArrowRight size={14} />
              </Button>
              <Button disabled={pending} onClick={() => demo("employee")}>
                Employé
                <ArrowRight size={14} />
              </Button>
            </div>
            <p>Ces boutons remplissent les identifiants de démonstration.</p>
          </div>}
        </section>
      </div>
      <footer className="login-footer">
        <span>Skellow · Votre équipe, en harmonie.</span>
        <span>Planning & gestion du personnel</span>
      </footer>
    </main>
  );
}
