import { useState, useEffect } from 'react';
import { Menu, X, ArrowRight, LogIn } from 'lucide-react';
import { Link, useLocation } from 'wouter';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setIsOpen(false); }, [location]);

  const navLinks = [
    { label: 'Recursos', href: '/#recursos' },
    { label: 'Ecossistema', href: '/#ecossistema' },
    { label: 'Planos', href: '/#planos' },
    { label: 'Quem somos', href: '/quem-somos' },
    { label: 'Contato', href: '/contato' },
  ];

  return (
    <header
      className={`sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border transition-shadow duration-300 ${
        scrolled ? 'shadow-md' : ''
      }`}
    >
      <div className="container flex items-center justify-between h-20">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-3 hover:opacity-90 transition-opacity cursor-pointer">
            <img
              src="/images/zelare-logo-square.png"
              alt="Zelare"
              className="h-11 w-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="flex flex-col">
              <span className="font-display text-zelare-ink font-semibold text-lg leading-tight tracking-tight">
                Zelare
              </span>
              <span className="text-[11px] text-muted-foreground font-medium tracking-wide uppercase">
                Cuidado &amp; gestão inteligente
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <span className="text-sm font-semibold text-zelare-ink/80 hover:text-zelare-teal transition-colors duration-200 cursor-pointer">
                {link.label}
              </span>
            </Link>
          ))}
        </nav>

        {/* CTA Buttons — Desktop */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://appzelare.casadf.com.br/login"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-zelare-ink text-sm font-semibold hover:text-zelare-teal transition-colors duration-200"
          >
            <LogIn className="w-4 h-4" />
            Entrar
          </a>
          <Link href="/contato">
            <button className="flex items-center gap-1.5 px-5 py-2.5 bg-zelare-teal text-white text-sm font-semibold rounded-full hover:bg-zelare-ink transition-all duration-200 shadow-sm hover:shadow-md">
              Solicitar demonstração
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {isOpen ? (
            <X className="w-6 h-6 text-zelare-ink" />
          ) : (
            <Menu className="w-6 h-6 text-zelare-ink" />
          )}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <nav className="lg:hidden bg-white border-t border-border shadow-lg">
          <div className="container py-4 space-y-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span className="block px-4 py-3 rounded-xl text-sm font-semibold text-zelare-ink hover:bg-zelare-mint/30 transition-colors cursor-pointer">
                  {link.label}
                </span>
              </Link>
            ))}
            <div className="pt-4 mt-2 border-t border-border space-y-2 px-1">
              <a
                href="https://appzelare.casadf.com.br/login"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-zelare-teal text-zelare-teal text-sm font-semibold rounded-xl hover:bg-zelare-teal hover:text-white transition-all duration-200"
              >
                <LogIn className="w-4 h-4" />
                Entrar
              </a>
              <Link href="/contato">
                <button className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-zelare-teal text-white text-sm font-semibold rounded-xl hover:bg-zelare-ink transition-all duration-200">
                  Solicitar demonstração
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
