import { FormEvent, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Moon,
  Users,
} from "lucide-react";
import { useAsyncAction } from "../backend/useAsyncAction";
import { Brand, Button, IconButton } from "./ui";
export default function Login({
  mode,
  onLogin,
}: {
  mode: "demo" | "supabase";
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const { pending, error, setError, run } = useAsyncAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => onLogin(email, password));
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
            Les belles soirées
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
              <strong>Une soirée bien organisée</strong>
              <span className="preview-dots">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="preview-shift tone-lilac">
              <Moon size={16} />
              <span>DJ & animation</span>
              <strong>22:00 — 05:00</strong>
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
          <h2>Heureux de vous retrouver.</h2>
          <p>Connectez-vous à votre espace de travail.</p>
          <form onSubmit={submit} className="login-form" aria-busy={pending}>
            <fieldset disabled={pending} className="form-fields">
            <label className="field">
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
            </label>
            <label className="field">
              Mot de passe
              <span className="password-field">
                <input
                  type={visible ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
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
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" className="login-submit">
              {pending ? "Connexion…" : "Se connecter"}
              <ArrowRight size={17} />
            </Button>
            </fieldset>
          </form>
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
