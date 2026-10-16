import React, { useState } from 'react';
import { Employee } from '../types';

interface LoginProps {
  employees: Employee[];
  onLogin: (employee: Employee) => void;
}

export default function Login({ employees, onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const employee = employees.find(
      (emp) => emp.email === email && emp.password === password && emp.active
    );
    if (employee) {
      onLogin(employee);
    } else {
      setError('Email ou mot de passe incorrect');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1px solid var(--border-2)', fontSize: 14,
    outline: 'none', background: 'white',
    transition: 'border-color 200ms ease, box-shadow 200ms ease',
  };

  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#dedad4',
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: 40, width: '100%', maxWidth: 400,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
        animation: 'panelIn 600ms var(--ease-out) both',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, background: '#1a1a1a', borderRadius: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          }}>
            <span style={{ width: 5, height: 5, background: 'white', borderRadius: '50%' }} />
            <span style={{ width: 4, height: 4, background: 'white', borderRadius: '50%' }} />
            <span style={{ width: 4, height: 4, background: 'white', borderRadius: '50%' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>Skellow</h1>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Night Club Planning</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Email</label>
            <input
              type="email" value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              style={inputStyle} placeholder="votre@email.fr" required
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--text)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.04)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Mot de passe</label>
            <input
              type="password" value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              style={inputStyle} placeholder="••••••••" required
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--text)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.04)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(217,48,37,0.06)', border: '1px solid rgba(217,48,37,0.15)',
              fontSize: 13, color: 'var(--red)', fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button type="submit" style={{
            width: '100%', padding: '11px 0', borderRadius: 10,
            background: '#1a1a1a', color: 'white', border: 'none',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            transition: 'background 150ms ease, transform 100ms var(--ease-out)',
          }}>
            Se connecter
          </button>
        </form>

        <div style={{
          marginTop: 24, padding: '14px 16px', borderRadius: 10,
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Comptes demo</p>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>Admin : admin@nightclub.fr / admin123</p>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>Employe : dj.max@nightclub.fr / max123</p>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{
              marginTop: 8, fontSize: 11, color: 'var(--red)', background: 'none',
              border: 'none', cursor: 'pointer', textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Reinitialiser les donnees
          </button>
        </div>
      </div>
    </div>
  );
}
