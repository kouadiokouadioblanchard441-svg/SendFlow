import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  Image,
  Languages,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  Users,
  UserRound,
  X,
} from 'lucide-react';

type Primitive = string | number | boolean | null | undefined;
type RecordItem = { id?: number; [key: string]: Primitive };

type Assignment = { countryId: number; operatorId: number; orderIndex: number };
type Bundle = {
  media: RecordItem[];
  content: RecordItem[];
  sections: RecordItem[];
  features: RecordItem[];
  faqs: RecordItem[];
  countries: RecordItem[];
  operators: RecordItem[];
  countryOperators: Assignment[];
  globeBadges: RecordItem[];
  legalPages: RecordItem[];
  legalSections: RecordItem[];
  founder: RecordItem | null;
  settings: RecordItem | null;
};
type ResourceKey = Exclude<keyof Bundle, 'countryOperators' | 'founder' | 'settings'>;
type InputKind = 'text' | 'textarea' | 'number' | 'checkbox' | 'select';
type FieldConfig = {
  key: string;
  label: string;
  kind?: InputKind;
  placeholder?: string;
  optionSource?: 'locale' | 'contentType' | 'page' | 'operator' | 'media';
};
type ResourceConfig = {
  label: string;
  singular: string;
  apiResource: string;
  description: string;
  fields: FieldConfig[];
  columns: { key: string; label: string; emphasis?: boolean }[];
};

const resourceConfigs: Record<ResourceKey, ResourceConfig> = {
  content: {
    label: 'Textes de la landing',
    singular: 'texte',
    apiResource: 'content',
    description: 'Les libellés, titres et messages localisés du site.',
    fields: [
      { key: 'contentKey', label: 'Clé de contenu', placeholder: 'hero.title' },
      { key: 'locale', label: 'Langue', kind: 'select', optionSource: 'locale' },
      { key: 'group', label: 'Groupe', placeholder: 'hero' },
      { key: 'contentType', label: 'Type', kind: 'select', optionSource: 'contentType' },
      { key: 'value', label: 'Valeur', kind: 'textarea', placeholder: 'Écrire le contenu affiché…' },
      { key: 'orderIndex', label: 'Ordre', kind: 'number' },
      { key: 'isVisible', label: 'Visible sur le site', kind: 'checkbox' },
    ],
    columns: [
      { key: 'contentKey', label: 'Clé', emphasis: true },
      { key: 'locale', label: 'Langue' },
      { key: 'group', label: 'Groupe' },
      { key: 'value', label: 'Aperçu' },
      { key: 'isVisible', label: 'État' },
    ],
  },
  media: {
    label: 'Médias',
    singular: 'média',
    apiResource: 'media',
    description: 'Images, illustrations et métadonnées servies par la landing.',
    fields: [
      { key: 'slug', label: 'Slug', placeholder: 'hero-globe' },
      { key: 'altFr', label: 'Texte alternatif · FR', kind: 'textarea' },
      { key: 'altEn', label: 'Texte alternatif · EN', kind: 'textarea' },
      { key: 'isVisible', label: 'Visible sur le site', kind: 'checkbox' },
    ],
    columns: [
      { key: 'slug', label: 'Média', emphasis: true },
      { key: 'kind', label: 'Type' },
      { key: 'mimeType', label: 'Format' },
      { key: 'isVisible', label: 'État' },
    ],
  },
  sections: {
    label: 'Sections',
    singular: 'section',
    apiResource: 'sections',
    description: 'Les grands blocs éditoriaux et leur ordre de publication.',
    fields: [
      { key: 'slug', label: 'Slug', placeholder: 'international' },
      { key: 'kind', label: 'Type', placeholder: 'editorial' },
      { key: 'orderIndex', label: 'Ordre', kind: 'number' },
      { key: 'eyebrowFr', label: 'Sur-titre · FR' },
      { key: 'eyebrowEn', label: 'Sur-titre · EN' },
      { key: 'titleFr', label: 'Titre · FR' },
      { key: 'titleEn', label: 'Titre · EN' },
      { key: 'bodyFr', label: 'Texte · FR', kind: 'textarea' },
      { key: 'bodyEn', label: 'Texte · EN', kind: 'textarea' },
      { key: 'imageKey', label: 'Clé média' },
      { key: 'isVisible', label: 'Visible sur le site', kind: 'checkbox' },
    ],
    columns: [
      { key: 'orderIndex', label: '#' },
      { key: 'slug', label: 'Section', emphasis: true },
      { key: 'titleFr', label: 'Titre français' },
      { key: 'titleEn', label: 'Titre anglais' },
      { key: 'isVisible', label: 'État' },
    ],
  },
  features: {
    label: 'Fonctionnalités',
    singular: 'fonctionnalité',
    apiResource: 'features',
    description: 'Les bénéfices présentés dans les cartes de la landing.',
    fields: [
      { key: 'slug', label: 'Slug', placeholder: 'simple-experience' },
      { key: 'group', label: 'Groupe', placeholder: 'features' },
      { key: 'orderIndex', label: 'Ordre', kind: 'number' },
      { key: 'titleFr', label: 'Titre · FR' },
      { key: 'titleEn', label: 'Titre · EN' },
      { key: 'bodyFr', label: 'Texte · FR', kind: 'textarea' },
      { key: 'bodyEn', label: 'Texte · EN', kind: 'textarea' },
      { key: 'iconKey', label: 'Clé icône' },
      { key: 'imageKey', label: 'Clé média' },
      { key: 'isVisible', label: 'Visible sur le site', kind: 'checkbox' },
    ],
    columns: [
      { key: 'orderIndex', label: '#' },
      { key: 'slug', label: 'Fonctionnalité', emphasis: true },
      { key: 'titleFr', label: 'Titre français' },
      { key: 'group', label: 'Groupe' },
      { key: 'isVisible', label: 'État' },
    ],
  },
  faqs: {
    label: 'Questions fréquentes',
    singular: 'question',
    apiResource: 'faqs',
    description: 'Les réponses qui rassurent les visiteurs avant le téléchargement.',
    fields: [
      { key: 'orderIndex', label: 'Ordre', kind: 'number' },
      { key: 'questionFr', label: 'Question · FR' },
      { key: 'questionEn', label: 'Question · EN' },
      { key: 'answerFr', label: 'Réponse · FR', kind: 'textarea' },
      { key: 'answerEn', label: 'Réponse · EN', kind: 'textarea' },
      { key: 'isVisible', label: 'Visible sur le site', kind: 'checkbox' },
    ],
    columns: [
      { key: 'orderIndex', label: '#' },
      { key: 'questionFr', label: 'Question française', emphasis: true },
      { key: 'questionEn', label: 'Question anglaise' },
      { key: 'isVisible', label: 'État' },
    ],
  },
  countries: {
    label: 'Pays couverts',
    singular: 'pays',
    apiResource: 'countries',
    description: 'Les marchés affichés et leurs réseaux partenaires.',
    fields: [
      { key: 'code', label: 'Code pays', placeholder: 'CI' },
      { key: 'nameFr', label: 'Nom · FR' },
      { key: 'nameEn', label: 'Nom · EN' },
      { key: 'flag', label: 'Code drapeau', placeholder: 'CI' },
      { key: 'tone', label: 'Ton visuel', placeholder: '#dbeaff' },
      { key: 'orderIndex', label: 'Ordre', kind: 'number' },
      { key: 'heroPositionX', label: 'Position hero · X (%)', kind: 'number' },
      { key: 'heroPositionY', label: 'Position hero · Y (%)', kind: 'number' },
      { key: 'isVisible', label: 'Visible sur le site', kind: 'checkbox' },
    ],
    columns: [
      { key: 'orderIndex', label: '#' },
      { key: 'code', label: 'Code' },
      { key: 'nameFr', label: 'Pays', emphasis: true },
      { key: 'nameEn', label: 'English name' },
      { key: 'isVisible', label: 'État' },
    ],
  },
  operators: {
    label: 'Opérateurs',
    singular: 'opérateur',
    apiResource: 'operators',
    description: 'Les réseaux Mobile Money disponibles dans les pays couverts.',
    fields: [
      { key: 'slug', label: 'Slug', placeholder: 'orange' },
      { key: 'name', label: 'Nom', placeholder: 'Orange' },
      { key: 'logoKey', label: 'Logo opérateur', kind: 'select', optionSource: 'media' },
      { key: 'background', label: 'Couleur de fond', placeholder: '#ff7900' },
      { key: 'foreground', label: 'Couleur du texte', placeholder: '#ffffff' },
      { key: 'isVisible', label: 'Visible sur le site', kind: 'checkbox' },
    ],
    columns: [
      { key: 'name', label: 'Opérateur', emphasis: true },
      { key: 'slug', label: 'Slug' },
      { key: 'logoKey', label: 'Logo' },
      { key: 'isVisible', label: 'État' },
    ],
  },
  globeBadges: {
    label: 'Badges du globe',
    singular: 'badge',
    apiResource: 'badges',
    description: 'Les repères opérateurs positionnés sur le globe animé.',
    fields: [
      { key: 'operatorId', label: 'Opérateur', kind: 'select', optionSource: 'operator' },
      { key: 'positionX', label: 'Position X', kind: 'number' },
      { key: 'positionY', label: 'Position Y', kind: 'number' },
      { key: 'orderIndex', label: 'Ordre', kind: 'number' },
      { key: 'isVisible', label: 'Visible sur le site', kind: 'checkbox' },
    ],
    columns: [
      { key: 'orderIndex', label: '#' },
      { key: 'operatorId', label: 'Opérateur', emphasis: true },
      { key: 'positionX', label: 'X' },
      { key: 'positionY', label: 'Y' },
      { key: 'isVisible', label: 'État' },
    ],
  },
  legalPages: {
    label: 'Pages légales',
    singular: 'page légale',
    apiResource: 'legalPages',
    description: 'Les pages réglementaires disponibles depuis le pied de page.',
    fields: [
      { key: 'slug', label: 'URL / slug', placeholder: 'confidentialite' },
      { key: 'titleFr', label: 'Titre · FR' },
      { key: 'titleEn', label: 'Titre · EN' },
      { key: 'introFr', label: 'Introduction · FR', kind: 'textarea' },
      { key: 'introEn', label: 'Introduction · EN', kind: 'textarea' },
      { key: 'isVisible', label: 'Visible sur le site', kind: 'checkbox' },
    ],
    columns: [
      { key: 'slug', label: 'URL', emphasis: true },
      { key: 'titleFr', label: 'Titre français' },
      { key: 'titleEn', label: 'Titre anglais' },
      { key: 'isVisible', label: 'État' },
    ],
  },
  legalSections: {
    label: 'Sections légales',
    singular: 'section légale',
    apiResource: 'legalSections',
    description: 'Les articles structurés à l’intérieur de chaque page légale.',
    fields: [
      { key: 'pageId', label: 'Page parente', kind: 'select', optionSource: 'page' },
      { key: 'sectionNumber', label: 'Numéro', kind: 'number' },
      { key: 'titleFr', label: 'Titre · FR' },
      { key: 'titleEn', label: 'Titre · EN' },
      { key: 'bodyFr', label: 'Texte · FR', kind: 'textarea' },
      { key: 'bodyEn', label: 'Texte · EN', kind: 'textarea' },
      { key: 'orderIndex', label: 'Ordre', kind: 'number' },
    ],
    columns: [
      { key: 'sectionNumber', label: '#' },
      { key: 'pageId', label: 'Page', emphasis: true },
      { key: 'titleFr', label: 'Titre français' },
      { key: 'titleEn', label: 'Titre anglais' },
    ],
  },
};

const navigation: { key: ResourceKey; icon: typeof FileText; compact?: boolean }[] = [
  { key: 'content', icon: Languages },
  { key: 'sections', icon: LayoutDashboard },
  { key: 'features', icon: SlidersHorizontal },
  { key: 'faqs', icon: CircleHelp },
  { key: 'media', icon: Image },
  { key: 'countries', icon: Users },
  { key: 'operators', icon: Server },
  { key: 'globeBadges', icon: ArrowUpRight },
  { key: 'legalPages', icon: ShieldCheck },
  { key: 'legalSections', icon: FileText },
];

const emptyBundle = (): Bundle => ({
  media: [],
  content: [],
  sections: [],
  features: [],
  faqs: [],
  countries: [],
  operators: [],
  countryOperators: [],
  globeBadges: [],
  legalPages: [],
  legalSections: [],
  founder: null,
  settings: null,
});

class AdminHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AdminHttpError(response.status, body?.error || 'La requête n’a pas abouti.');
  }
  return body as T;
}

function displayValue(value: Primitive, resource: ResourceKey, key: string, bundle: Bundle): string {
  if (key === 'isVisible') return value ? 'Visible' : 'Masqué';
  if (resource === 'globeBadges' && key === 'operatorId') {
    return String(bundle.operators.find((operator) => operator.id === value)?.name ?? `Opérateur #${value ?? '—'}`);
  }
  if (resource === 'legalSections' && key === 'pageId') {
    return String(bundle.legalPages.find((page) => page.id === value)?.titleFr ?? `Page #${value ?? '—'}`);
  }
  const text = value === null || value === undefined || value === '' ? '—' : String(value);
  return text.length > 86 ? `${text.slice(0, 86)}…` : text;
}

function mediaUrl(media: RecordItem | null | undefined): string | null {
  const candidates = [media?.publicUrl, media?.storagePath, media?.sourcePath];
  const value = candidates.find((candidate) => typeof candidate === 'string' && (candidate.startsWith('/') || candidate.startsWith('http')));
  return typeof value === 'string' ? value : null;
}

function mediaForKey(bundle: Bundle, key: Primitive): RecordItem | null {
  if (!key) return null;
  return bundle.media.find((media) => media.slug === key || String(media.id) === String(key)) ?? null;
}

function MediaThumb({ media, label, large = false }: { media?: RecordItem | null; label: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = mediaUrl(media);
  if (!src || failed) {
    return <span className={`sendflow-admin-media-thumb is-empty ${large ? 'is-large' : ''}`} title={label}><Image size={large ? 22 : 16} /></span>;
  }
  return <span className={`sendflow-admin-media-thumb ${large ? 'is-large' : ''}`} title={label}><img src={src} alt="" onError={() => setFailed(true)} /></span>;
}

function CountryFlag({ value }: { value: Primitive }) {
  return <span className="sendflow-admin-country-flag" aria-label={String(value ?? 'Drapeau')}>{String(value ?? '—')}</span>;
}

function ResourceCell({ resource, column, item, bundle }: { resource: ResourceKey; column: { key: string }; item: RecordItem; bundle: Bundle }) {
  if (resource === 'media' && column.key === 'slug') {
    return <span className="sendflow-admin-cell-with-thumb"><MediaThumb media={item} label={String(item.slug ?? 'Média')} /><span>{displayValue(item[column.key], resource, column.key, bundle)}</span></span>;
  }
  if (resource === 'media' && column.key === 'publicUrl') {
    const url = mediaUrl(item);
    return url ? <a className="sendflow-admin-media-link" href={url} target="_blank" rel="noreferrer">{displayValue(item[column.key], resource, column.key, bundle)}</a> : <span>—</span>;
  }
  if (resource === 'operators' && column.key === 'name') {
    return <span className="sendflow-admin-cell-with-thumb"><MediaThumb media={mediaForKey(bundle, item.logoKey)} label={`Logo ${String(item.name ?? 'opérateur')}`} /><span>{displayValue(item[column.key], resource, column.key, bundle)}</span></span>;
  }
  if (resource === 'operators' && column.key === 'logoKey') {
    return <span className="sendflow-admin-cell-with-thumb"><MediaThumb media={mediaForKey(bundle, item.logoKey)} label={`Logo ${String(item.name ?? 'opérateur')}`} /><span>{displayValue(item[column.key], resource, column.key, bundle)}</span></span>;
  }
  if (resource === 'countries' && column.key === 'flag') return <CountryFlag value={item[column.key]} />;
  return <span>{displayValue(item[column.key], resource, column.key, bundle)}</span>;
}

function AssetStrip({ bundle, resource }: { bundle: Bundle; resource: 'media' | 'operators' }) {
  const items = resource === 'media' ? bundle.media : bundle.operators;
  if (items.length === 0) return null;
  return (
    <div className="sendflow-admin-asset-strip" aria-label={resource === 'media' ? 'Aperçus des médias' : 'Aperçus des logos opérateurs'}>
      {items.map((item) => {
        const media = resource === 'media' ? item : mediaForKey(bundle, item.logoKey);
        const label = resource === 'media' ? String(item.slug ?? 'Média') : String(item.name ?? 'Opérateur');
        return <div className="sendflow-admin-asset-card" key={`${resource}-${String(item.id)}`}><MediaThumb media={media} label={label} large /><strong>{label}</strong><small>{resource === 'media' ? String(item.kind ?? 'image') : String(item.logoKey ?? 'Logo non associé')}</small></div>;
      })}
    </div>
  );
}

function defaultValues(config: ResourceConfig, bundle: Bundle): Record<string, Primitive> {
  const values: Record<string, Primitive> = {};
  config.fields.forEach((field) => {
    values[field.key] = field.kind === 'checkbox' ? true : field.kind === 'number' ? 0 : '';
  });
  if (config.apiResource === 'legalSections' && bundle.legalPages[0]?.id) values.pageId = bundle.legalPages[0].id;
  if (config.apiResource === 'badges' && bundle.operators[0]?.id) values.operatorId = bundle.operators[0].id;
  return values;
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="sendflow-admin-stat" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span className={`sendflow-admin-stat-mark ${accent}`} />
      <div><strong>{value}</strong><span>{label}</span></div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="sendflow-admin-skeleton-list" aria-label="Chargement">
      {[1, 2, 3, 4, 5].map((item) => <div className="sendflow-admin-skeleton-row" key={item}><span /><span /><span /><span /></div>)}
    </div>
  );
}

function FormField({
  field,
  value,
  onChange,
  bundle,
}: {
  field: FieldConfig;
  value: Primitive;
  onChange: (value: Primitive) => void;
  bundle: Bundle;
}) {
  const inputId = `admin-field-${field.key}`;
  if (field.kind === 'checkbox') {
    return (
      <label className="sendflow-admin-toggle-field" htmlFor={inputId}>
        <span><strong>{field.label}</strong><small>Ce contenu peut être publié immédiatement.</small></span>
        <input id={inputId} data-testid={`input-${field.key}`} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span className="sendflow-admin-toggle"><i /></span>
      </label>
    );
  }
  if (field.kind === 'select') {
    const options = field.optionSource === 'locale'
      ? [{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]
      : field.optionSource === 'contentType'
        ? [{ value: 'text', label: 'Texte' }, { value: 'html', label: 'HTML' }, { value: 'url', label: 'URL' }]
        : field.optionSource === 'operator'
          ? bundle.operators.map((operator) => ({ value: String(operator.id), label: String(operator.name) }))
          : field.optionSource === 'media'
            ? bundle.media.map((media) => ({ value: String(media.slug ?? media.id), label: `${String(media.slug ?? media.id)} · ${String(media.kind ?? 'image')}` }))
          : bundle.legalPages.map((page) => ({ value: String(page.id), label: `${page.titleFr} · ${page.slug}` }));
    return (
      <label className="sendflow-admin-field" htmlFor={inputId}>
        <span>{field.label}</span>
        <select id={inputId} data-testid={`input-${field.key}`} value={value === null || value === undefined ? '' : String(value)} onChange={(event) => onChange(field.optionSource === 'operator' || field.optionSource === 'page' ? Number(event.target.value) : event.target.value)}>
          <option value="">Sélectionner</option>
          {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      </label>
    );
  }
  const Input = field.kind === 'textarea' ? 'textarea' : 'input';
  return (
    <label className={`sendflow-admin-field ${field.kind === 'textarea' ? 'sendflow-admin-field-wide' : ''}`} htmlFor={inputId}>
      <span>{field.label}</span>
      <Input
        id={inputId}
        data-testid={`input-${field.key}`}
        type={field.kind === 'number' ? 'number' : undefined}
        value={value === null || value === undefined ? '' : String(value)}
        placeholder={field.placeholder}
        rows={field.kind === 'textarea' ? 4 : undefined}
        onChange={(event) => onChange(field.kind === 'number' ? Number(event.target.value) : event.target.value)}
      />
    </label>
  );
}

function EditorDialog({
  config,
  item,
  bundle,
  saving,
  uploading,
  onClose,
  onSave,
  onUploadMedia,
}: {
  config: ResourceConfig;
  item: RecordItem | null;
  bundle: Bundle;
  saving: boolean;
  uploading: boolean;
  onClose: () => void;
  onSave: (values: Record<string, Primitive>) => void;
  onUploadMedia: (file: File) => Promise<{ storagePath: string; publicUrl: string }>;
}) {
  const [values, setValues] = useState<Record<string, Primitive>>(() => {
    const initial = defaultValues(config, bundle);
    if (item) config.fields.forEach((field) => { initial[field.key] = item[field.key]; });
    return initial;
  });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(values);
  };
  const handleMediaUpload = async (file: File) => {
    setUploadError(null);
    try {
      const uploaded = await onUploadMedia(file);
      setValues((current) => ({
        ...current,
        slug: current.slug || file.name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        kind: current.kind || 'image',
        sourcePath: current.sourcePath || file.name,
        storagePath: uploaded.storagePath,
        publicUrl: uploaded.publicUrl,
        mimeType: file.type,
      }));
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : 'Impossible d’importer ce visuel.');
    }
  };
  return (
    <div className="sendflow-admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="sendflow-admin-modal" onSubmit={submit} data-testid="form-resource-editor">
        <div className="sendflow-admin-modal-head">
          <div><p className="sendflow-admin-overline">{item ? 'Modifier' : 'Nouveau contenu'}</p><h2>{item ? `Modifier ${config.singular}` : `Créer ${config.singular}`}</h2></div>
          <button type="button" className="sendflow-admin-icon-button" onClick={onClose} aria-label="Fermer" data-testid="button-close-editor"><X size={18} /></button>
        </div>
        <p className="sendflow-admin-modal-intro">Les champs marqués sont enregistrés dans le contrôle éditorial de SendFlow.</p>
        <div className="sendflow-admin-form-grid">
          {config.fields.map((field) => (
            <FormField key={field.key} field={field} value={values[field.key]} bundle={bundle} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />
          ))}
        </div>
        {config.apiResource === 'media' && (
          <div className="sendflow-admin-upload-box">
            <div>
              <strong>Importer depuis la galerie</strong>
              <small>Choisis directement une image sur ton appareil. PNG, JPG, WEBP ou SVG · 10 Mo maximum.</small>
            </div>
            <label className="sendflow-admin-button sendflow-admin-button-quiet sendflow-admin-upload-label">
              {uploading ? <LoaderCircle className="sendflow-admin-spin" size={16} /> : <UploadCloud size={16} />}
              {uploading ? 'Import en cours…' : 'Choisir une image'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleMediaUpload(file); event.currentTarget.value = ''; }} />
            </label>
            {uploadError && <p className="sendflow-admin-upload-error">{uploadError}</p>}
            {(values.publicUrl || item?.publicUrl) && <div className="sendflow-admin-upload-preview"><MediaThumb media={{ ...item, ...values } as RecordItem} label="Aperçu du média" large /><span>Image prête à être enregistrée dans SendFlow.</span></div>}
          </div>
        )}
        <div className="sendflow-admin-modal-foot">
          <button type="button" className="sendflow-admin-button sendflow-admin-button-quiet" onClick={onClose}>Annuler</button>
          <button type="submit" className="sendflow-admin-button sendflow-admin-button-primary" disabled={saving} data-testid="button-save-resource">
            {saving ? <LoaderCircle className="sendflow-admin-spin" size={16} /> : <Save size={16} />} {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

const founderDefaults: Record<string, Primitive> = {
  name: 'Fondateur de SendFlow',
  roleFr: 'Fondateur & CEO',
  roleEn: 'Founder & CEO',
  shortBioFr: '',
  shortBioEn: '',
  storyFr: '',
  storyEn: '',
  visionFr: '',
  visionEn: '',
  educationFr: '',
  educationEn: '',
  missionFr: '',
  missionEn: '',
  photoKey: '',
  linkedinUrl: '',
  websiteUrl: '',
  instagramUrl: '',
  xUrl: '',
  email: '',
  isVisible: true,
};

function FounderEditor({
  bundle,
  saving,
  onSave,
}: {
  bundle: Bundle;
  saving: boolean;
  onSave: (values: Record<string, Primitive>) => void;
}) {
  const [values, setValues] = useState<Record<string, Primitive>>(() => ({ ...founderDefaults, ...(bundle.founder ?? {}) }));
  useEffect(() => {
    setValues({ ...founderDefaults, ...(bundle.founder ?? {}) });
  }, [bundle.founder]);

  const update = (key: string, value: Primitive) => setValues((current) => ({ ...current, [key]: value }));
  const photo = mediaForKey(bundle, values.photoKey);
  const field = (key: string, label: string, kind: 'text' | 'textarea' = 'text', wide = false) => (
    <label className={`sendflow-admin-field ${wide ? 'sendflow-admin-field-wide' : ''}`} htmlFor={`founder-${key}`}>
      <span>{label}</span>
      {kind === 'textarea' ? (
        <textarea id={`founder-${key}`} value={String(values[key] ?? '')} rows={4} onChange={(event) => update(key, event.target.value)} />
      ) : (
        <input id={`founder-${key}`} value={String(values[key] ?? '')} onChange={(event) => update(key, event.target.value)} />
      )}
    </label>
  );

  return (
    <section className="sendflow-admin-founder-card" aria-labelledby="founder-editor-title">
      <div className="sendflow-admin-assignment-head">
        <div>
          <p className="sendflow-admin-overline">Page « À propos »</p>
          <h3 id="founder-editor-title">Profil du CEO / fondateur</h3>
        </div>
        <UserRound size={19} />
      </div>
      <p className="sendflow-admin-founder-intro">Ces informations alimentent la page « Découvrir SendFlow ». Le contenu est éditable en français et en anglais.</p>
      <div className="sendflow-admin-form-grid">
        {field('name', 'Nom affiché')}
        {field('email', 'Gmail professionnel du CEO', 'text')}
        {field('roleFr', 'Rôle · FR')}
        {field('roleEn', 'Rôle · EN')}
        {field('educationFr', 'Formation / parcours · FR', 'textarea')}
        {field('educationEn', 'Formation / parcours · EN', 'textarea')}
        {field('shortBioFr', 'Biographie courte · FR', 'textarea', true)}
        {field('shortBioEn', 'Biographie courte · EN', 'textarea', true)}
        {field('storyFr', 'Histoire / citation · FR', 'textarea', true)}
        {field('storyEn', 'Histoire / citation · EN', 'textarea', true)}
        {field('visionFr', 'Vision · FR', 'textarea', true)}
        {field('visionEn', 'Vision · EN', 'textarea', true)}
        {field('missionFr', 'Mission · FR', 'textarea', true)}
        {field('missionEn', 'Mission · EN', 'textarea', true)}
        {field('linkedinUrl', 'Profil LinkedIn')}
        {field('websiteUrl', 'Site ou portfolio du CEO')}
        {field('instagramUrl', 'Instagram du CEO')}
        {field('xUrl', 'X / Twitter du CEO')}
      </div>
      <div className="sendflow-admin-founder-media">
        <label className="sendflow-admin-field" htmlFor="founder-photo-key">
          <span>Photo de profil · média de la galerie</span>
          <select id="founder-photo-key" value={String(values.photoKey ?? '')} onChange={(event) => update('photoKey', event.target.value)}>
            <option value="">Aucun média · afficher les initiales</option>
            {bundle.media.filter((item) => String(item.mimeType ?? '').startsWith('image/') || item.kind === 'image' || item.kind === 'portrait').map((item) => (
              <option key={String(item.slug ?? item.id)} value={String(item.slug ?? item.id)}>{String(item.slug ?? item.id)}</option>
            ))}
          </select>
        </label>
        <div className="sendflow-admin-founder-preview">
          <MediaThumb media={photo} label="Aperçu de la photo du fondateur" large />
          <span>{photo ? 'Cette image sera affichée sur la page de présentation.' : 'Ajoute d’abord une image dans Médias pour pouvoir la sélectionner ici.'}</span>
        </div>
      </div>
      <div className="sendflow-admin-founder-foot">
        <label className="sendflow-admin-toggle-field" htmlFor="founder-visible">
          <span><strong>Profil visible</strong><small>Masqué, la page utilise le contenu de secours.</small></span>
          <input id="founder-visible" type="checkbox" checked={Boolean(values.isVisible)} onChange={(event) => update('isVisible', event.target.checked)} />
          <span className="sendflow-admin-toggle"><i /></span>
        </label>
        <button className="sendflow-admin-button sendflow-admin-button-primary" disabled={saving} onClick={() => onSave(values)} data-testid="button-save-founder">
          {saving ? <LoaderCircle className="sendflow-admin-spin" size={16} /> : <Save size={16} />} {saving ? 'Enregistrement…' : 'Enregistrer le profil'}
        </button>
      </div>
    </section>
  );
}

const siteSettingsDefaults: Record<string, Primitive> = {
  supportEmail: 'support@sendflow.studio',
  supportPhone: '',
  websiteUrl: '',
  linkedinUrl: '',
  instagramUrl: '',
  facebookUrl: '',
  companyName: 'Flow Digital SARL',
  legalForm: 'Société à responsabilité limitée',
  legalAddress: 'Côte d’Ivoire, Abidjan, Cocody Riviera Palmeraie',
  legalEmail: 'support@sendflow.studio',
  footerAddressFlag: '🇨🇮',
  footerAddressCountry: 'Côte d’Ivoire',
  footerAddress: 'Abidjan, Cocody Riviera Palmeraie',
  regulatorNameFr: 'Régulateur à confirmer',
  regulatorNameEn: 'Regulator to be confirmed',
  regulatorLogoKey: '',
  googlePlayUrl: '',
  appStoreUrl: '',
  appGalleryUrl: '',
};

function SiteSettingsEditor({
  bundle,
  saving,
  onSave,
}: {
  bundle: Bundle;
  saving: boolean;
  onSave: (values: Record<string, Primitive>) => void;
}) {
  const [values, setValues] = useState<Record<string, Primitive>>(() => ({ ...siteSettingsDefaults, ...(bundle.settings ?? {}) }));
  useEffect(() => {
    setValues({ ...siteSettingsDefaults, ...(bundle.settings ?? {}) });
  }, [bundle.settings]);

  const update = (key: string, value: Primitive) => setValues((current) => ({ ...current, [key]: value }));
  const field = (key: string, label: string, type: 'text' | 'email' = 'text') => (
    <label className="sendflow-admin-field" htmlFor={`site-settings-${key}`}>
      <span>{label}</span>
      <input id={`site-settings-${key}`} type={type} value={String(values[key] ?? '')} onChange={(event) => update(key, event.target.value)} />
    </label>
  );

  return (
    <section className="sendflow-admin-founder-card" aria-labelledby="site-settings-editor-title">
      <div className="sendflow-admin-founder-head">
        <div><p className="sendflow-admin-overline">Coordonnées globales</p><h3 id="site-settings-editor-title">Support et liens du site</h3></div>
        <SlidersHorizontal size={19} className="text-[#6d35d8]" />
      </div>
      <p className="sendflow-admin-founder-intro">Ces coordonnées sont distinctes du Gmail professionnel du CEO et alimentent les points de contact publics de SendFlow.</p>
      <div className="sendflow-admin-form-grid">
        {field('supportEmail', 'Email support public', 'email')}
        {field('supportPhone', 'Téléphone support')}
        {field('websiteUrl', 'Site officiel')}
        {field('linkedinUrl', 'LinkedIn SendFlow')}
        {field('instagramUrl', 'Instagram SendFlow')}
        {field('facebookUrl', 'Facebook SendFlow')}
        {field('companyName', 'Dénomination légale')}
        {field('legalForm', 'Forme juridique')}
        {field('legalAddress', 'Adresse légale', 'text')}
        {field('legalEmail', 'Email légal', 'email')}
        {field('footerAddressFlag', 'Drapeau affiché dans les adresses')}
        {field('footerAddressCountry', 'Pays affiché dans les adresses')}
        {field('footerAddress', 'Adresse affichée dans le footer')}
        {field('regulatorNameFr', 'Régulateur · FR')}
        {field('regulatorNameEn', 'Régulateur · EN')}
        {field('regulatorLogoKey', 'Logo du régulateur · clé média')}
        {field('googlePlayUrl', 'Lien Google Play', 'text')}
        {field('appStoreUrl', 'Lien App Store', 'text')}
        {field('appGalleryUrl', 'Lien AppGallery', 'text')}
      </div>
      <div className="sendflow-admin-founder-foot">
        <span className="sendflow-admin-muted">Les champs de lien peuvent rester vides si le profil n’est pas encore publié.</span>
        <button className="sendflow-admin-button sendflow-admin-button-primary" disabled={saving} onClick={() => onSave(values)} data-testid="button-save-site-settings">
          {saving ? <LoaderCircle className="sendflow-admin-spin" size={16} /> : <Save size={16} />} {saving ? 'Enregistrement…' : 'Enregistrer les coordonnées'}
        </button>
      </div>
    </section>
  );
}

function AssignmentEditor({
  bundle,
  selectedCountry,
  saving,
  onCountryChange,
  onSave,
}: {
  bundle: Bundle;
  selectedCountry: number | undefined;
  saving: boolean;
  onCountryChange: (countryId: number) => void;
  onSave: (operatorIds: number[]) => void;
}) {
  const country = bundle.countries.find((item) => item.id === selectedCountry);
  const assigned = useMemo(() => new Set(bundle.countryOperators.filter((item) => item.countryId === selectedCountry).map((item) => item.operatorId)), [bundle.countryOperators, selectedCountry]);
  const [draft, setDraft] = useState<Set<number>>(assigned);
  useEffect(() => setDraft(assigned), [selectedCountry, assigned]);
  if (!country) return null;
  return (
    <aside className="sendflow-admin-assignment">
      <div className="sendflow-admin-assignment-head"><div><p className="sendflow-admin-overline">Réseaux disponibles</p><h3>{country.nameFr} <span>{country.code}</span></h3></div><Users size={19} /></div>
      <p>Sélectionnez les opérateurs visibles pour ce pays. L’ordre suit la sélection ci-dessous.</p>
      <div className="sendflow-admin-check-list">
        {bundle.operators.length === 0 ? <div className="sendflow-admin-empty-small">Aucun opérateur à associer.</div> : bundle.operators.map((operator) => {
          const checked = draft.has(Number(operator.id));
          return (
            <label className={`sendflow-admin-check-row ${checked ? 'is-checked' : ''}`} key={String(operator.id)} htmlFor={`operator-${operator.id}`}>
              <input id={`operator-${operator.id}`} type="checkbox" checked={checked} onChange={() => setDraft((current) => { const next = new Set(current); if (next.has(Number(operator.id))) next.delete(Number(operator.id)); else next.add(Number(operator.id)); return next; })} />
              <span className="sendflow-admin-check-box">{checked && <Check size={13} />}</span>
              <MediaThumb media={mediaForKey(bundle, operator.logoKey)} label={`Logo ${String(operator.name ?? 'opérateur')}`} />
              <span>{String(operator.name)}</span>
              <small>{operator.slug}</small>
            </label>
          );
        })}
      </div>
      <button className="sendflow-admin-button sendflow-admin-button-primary sendflow-admin-button-full" disabled={saving} onClick={() => onSave(Array.from(draft))} data-testid="button-save-assignments">
        {saving ? <LoaderCircle className="sendflow-admin-spin" size={16} /> : <Save size={16} />} Enregistrer les réseaux
      </button>
      <div className="sendflow-admin-country-switcher"><span>Pays</span><select value={String(selectedCountry)} onChange={(event) => onCountryChange(Number(event.target.value))}>{bundle.countries.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.nameFr}</option>)}</select></div>
    </aside>
  );
}

export default function AdminPage() {
  const [bundle, setBundle] = useState<Bundle>(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminHttpError | null>(null);
  const [activeResource, setActiveResource] = useState<ResourceKey>('content');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<{ resource: ResourceKey; item: RecordItem | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [founderSaving, setFounderSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<number | undefined>();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const loadBundle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Bundle>('/api/admin/landing');
      setBundle({ ...emptyBundle(), ...data });
      setSelectedCountry((current) => current ?? data.countries?.[0]?.id);
    } catch (caught) {
      setError(caught instanceof AdminHttpError ? caught : new AdminHttpError(0, 'Le bundle éditorial est indisponible.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadBundle(); }, [loadBundle]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const config = resourceConfigs[activeResource];
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = bundle[activeResource] ?? [];
    if (!query) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(query)));
  }, [activeResource, bundle, search]);
  const totalEntries = Object.values(bundle).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
  const visibleEntries = Object.values(bundle).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.filter((item) => !('isVisible' in item) || item.isVisible !== false).length : 0), 0);

  const chooseResource = (resource: ResourceKey) => {
    setActiveResource(resource);
    setSearch('');
    setMobileNavOpen(false);
  };

  const updateLocal = (resource: ResourceKey, next: RecordItem[]) => setBundle((current) => ({ ...current, [resource]: next }));

  const saveResource = async (values: Record<string, Primitive>) => {
    if (!editor) return;
    if (editor.resource === 'media' && !editor.item?.id && !values.storagePath) {
      setNotice({ tone: 'error', text: 'Choisis une image dans ta galerie avant d’enregistrer le média.' });
      return;
    }
    setSaving(true);
    try {
      const path = `/api/admin/landing/${resourceConfigs[editor.resource].apiResource}${editor.item?.id ? `/${editor.item.id}` : ''}`;
      const data = await apiRequest<RecordItem>(path, { method: editor.item?.id ? 'PATCH' : 'POST', body: JSON.stringify(values) });
      const rows = bundle[editor.resource];
      updateLocal(editor.resource, editor.item?.id ? rows.map((row) => row.id === data.id ? data : row) : [...rows, data]);
      setEditor(null);
      setNotice({ tone: 'success', text: `${resourceConfigs[editor.resource].singular[0].toUpperCase()}${resourceConfigs[editor.resource].singular.slice(1)} enregistré(e).` });
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'Impossible d’enregistrer ce contenu.' });
    } finally {
      setSaving(false);
    }
  };

  const uploadMediaFile = async (file: File) => {
    setUploadingMedia(true);
    try {
      const upload = await apiRequest<{ uploadURL: string; storagePath: string; publicUrl: string }>('/api/admin/landing/media/upload-url', {
        method: 'POST',
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const response = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new AdminHttpError(response.status, 'Le fichier n’a pas pu être envoyé vers App Storage.');
      return { storagePath: upload.storagePath, publicUrl: upload.publicUrl };
    } finally {
      setUploadingMedia(false);
    }
  };

  const deleteResource = async (resource: ResourceKey, item: RecordItem) => {
    if (!item.id || !window.confirm(`Supprimer ${resourceConfigs[resource].singular} ? Cette action est définitive.`)) return;
    setDeleting(item.id);
    try {
      await apiRequest<void>(`/api/admin/landing/${resourceConfigs[resource].apiResource}/${item.id}`, { method: 'DELETE' });
      updateLocal(resource, bundle[resource].filter((row) => row.id !== item.id));
      setNotice({ tone: 'success', text: 'Élément supprimé.' });
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'Impossible de supprimer cet élément.' });
    } finally {
      setDeleting(null);
    }
  };

  const saveAssignments = async (operatorIds: number[]) => {
    if (!selectedCountry) return;
    setAssignmentSaving(true);
    try {
      await apiRequest(`/api/admin/landing/countries/${selectedCountry}/operators`, { method: 'PUT', body: JSON.stringify({ operatorIds }) });
      setBundle((current) => ({ ...current, countryOperators: [...current.countryOperators.filter((assignment) => assignment.countryId !== selectedCountry), ...operatorIds.map((operatorId, orderIndex) => ({ countryId: selectedCountry, operatorId, orderIndex }))] }));
      setNotice({ tone: 'success', text: 'Les réseaux du pays sont à jour.' });
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'Impossible d’enregistrer les associations.' });
    } finally {
      setAssignmentSaving(false);
    }
  };

  const saveFounder = async (values: Record<string, Primitive>) => {
    setFounderSaving(true);
    try {
      const saved = await apiRequest<RecordItem>('/api/admin/landing/founder', { method: 'PUT', body: JSON.stringify(values) });
      setBundle((current) => ({ ...current, founder: saved }));
      setNotice({ tone: 'success', text: 'Le profil du fondateur est à jour.' });
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'Impossible d’enregistrer le profil du fondateur.' });
    } finally {
      setFounderSaving(false);
    }
  };

  const saveSiteSettings = async (values: Record<string, Primitive>) => {
    setSettingsSaving(true);
    try {
      const saved = await apiRequest<RecordItem>('/api/admin/landing/settings', { method: 'PUT', body: JSON.stringify(values) });
      setBundle((current) => ({ ...current, settings: saved }));
      setNotice({ tone: 'success', text: 'Les coordonnées du site sont à jour.' });
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'Impossible d’enregistrer les coordonnées du site.' });
    } finally {
      setSettingsSaving(false);
    }
  };

  if (error?.status === 401 || error?.status === 403 || error?.status === 503) {
    return <UnauthorizedState status={error.status} onRetry={() => void loadBundle()} />;
  }

  return (
    <div className="sendflow-admin-shell">
      <aside className={`sendflow-admin-sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="sendflow-admin-brand">
          <span className="sendflow-admin-brand-mark">S</span>
          <div><strong>SendFlow</strong><span>Editorial desk</span></div>
          <button className="sendflow-admin-icon-button sendflow-admin-sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Fermer le menu"><X size={18} /></button>
        </div>
        <div className="sendflow-admin-sidebar-rule" />
        <p className="sendflow-admin-nav-label">Contenu du site</p>
        <nav className="sendflow-admin-nav" aria-label="Ressources éditoriales">
          {navigation.slice(0, 8).map(({ key: resource, icon: Icon }) => <button key={resource} className={activeResource === resource ? 'is-active' : ''} onClick={() => chooseResource(resource)} data-testid={`nav-${resource}`}><Icon size={16} /><span>{resourceConfigs[resource].label}</span>{activeResource === resource && <ChevronRight size={14} />}</button>)}
        </nav>
        <p className="sendflow-admin-nav-label sendflow-admin-nav-label-spaced">Conformité</p>
        <nav className="sendflow-admin-nav">
          {navigation.slice(8).map(({ key: resource, icon: Icon }) => <button key={resource} className={activeResource === resource ? 'is-active' : ''} onClick={() => chooseResource(resource)} data-testid={`nav-${resource}`}><Icon size={16} /><span>{resourceConfigs[resource].label}</span>{activeResource === resource && <ChevronRight size={14} />}</button>)}
        </nav>
        <div className="sendflow-admin-sidebar-bottom"><span className="sendflow-admin-status-dot" /> API éditoriale connectée<div><LockKeyhole size={13} /> Accès opérateur</div></div>
      </aside>
      {mobileNavOpen && <button className="sendflow-admin-mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Fermer le menu" />}
      <main className="sendflow-admin-main">
        <header className="sendflow-admin-topbar">
          <button className="sendflow-admin-icon-button sendflow-admin-mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Ouvrir le menu"><Menu size={20} /></button>
          <div className="sendflow-admin-breadcrumb"><span>SendFlow</span><ChevronRight size={14} /><strong>Admin</strong><ChevronRight size={14} /><span>{config.label}</span></div>
          <div className="sendflow-admin-topbar-actions"><span className="sendflow-admin-live-dot" /> <span>Production</span><a href="/" target="_blank" rel="noreferrer" className="sendflow-admin-view-link" data-testid="link-view-site">Voir le site <ArrowUpRight size={14} /></a></div>
        </header>
        <div className="sendflow-admin-content">
          <section className="sendflow-admin-welcome">
            <div><p className="sendflow-admin-overline">Contrôle éditorial</p><h1>Publier avec précision.</h1><p>Un espace calme pour maintenir la landing SendFlow en français et en anglais.</p></div>
            <div className="sendflow-admin-welcome-meta"><div><span>Dernière synchronisation</span><strong>{loading ? '—' : 'à l’instant'}</strong></div><button className="sendflow-admin-button sendflow-admin-button-quiet" onClick={() => void loadBundle()} disabled={loading} data-testid="button-refresh-bundle"><RefreshCw size={15} className={loading ? 'sendflow-admin-spin' : ''} /> Actualiser</button></div>
          </section>
          {!loading && !error && (
            <div className="sendflow-admin-stats">
              <StatCard label="Entrées éditoriales" value={totalEntries} accent="blue" />
              <StatCard label="Entrées visibles" value={visibleEntries} accent="mint" />
              <StatCard label="Pays couverts" value={bundle.countries.length} accent="yellow" />
              <StatCard label="Médias référencés" value={bundle.media.length} accent="lilac" />
            </div>
          )}
          <section className="sendflow-admin-workspace">
            <div className="sendflow-admin-section-head">
              <div><div className="sendflow-admin-section-title"><span className="sendflow-admin-section-icon"><ConfigIcon resource={activeResource} /></span><div><h2>{config.label}</h2><p>{config.description}</p></div></div></div>
              <button className="sendflow-admin-button sendflow-admin-button-primary" onClick={() => setEditor({ resource: activeResource, item: null })} disabled={loading || Boolean(error)} data-testid="button-add-resource"><Plus size={16} /> Ajouter</button>
            </div>
            {activeResource === 'countries' && !loading && bundle.countries.length > 0 && <AssignmentEditor bundle={bundle} selectedCountry={selectedCountry ?? bundle.countries[0].id} saving={assignmentSaving} onCountryChange={setSelectedCountry} onSave={saveAssignments} />}
            {activeResource === 'content' && !loading && <><FounderEditor bundle={bundle} saving={founderSaving} onSave={saveFounder} /><SiteSettingsEditor bundle={bundle} saving={settingsSaving} onSave={saveSiteSettings} /></>}
            {!loading && !error && (activeResource === 'media' || activeResource === 'operators') && <AssetStrip bundle={bundle} resource={activeResource} />}
            <div className="sendflow-admin-toolbar">
              <label className="sendflow-admin-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Rechercher dans ${config.label.toLowerCase()}`} data-testid="input-resource-search" /></label>
              <span className="sendflow-admin-result-count">{loading ? 'Chargement…' : `${visibleItems.length} élément${visibleItems.length > 1 ? 's' : ''}`}</span>
            </div>
            {loading ? <SkeletonRows /> : error ? <ErrorState message={error.message} onRetry={() => void loadBundle()} /> : visibleItems.length === 0 ? <EmptyState label={config.label} query={search} onAdd={() => setEditor({ resource: activeResource, item: null })} /> : (
              <div className="sendflow-admin-table-wrap">
                <table className="sendflow-admin-table">
                  <thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th className="sendflow-admin-actions-heading"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>{visibleItems.map((item, index) => <tr key={String(item.id ?? index)} data-testid={`row-${activeResource}-${item.id ?? index}`}>
                    {config.columns.map((column) => <td className={column.emphasis ? 'is-emphasis' : ''} key={column.key}>{column.key === 'isVisible' ? <span className={`sendflow-admin-pill ${item.isVisible === false ? 'is-muted' : 'is-published'}`}><span />{displayValue(item[column.key], activeResource, column.key, bundle)}</span> : <ResourceCell resource={activeResource} column={column} item={item} bundle={bundle} />}</td>)}
                    <td className="sendflow-admin-row-actions"><button className="sendflow-admin-icon-button" onClick={() => setEditor({ resource: activeResource, item })} disabled={!item.id} aria-label={`Modifier ${config.singular}`} data-testid={`button-edit-${activeResource}-${item.id ?? index}`}><Pencil size={15} /></button><button className="sendflow-admin-icon-button danger" onClick={() => void deleteResource(activeResource, item)} disabled={!item.id || deleting === item.id} aria-label={`Supprimer ${config.singular}`} data-testid={`button-delete-${activeResource}-${item.id ?? index}`}>{deleting === item.id ? <LoaderCircle className="sendflow-admin-spin" size={15} /> : <Trash2 size={15} />}</button><button className="sendflow-admin-icon-button" aria-label="Plus d’options" data-testid={`button-more-${activeResource}-${item.id ?? index}`}><MoreHorizontal size={15} /></button></td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
          <footer className="sendflow-admin-footer"><span>SendFlow Editorial Desk</span><span>Les modifications sont enregistrées directement sur la landing de production.</span><span>v1.0 · <a href={`mailto:${String(bundle.settings?.supportEmail || 'support@sendflow.studio')}`}>Besoin d’aide ?</a></span></footer>
        </div>
      </main>
      {notice && <div className={`sendflow-admin-notice ${notice.tone}`} role="status" data-testid="status-save-feedback">{notice.tone === 'success' ? <Check size={17} /> : <AlertTriangle size={17} />}<span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Fermer le message"><X size={14} /></button></div>}
      {editor && <EditorDialog config={resourceConfigs[editor.resource]} item={editor.item} bundle={bundle} saving={saving} uploading={uploadingMedia} onClose={() => setEditor(null)} onSave={saveResource} onUploadMedia={uploadMediaFile} />}
    </div>
  );
}

function ConfigIcon({ resource }: { resource: ResourceKey }) {
  const Icon = navigation.find((entry) => entry.key === resource)?.icon ?? FileText;
  return <Icon size={18} />;
}

function UnauthorizedState({ status, onRetry }: { status: number; onRetry: () => void }) {
  const message = status === 503 ? 'L’accès administrateur n’est pas configuré sur ce serveur.' : status === 401 ? 'Votre session n’est pas authentifiée.' : 'Votre compte ne possède pas les droits administrateur.';
  return <div className="sendflow-admin-gate"><div className="sendflow-admin-gate-card"><span className="sendflow-admin-gate-icon"><LockKeyhole size={24} /></span><p className="sendflow-admin-overline">Accès protégé</p><h1>Cette salle est réservée.</h1><p>{message}</p><div><button className="sendflow-admin-button sendflow-admin-button-primary" onClick={onRetry} data-testid="button-retry-authorization"><RefreshCw size={16} /> Réessayer</button><a href="/" className="sendflow-admin-button sendflow-admin-button-quiet" data-testid="link-return-home">Retour au site</a></div></div></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="sendflow-admin-empty-state sendflow-admin-error-state"><span className="sendflow-admin-empty-icon"><AlertTriangle size={22} /></span><h3>Impossible de charger le contenu.</h3><p>{message}</p><button className="sendflow-admin-button sendflow-admin-button-quiet" onClick={onRetry} data-testid="button-retry-load"><RefreshCw size={15} /> Réessayer</button></div>;
}

function EmptyState({ label, query, onAdd }: { label: string; query: string; onAdd: () => void }) {
  return <div className="sendflow-admin-empty-state"><span className="sendflow-admin-empty-icon">{query ? <Search size={22} /> : <UploadCloud size={22} />}</span><h3>{query ? 'Aucun résultat.' : `${label} est encore vide.`}</h3><p>{query ? 'Essayez une autre recherche ou effacez le filtre.' : 'Commencez par ajouter le premier élément de cette collection.'}</p>{!query && <button className="sendflow-admin-button sendflow-admin-button-primary" onClick={onAdd} data-testid="button-add-empty-state"><Plus size={16} /> Ajouter</button>}</div>;
}