import { useEffect } from 'react';

export type SeoLocale = 'fr' | 'en';

export type SeoFaqItem = {
  question: string;
  answer: string;
};

export type SeoBreadcrumb = {
  name: string;
  path: string;
};

export type SeoConfig = {
  path: string;
  locale: SeoLocale;
  title: string;
  description: string;
  robots?: string;
  type?: 'website' | 'article';
  imagePath?: string;
  breadcrumbs?: SeoBreadcrumb[];
  faqItems?: SeoFaqItem[];
};

const schemaId = 'sendflow-seo-schema';

function getSiteOrigin() {
  const configured = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim().replace(/\/+$/, '');
  return configured || window.location.origin;
}

function normalizePath(path: string) {
  if (!path || path === '/') return '/';
  return `/${path.replace(/^\/+|\/+$/g, '')}`;
}

function absoluteUrl(path: string) {
  return `${getSiteOrigin()}${normalizePath(path)}`;
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = href;
}

function setSchema(config: SeoConfig, pageUrl: string, imageUrl: string) {
  document.getElementById(schemaId)?.remove();

  const siteUrl = absoluteUrl('/');
  const organizationId = `${siteUrl}#organization`;
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: 'SendFlow',
      url: siteUrl,
      logo: imageUrl,
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}#website`,
      name: 'SendFlow',
      url: siteUrl,
      inLanguage: config.locale,
      publisher: { '@id': organizationId },
    },
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      name: config.title,
      description: config.description,
      url: pageUrl,
      inLanguage: config.locale,
      isPartOf: { '@id': `${siteUrl}#website` },
    },
  ];

  if (config.breadcrumbs?.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: config.breadcrumbs.map((breadcrumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: breadcrumb.name,
        item: absoluteUrl(breadcrumb.path),
      })),
    });
  }

  if (config.faqItems?.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: config.faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  const script = document.createElement('script');
  script.id = schemaId;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
  document.head.appendChild(script);
}

export function applySeo(config: SeoConfig) {
  if (typeof document === 'undefined') return;

  const pageUrl = absoluteUrl(config.path);
  const imageUrl = absoluteUrl(config.imagePath ?? '/sendflow-favicon.png');
  document.documentElement.lang = config.locale;
  document.title = config.title;
  setMeta('name', 'description', config.description);
  setMeta('name', 'robots', config.robots ?? 'index,follow');
  setMeta('property', 'og:title', config.title);
  setMeta('property', 'og:description', config.description);
  setMeta('property', 'og:type', config.type ?? 'website');
  setMeta('property', 'og:url', pageUrl);
  setMeta('property', 'og:image', imageUrl);
  setMeta('property', 'og:locale', config.locale === 'fr' ? 'fr_FR' : 'en_US');
  setMeta('name', 'twitter:card', 'summary');
  setMeta('name', 'twitter:title', config.title);
  setMeta('name', 'twitter:description', config.description);
  setMeta('name', 'twitter:image', imageUrl);
  setCanonical(pageUrl);
  setSchema(config, pageUrl, imageUrl);
}

export function useSeo(config: SeoConfig) {
  const configKey = JSON.stringify(config);
  useEffect(() => {
    applySeo(config);
  }, [configKey]);
}