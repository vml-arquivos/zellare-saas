import { useEffect } from 'react';

interface SchemaOrgProps {
  type?: 'Organization' | 'SoftwareApplication' | 'Article' | 'WebPage';
  data?: Record<string, any>;
}

export default function SchemaOrg({ type = 'Organization', data = {} }: SchemaOrgProps) {
  useEffect(() => {
    const getSchemaData = () => {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

      if (type === 'Organization') {
        return {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Zelare',
          alternateName: 'Zelare — Cuidado, pedagogia e gestão inteligente',
          url: baseUrl,
          logo: `${baseUrl}/images/zelare-logo-square.png`,
          description: 'Plataforma de gestão escolar, pedagógica e de cuidado para instituições de educação infantil, públicas e privadas.',
          ...data,
        };
      }

      if (type === 'SoftwareApplication') {
        return {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Zelare',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description: 'Plataforma que conecta gestão escolar, pedagogia, cuidado, corpo docente e família para instituições de educação infantil.',
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'BRL',
            lowPrice: '0',
            offerCount: '3',
          },
          ...data,
        };
      }

      if (type === 'Article') {
        return {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: data.title || '',
          description: data.description || '',
          image: data.image || '',
          datePublished: data.publishedAt || new Date().toISOString(),
          dateModified: data.updatedAt || new Date().toISOString(),
          author: {
            '@type': 'Organization',
            name: 'Zelare',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Zelare',
            logo: {
              '@type': 'ImageObject',
              url: `${baseUrl}/images/zelare-logo-square.png`,
            },
          },
          ...data,
        };
      }

      if (type === 'WebPage') {
        return {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: data.title || 'Zelare',
          description: data.description || '',
          url: typeof window !== 'undefined' ? window.location.href : '',
          ...data,
        };
      }

      return {};
    };

    const schemaData = getSchemaData();
    const markerAttr = `schema-${type}`;

    // Remove só o script deste MESMO tipo, se já existir — permite várias
    // instâncias (Organization + SoftwareApplication, por exemplo) juntas
    // na mesma página, sem uma apagar a outra.
    const existingScript = document.querySelector(`script[data-${markerAttr}]`);
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute(`data-${markerAttr}`, 'true');
    script.text = JSON.stringify(schemaData);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.querySelector(`script[data-${markerAttr}]`);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [type, data]);

  return null;
}
