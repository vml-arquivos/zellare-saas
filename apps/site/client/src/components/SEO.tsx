import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
}

export default function SEO({
  title = 'Zelare — Cuidado, pedagogia e gestão inteligente',
  description = 'A plataforma que conecta gestão escolar, pedagogia, cuidado, corpo docente e família em um só lugar. Para instituições públicas e privadas de educação infantil.',
  keywords = 'Zelare, gestão escolar, educação infantil, plataforma pedagógica, creche, CEI, software para escolas, planejamento pedagógico, diário de bordo',
  image = '/images/zelare-logo-square.png',
  url = typeof window !== 'undefined' ? window.location.href : '',
  type = 'website',
}: SEOProps) {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, property = false) => {
      const attribute = property ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };

    // Standard meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);

    // Open Graph tags
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', image, true);
    updateMetaTag('og:url', url, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:site_name', 'Zelare', true);
    updateMetaTag('og:locale', 'pt_BR', true);

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', image);

    // Additional SEO tags
    updateMetaTag('robots', 'index, follow');
    updateMetaTag('author', 'Zelare - Associação Beneficente Coração de Cristo');
    updateMetaTag('language', 'Portuguese');
    updateMetaTag('revisit-after', '7 days');

  }, [title, description, keywords, image, url, type]);

  return null;
}
