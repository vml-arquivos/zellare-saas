import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { getRedirectPathByRoles } from '../hooks/useRedirectByRole';
import { getErrorMessage } from '../utils/errorMessage';
import { getAccessToken } from '../api/tokenStorage';
import { useTheme } from '../app/ThemeProvider';
import { Eye, EyeOff, BookOpen, Sparkles, Smartphone } from 'lucide-react';

type LoginSubmitEvent =
  | React.FormEvent<HTMLFormElement>
  | React.MouseEvent<HTMLButtonElement>
  | React.KeyboardEvent<HTMLInputElement>;

// Detecta se o app está rodando como PWA instalado
function isPWAMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme, toggleTheme } = useTheme();

  const handleSubmit = async (e: LoginSubmitEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // FIX P0.1: login() retorna Promise<void> — após o await o token já está
      // no localStorage. Decodificamos o JWT para obter roles sem depender do
      // state do React (que só atualiza no próximo ciclo de render).
      await login(email, password);
      let redirectPath = '/app/dashboard';
      try {
        const token = getAccessToken();
        if (token) {
          const parts = token.split('.');
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
            roles?: Array<{ level?: string; type?: string }>;
          };
          const roles = payload?.roles ?? [];
          const levels = roles.map((r) => r.level ?? '').filter(Boolean);
          const types  = roles.map((r) => r.type  ?? '').filter(Boolean);
          redirectPath = getRedirectPathByRoles(levels, types);
        }
      } catch { /* fallback para /app/dashboard */ }
      navigate(redirectPath);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'E-mail ou senha incorretos. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  // ── Login PWA: tela limpa para celular ─────────────────────────────────
  if (isPWAMode()) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative',
        background: 'var(--surface-page)',
        fontFamily: '"Inter","system-ui",sans-serif',
        padding: '0 24px',
        paddingTop: 'max(48px, env(safe-area-inset-top))',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
        justifyContent: 'space-between',
      }}>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Ativar tema ${resolvedTheme === 'dark' ? 'claro' : 'escuro'}`}
          style={{
            position: 'absolute', top: 16, right: 16, borderRadius: 9999,
            border: '1px solid var(--border-strong)', background: 'var(--surface-subtle)',
            color: 'var(--text-primary)', padding: '8px 12px', cursor: 'pointer', fontSize: 12,
          }}
        >
          {resolvedTheme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        </button>

        {/* Topo: logo e título */}
        <div style={{ textAlign: 'center', color: 'var(--text-primary)' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 22, background: 'var(--surface-base)',
            backdropFilter: 'blur(8px)', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.2)',
          }}>
            <img
              src="/brand/zelare-logo-square.png"
              alt="Zelare"
              style={{ width: 48, height: 48, objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
              }}
            />
            <span style={{ display: 'none', fontSize: 28, fontWeight: 800, color: 'var(--text-brand)' }}>Z</span>
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
            Zelare
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            cuidado, pedagogia e gestão inteligente
          </p>
        </div>

        {/* Formulário */}
        <div style={{
          background: 'var(--surface-base)', border: '1px solid var(--border-default)', borderRadius: 24, padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
            Entrar
          </h2>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 12, marginBottom: 16,
              background: 'var(--error-bg)', border: '0.5px solid var(--error-border)',
              fontSize: 13, color: 'var(--error)',
            }}>
              {error}
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoCapitalize="none"
              autoCorrect="off"
              style={{
                width: '100%', padding: '13px 14px', borderRadius: 12, boxSizing: 'border-box',
                border: '0.5px solid var(--border-default)', background: 'var(--surface-subtle)',
                fontSize: 16, color: 'var(--text-primary)', outline: 'none',
              }}
            />
          </div>

          {/* Senha */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                style={{
                  width: '100%', padding: '13px 44px 13px 14px', borderRadius: 12, boxSizing: 'border-box',
                  border: '0.5px solid var(--border-default)', background: 'var(--surface-subtle)',
                  fontSize: 16, color: 'var(--text-primary)', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Botão entrar */}
          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: loading ? 'var(--accent-mint)' : 'var(--success)',
              color: 'var(--on-accent)', fontSize: 16, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: (!email || !password) ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Entrando...
              </>
            ) : 'Entrar'}
          </button>
        </div>

        {/* Rodapé */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Smartphone size={12} /> App instalado
          </p>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex relative" style={{ background: 'var(--surface-page)' }}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Ativar tema ${resolvedTheme === 'dark' ? 'claro' : 'escuro'}`}
        className="zelare-theme-toggle absolute right-5 top-5 z-20 rounded-full px-3 py-2 text-xs backdrop-blur transition"
      >
        {resolvedTheme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      </button>
      {/* Painel esquerdo — identidade visual */}
      <div className="zelare-login-brand hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="relative z-10 max-w-md text-center">
          {/* Logo desktop — Zelare institucional */}
          <div className="flex items-center justify-center mb-8">
            <img
              src={import.meta.env.VITE_APP_LOGO_URL || '/brand/zelare-logo-square.png'}
              alt={import.meta.env.VITE_APP_NAME || 'Zelare'}
              className="h-24 w-auto object-contain drop-shadow-2xl"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = 'flex';
              }}
            />
            {/* Fallback texto (oculto por padrão) */}
            <div className="hidden items-center gap-3" aria-hidden="true">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl">
                <span className="text-emerald-700 font-black text-3xl">Z</span>
              </div>
              <div className="text-left">
                <h1 className="text-4xl font-black tracking-tight">{import.meta.env.VITE_APP_NAME || 'Zelare'}</h1>
                <p className="zelare-login-brand-accent text-sm tracking-widest uppercase">Gestão inteligente</p>
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-4 leading-tight">
            Cuidado, pedagogia<br />
            <span className="zelare-login-brand-accent">e gestão inteligente</span>
          </h2>
          <p className="zelare-login-brand-copy text-lg leading-relaxed mb-8">
            Uma plataforma para entidades públicas e privadas cuidarem da rotina pedagógica, dos registros, dos relatórios e da gestão educacional em um só lugar.
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 gap-3 text-left">
            {[
              { icon: '📋', text: 'Rotina pedagógica em poucos cliques' },
              { icon: '📚', text: 'Planejamentos baseados na BNCC' },
              { icon: '📊', text: 'Relatórios e gestão inteligente' },
              { icon: '🤖', text: 'Assistente de IA para educadores' },
            ].map((f, i) => (
              <div key={i} className="zelare-login-brand-feature flex items-center gap-3 rounded-xl px-4 py-3 backdrop-blur-sm">
                <span className="text-xl">{f.icon}</span>
                <span className="zelare-login-brand-feature-text text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Logo mobile — Zelare institucional */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img
              src={import.meta.env.VITE_APP_LOGO_URL || '/brand/zelare-logo-square.png'}
              alt={import.meta.env.VITE_APP_NAME || 'Zelare'}
              className="h-16 w-auto object-contain drop-shadow-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = 'flex';
              }}
            />
            {/* Fallback texto mobile (oculto por padrão) */}
            <div className="hidden items-center gap-3" aria-hidden="true">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-emerald-700 font-black text-2xl">Z</span>
              </div>
              <div>
                <h1 className="text-2xl font-black text-[var(--text-primary)]">{import.meta.env.VITE_APP_NAME || 'Zelare'}</h1>
                <p className="text-[var(--text-secondary)] text-xs">Gestão inteligente</p>
              </div>
            </div>
          </div>

          <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-3xl shadow-2xl p-8 lg:p-10">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Bem-vindo de volta</span>
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Acesse sua conta</h2>
              <p className="text-[var(--text-secondary)] text-sm mt-1">Entre com seu e-mail e senha cadastrados</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* E-mail */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 border-2 border-[var(--border-default)] bg-[var(--surface-subtle)] rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-[var(--surface-brand)] transition-all text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all text-gray-900 placeholder-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-[var(--error-bg)] border border-[var(--error-border)] text-[var(--error)] rounded-xl text-sm">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-5 w-5" />
                    Entrar no Zelare
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] text-center">
              <p className="text-xs text-[var(--text-tertiary)]">
                {import.meta.env.VITE_APP_NAME || 'Zelare'} © 2026 — cuidado, pedagogia e gestão inteligente
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
