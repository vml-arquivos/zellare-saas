import { useState } from 'react';
import {
  ArrowRight,
  Building2,
  BookOpen,
  HeartPulse,
  GraduationCap,
  Users,
  Sparkles,
  Puzzle,
  WifiOff,
  Layers,
  Upload,
  Check,
} from 'lucide-react';
import { Link } from 'wouter';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import SchemaOrg from '@/components/SchemaOrg';

const CHAIN = [
  { label: 'Currículo', detail: 'BNCC, Reggio, Montessori — ou o seu próprio', icon: BookOpen },
  { label: 'Planejamento', detail: 'O professor escolhe o tema, a turma, a semana', icon: Layers },
  { label: 'Diário de bordo', detail: 'Cada dia registrado, sempre ligado ao plano', icon: Sparkles },
  { label: 'Família', detail: 'Acompanha a evolução em tempo real', icon: Users },
];

const PILLARS = [
  {
    icon: Building2,
    title: 'Gestão escolar',
    description: 'Matrícula, turmas, unidades e financeiro num só lugar — de uma unidade a uma rede inteira.',
  },
  {
    icon: BookOpen,
    title: 'Pedagógico',
    description: 'Currículo plugável, planejamento e diário de bordo, ligados de ponta a ponta e auditáveis.',
  },
  {
    icon: HeartPulse,
    title: 'Cuidado e saúde',
    description: 'Restrições alimentares, cardápio, acompanhamento nutricional e alertas de saúde.',
  },
  {
    icon: GraduationCap,
    title: 'Corpo docente',
    description: 'Formação continuada, avaliação e coordenação pedagógica acompanhando cada professor.',
  },
  {
    icon: Users,
    title: 'Família',
    description: 'Recados, diário de bordo e desenvolvimento da criança, direto no celular dos responsáveis.',
  },
];

const RECURSOS = [
  {
    icon: Puzzle,
    title: 'Currículo plugável',
    description:
      'Comece com a BNCC pronta, ou monte o currículo da sua instituição do zero. O motor pedagógico se adapta a você — não o contrário.',
  },
  {
    icon: Upload,
    title: 'Suba o que você já usa',
    description:
      'Plano de aula em PDF ou Word que sua equipe já usa no dia a dia? Envie, e a Zelare estrutura como template reutilizável.',
  },
  {
    icon: Sparkles,
    title: 'Assistente de IA',
    description:
      'Sugestões de atividade alinhadas ao currículo escolhido e à faixa etária de cada turma, sem sair do planejamento.',
  },
  {
    icon: WifiOff,
    title: 'Funciona offline',
    description:
      'A professora registra a chamada e o diário mesmo sem internet na sala. Sincroniza sozinho quando a conexão volta.',
  },
];

const PAPEIS = [
  'Direção',
  'Coordenação pedagógica',
  'Secretaria',
  'Professor',
  'Professor auxiliar',
  'Nutrição',
  'Psicologia',
  'Financeiro',
  'Administração geral',
];

const PLANOS = [
  {
    nome: 'Essencial',
    publico: 'Uma unidade, começando agora',
    destaque: false,
    itens: [
      '1 unidade, turmas ilimitadas',
      'Planejamento e diário de bordo',
      'Framework BNCC incluso',
      'Portal da família',
      'Suporte por e-mail',
    ],
  },
  {
    nome: 'Profissional',
    publico: 'Rede em crescimento, várias unidades',
    destaque: true,
    itens: [
      'Unidades ilimitadas',
      'Tudo do Essencial',
      'Currículo próprio e templates customizados',
      'Assistente de IA',
      'Upload de material próprio',
      'Suporte prioritário',
    ],
  },
  {
    nome: 'Rede / Governo',
    publico: 'Secretarias e grandes redes conveniadas',
    destaque: false,
    itens: [
      'Tudo do Profissional',
      'Domínio e identidade visual próprios',
      'Relatórios sob medida para o convênio',
      'Onboarding assistido',
      'Gerente de conta dedicado',
    ],
  },
];

export default function Home() {
  const [hoveredChain, setHoveredChain] = useState<number | null>(null);

  return (
    <>
      <SEO
        title="Zelare — Cuidado, pedagogia e gestão inteligente"
        description="A plataforma que conecta gestão escolar, pedagogia, cuidado, corpo docente e família em um só lugar. Currículo plugável — adapta-se à sua instituição, pública ou privada."
        keywords="Zelare, gestão escolar, plataforma pedagógica, software para creche, planejamento pedagógico, diário de bordo, BNCC"
      />
      <SchemaOrg type="Organization" />
      <SchemaOrg type="SoftwareApplication" />

      <div className="min-h-screen flex flex-col bg-white">
        <Header />

        <main>
          {/* ── Hero ─────────────────────────────────────────────────── */}
          <section className="relative overflow-hidden bg-zelare-ink">
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '28px 28px',
              }}
            />
            <div className="container relative z-10 pt-20 pb-28 md:pt-28 md:pb-36">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zelare-mint/15 border border-zelare-mint/30 text-zelare-mint text-xs font-semibold tracking-wide uppercase mb-6">
                  Para instituições de 0 a 6 anos
                </span>
                <h1 className="font-display text-white text-4xl md:text-6xl leading-[1.08] tracking-tight mb-6">
                  O elo entre currículo, sala e família —
                  <span className="text-zelare-mint"> sem perder nenhum dia.</span>
                </h1>
                <p className="text-lg md:text-xl text-white/75 max-w-2xl mb-10 leading-relaxed">
                  Zelare conecta gestão escolar, planejamento pedagógico, cuidado e comunicação
                  com a família — num motor de currículo que se molda à sua instituição, pública
                  ou privada. Não o contrário.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/contato">
                    <button className="flex items-center justify-center gap-2 px-7 py-4 bg-zelare-teal text-white text-base font-semibold rounded-full hover:bg-zelare-mint hover:text-zelare-ink transition-all duration-200 shadow-lg">
                      Solicitar demonstração
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                  <a href="#como-funciona">
                    <button className="flex items-center justify-center gap-2 px-7 py-4 border border-white/25 text-white text-base font-semibold rounded-full hover:bg-white/10 transition-all duration-200">
                      Ver como funciona
                    </button>
                  </a>
                </div>
              </div>
            </div>

            {/* Elemento de assinatura: a corrente auditável do produto */}
            <div className="relative z-10 pb-16 md:pb-24">
              <div className="container">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {CHAIN.map((step, i) => (
                    <div key={step.label} className="relative">
                      <div
                        onMouseEnter={() => setHoveredChain(i)}
                        onMouseLeave={() => setHoveredChain(null)}
                        className={`h-full rounded-2xl border p-5 backdrop-blur-sm transition-all duration-300 ${
                          hoveredChain === i
                            ? 'bg-white/10 border-zelare-mint/50'
                            : 'bg-white/[0.04] border-white/10'
                        }`}
                      >
                        <step.icon
                          className={`w-6 h-6 mb-4 transition-colors duration-300 ${
                            hoveredChain === i ? 'text-zelare-mint' : 'text-white/50'
                          }`}
                        />
                        <div className="font-display text-white text-lg mb-1">{step.label}</div>
                        <div className="text-sm text-white/55 leading-snug">{step.detail}</div>
                      </div>
                      {i < CHAIN.length - 1 && (
                        <div className="hidden lg:block absolute top-1/2 -right-4 w-4 h-px bg-white/20" />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-white/40 text-xs mt-4 text-center sm:text-left">
                  Cada diário nasce ligado a um plano, e cada plano a um objetivo curricular — auditável do início ao fim.
                </p>
              </div>
            </div>
          </section>

          {/* ── Ecossistema ──────────────────────────────────────────── */}
          <section id="ecossistema" className="py-20 md:py-28 bg-zelare-paper">
            <div className="container">
              <div className="max-w-2xl mb-14">
                <span className="text-zelare-teal text-sm font-semibold tracking-wide uppercase">
                  Um ecossistema, não um punhado de telas
                </span>
                <h2 className="font-display text-zelare-ink text-3xl md:text-4xl mt-3 leading-tight">
                  Cinco áreas que hoje vivem em planilhas, grupos de WhatsApp e cadernos separados.
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {PILLARS.map((pillar) => (
                  <div
                    key={pillar.title}
                    className="group bg-white rounded-2xl border border-zelare-ink/8 p-7 hover:border-zelare-teal/40 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="w-11 h-11 rounded-xl bg-zelare-mint/40 flex items-center justify-center mb-5 group-hover:bg-zelare-teal transition-colors duration-300">
                      <pillar.icon className="w-5 h-5 text-zelare-teal group-hover:text-white transition-colors duration-300" />
                    </div>
                    <h3 className="font-display text-zelare-ink text-xl mb-2">{pillar.title}</h3>
                    <p className="text-sm text-zelare-ink/60 leading-relaxed">{pillar.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Recursos ─────────────────────────────────────────────── */}
          <section id="recursos" className="py-20 md:py-28 bg-white">
            <div className="container">
              <div className="max-w-2xl mb-14">
                <span className="text-zelare-teal text-sm font-semibold tracking-wide uppercase">
                  O que torna o Zelare diferente
                </span>
                <h2 className="font-display text-zelare-ink text-3xl md:text-4xl mt-3 leading-tight">
                  Feito para se adaptar à sua instituição — não o contrário.
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
                {RECURSOS.map((r) => (
                  <div key={r.title} className="flex gap-5">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-zelare-ink flex items-center justify-center">
                      <r.icon className="w-5 h-5 text-zelare-mint" />
                    </div>
                    <div>
                      <h3 className="font-display text-zelare-ink text-lg mb-1.5">{r.title}</h3>
                      <p className="text-sm text-zelare-ink/60 leading-relaxed">{r.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Como funciona ────────────────────────────────────────── */}
          <section id="como-funciona" className="py-20 md:py-28 bg-zelare-ink relative overflow-hidden">
            <div className="container relative z-10">
              <div className="max-w-2xl mb-16">
                <span className="text-zelare-mint text-sm font-semibold tracking-wide uppercase">
                  Como funciona
                </span>
                <h2 className="font-display text-white text-3xl md:text-4xl mt-3 leading-tight">
                  Da escolha do currículo ao relatório pronto, em quatro passos reais.
                </h2>
              </div>
              <div className="relative">
                <div className="hidden md:block absolute left-6 top-6 bottom-6 w-px bg-white/15" />
                <div className="space-y-10 md:space-y-14">
                  {[
                    {
                      n: '1',
                      title: 'Escolha ou monte seu currículo',
                      desc: 'Comece com a BNCC pronta na biblioteca, clone e adapte, ou construa o currículo da sua instituição do zero.',
                    },
                    {
                      n: '2',
                      title: 'A equipe planeja por turma',
                      desc: 'Cada professor monta o planejamento da semana ligado a um objetivo real do currículo escolhido.',
                    },
                    {
                      n: '3',
                      title: 'O dia a dia vira diário de bordo',
                      desc: 'Chamada, atividades e observações — sempre amarradas ao plano do dia, mesmo sem internet na sala.',
                    },
                    {
                      n: '4',
                      title: 'Família e gestão acompanham em tempo real',
                      desc: 'Relatórios de desenvolvimento, frequência e alimentação prontos — para a família e para quem gere a rede.',
                    },
                  ].map((step) => (
                    <div key={step.n} className="relative flex gap-6 md:gap-8">
                      <div className="relative z-10 shrink-0 w-12 h-12 rounded-full bg-zelare-ink border-2 border-zelare-mint flex items-center justify-center font-display text-zelare-mint text-lg">
                        {step.n}
                      </div>
                      <div className="pt-1.5">
                        <h3 className="font-display text-white text-xl mb-2">{step.title}</h3>
                        <p className="text-white/60 leading-relaxed max-w-xl">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── Papéis de acesso ─────────────────────────────────────── */}
          <section className="py-16 bg-zelare-paper border-b border-zelare-ink/5">
            <div className="container">
              <p className="text-zelare-teal text-sm font-semibold tracking-wide uppercase mb-6 text-center">
                Um acesso certo para cada função da instituição
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {PAPEIS.map((papel) => (
                  <span
                    key={papel}
                    className="px-4 py-2 rounded-full bg-white border border-zelare-ink/10 text-zelare-ink/75 text-sm font-medium"
                  >
                    {papel}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* ── Planos ───────────────────────────────────────────────── */}
          <section id="planos" className="py-20 md:py-28 bg-white">
            <div className="container">
              <div className="max-w-2xl mb-14 mx-auto text-center">
                <span className="text-zelare-teal text-sm font-semibold tracking-wide uppercase">
                  Planos
                </span>
                <h2 className="font-display text-zelare-ink text-3xl md:text-4xl mt-3 leading-tight">
                  De uma unidade a uma rede conveniada inteira.
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {PLANOS.map((plano) => (
                  <div
                    key={plano.nome}
                    className={`rounded-2xl p-8 flex flex-col ${
                      plano.destaque
                        ? 'bg-zelare-ink text-white ring-2 ring-zelare-teal shadow-xl md:-translate-y-3'
                        : 'bg-zelare-paper text-zelare-ink border border-zelare-ink/8'
                    }`}
                  >
                    {plano.destaque && (
                      <span className="self-start px-3 py-1 rounded-full bg-zelare-mint text-zelare-ink text-xs font-semibold mb-4">
                        Mais escolhido
                      </span>
                    )}
                    <h3 className="font-display text-2xl mb-1">{plano.nome}</h3>
                    <p className={`text-sm mb-6 ${plano.destaque ? 'text-white/60' : 'text-zelare-ink/55'}`}>
                      {plano.publico}
                    </p>
                    <ul className="space-y-3 mb-8 flex-1">
                      {plano.itens.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm">
                          <Check
                            className={`w-4 h-4 mt-0.5 shrink-0 ${
                              plano.destaque ? 'text-zelare-mint' : 'text-zelare-teal'
                            }`}
                          />
                          <span className={plano.destaque ? 'text-white/85' : 'text-zelare-ink/75'}>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/contato">
                      <button
                        className={`w-full py-3 rounded-full text-sm font-semibold transition-all duration-200 ${
                          plano.destaque
                            ? 'bg-zelare-mint text-zelare-ink hover:bg-white'
                            : 'bg-zelare-ink text-white hover:bg-zelare-teal'
                        }`}
                      >
                        Falar com o time
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
              <p className="text-center text-zelare-ink/45 text-sm mt-10">
                Preços variam por número de unidades e crianças atendidas — sem taxa de implantação para redes conveniadas.
              </p>
            </div>
          </section>

          {/* ── CTA final ────────────────────────────────────────────── */}
          <section className="py-20 md:py-24 bg-zelare-teal">
            <div className="container text-center">
              <h2 className="font-display text-white text-3xl md:text-4xl leading-tight max-w-2xl mx-auto mb-8">
                Sua instituição já tem a rotina. O Zelare organiza o resto.
              </h2>
              <Link href="/contato">
                <button className="inline-flex items-center gap-2 px-8 py-4 bg-white text-zelare-teal text-base font-semibold rounded-full hover:bg-zelare-ink hover:text-white transition-all duration-200 shadow-lg">
                  Solicitar demonstração
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
