import { Mail, Facebook, Instagram, Linkedin } from 'lucide-react';
import { Link } from 'wouter';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-zelare-ink text-white">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Sobre */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img
                src="/images/zelare-logo-dark-horizontal.png"
                alt="Zelare"
                className="h-8 w-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              A plataforma que conecta gestão escolar, pedagogia, cuidado e família para
              instituições de educação infantil — públicas e privadas.
            </p>
            <div className="flex gap-4 mt-4">
              <a href="#" className="text-white/50 hover:text-zelare-mint transition-colors" aria-label="Facebook Zelare">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-white/50 hover:text-zelare-mint transition-colors" aria-label="Instagram Zelare">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-white/50 hover:text-zelare-mint transition-colors" aria-label="LinkedIn Zelare">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Produto */}
          <div>
            <h4 className="font-semibold text-white mb-4">Produto</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/#recursos" className="text-white/60 hover:text-zelare-mint transition-colors">Recursos</a></li>
              <li><a href="/#ecossistema" className="text-white/60 hover:text-zelare-mint transition-colors">Ecossistema</a></li>
              <li><a href="/#planos" className="text-white/60 hover:text-zelare-mint transition-colors">Planos</a></li>
              <li>
                <a
                  href="https://appzelare.casadf.com.br/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-zelare-mint transition-colors"
                >
                  Entrar na plataforma
                </a>
              </li>
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="font-semibold text-white mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/quem-somos">
                  <span className="text-white/60 hover:text-zelare-mint transition-colors cursor-pointer">Quem somos</span>
                </Link>
              </li>
              <li>
                <Link href="/blog">
                  <span className="text-white/60 hover:text-zelare-mint transition-colors cursor-pointer">Blog</span>
                </Link>
              </li>
              <li>
                <Link href="/contato">
                  <span className="text-white/60 hover:text-zelare-mint transition-colors cursor-pointer">Contato</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contato</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2 items-start">
                <Mail className="w-4 h-4 text-zelare-mint mt-0.5 flex-shrink-0" />
                <a href="mailto:contato@zelare.com.br" className="text-white/60 hover:text-zelare-mint transition-colors">
                  contato@zelare.com.br
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 my-8"></div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <p>&copy; {currentYear} Zelare. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-zelare-mint transition-colors">Privacidade</a>
            <a href="#" className="hover:text-zelare-mint transition-colors">Termos de Uso</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
