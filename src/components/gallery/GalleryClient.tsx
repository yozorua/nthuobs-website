'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';

const MapPicker = dynamic(() => import('./MapPickerInner'), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

export type IntegrationRow = {
  filter: string;
  frames: number;
  exposureSec: number;
  gain: string;
  binning: string;
  date: string;
};

export type EquipmentData = {
  telescope: string;
  camera: string;
  mount: string;
  accessory: string;
  software: string;
  integration: IntegrationRow[];
};

export type GalleryLink = { title: string; url: string };

export type GalleryItemData = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: 'IMAGE' | 'VIDEO';
  filename: string;
  thumbname: string | null;
  heroname: string | null;
  webname: string | null;
  width: number | null;
  height: number | null;
  takenAt: string | null;
  createdAt: string;
  userId: string;
  uploaderEn: string;
  uploaderZh: string | null;
  equipment: Partial<EquipmentData> | null;
  lat: number | null;
  lng: number | null;
  links: GalleryLink[] | null;
};

// ─── Constants & helpers ─────────────────────────────────────────────────────

const CATEGORIES = ['all', 'deepsky', 'planet', 'landscape', 'event', 'other'] as const;
const MEMBER_ROLES = ['MEMBER', 'OPERATOR', 'MANAGER', 'ADMIN'];
const MANAGE_ROLES = ['MANAGER', 'ADMIN'];
const EQUIP_FIELDS = ['telescope', 'camera', 'mount', 'accessory', 'software'] as const;

function totalExposureSec(rows: IntegrationRow[]): number {
  return rows.reduce((s, r) => s + (Number(r.frames) || 0) * (Number(r.exposureSec) || 0), 0);
}

function formatDuration(sec: number): string {
  if (sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

function blankRow(): IntegrationRow {
  return { filter: '', frames: 1, exposureSec: 60, gain: '', binning: '1x1', date: '' };
}

// ─── EquipmentForm (shared between upload and edit) ──────────────────────────

type EqFormState = {
  telescope: string;
  camera: string;
  mount: string;
  accessory: string;
  software: string;
  integration: IntegrationRow[];
};

function EquipmentForm({
  value,
  onChange,
  dark = false,
}: {
  value: EqFormState;
  onChange: (v: EqFormState) => void;
  dark?: boolean;
}) {
  const t = useTranslations('gallery');

  const inputStyle: React.CSSProperties = dark
    ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e8e8e6' }
    : {};

  const labelCls = dark ? 'text-xs tracking-ultra uppercase' : 'label';
  const labelColor = dark ? 'rgba(255,255,255,0.4)' : undefined;

  const updateRow = (i: number, field: keyof IntegrationRow, val: string | number) => {
    const rows = value.integration.map((r, idx) =>
      idx === i ? { ...r, [field]: val } : r,
    );
    onChange({ ...value, integration: rows });
  };

  const addRow = () => onChange({ ...value, integration: [...value.integration, blankRow()] });

  const removeRow = (i: number) =>
    onChange({ ...value, integration: value.integration.filter((_, idx) => idx !== i) });

  const total = totalExposureSec(value.integration);

  return (
    <div className="flex flex-col gap-4">
      {/* Equipment fields */}
      <div>
        <p className={labelCls} style={{ color: labelColor, marginBottom: '0.75rem' }}>
          {t('equipmentSection')}
        </p>
        <div className="grid grid-cols-1 gap-2.5">
          {EQUIP_FIELDS.map((field) => (
            <div key={field} className="flex items-center gap-3">
              <span
                className="text-xs w-24 shrink-0"
                style={{ color: dark ? 'rgba(255,255,255,0.4)' : 'var(--ink-faint)' }}
              >
                {t(field)}
              </span>
              <input
                className="input flex-1 text-sm"
                style={inputStyle}
                value={value[field]}
                onChange={(e) => onChange({ ...value, [field]: e.target.value })}
                placeholder={t(`${field}Placeholder` as Parameters<typeof t>[0])}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Integration table */}
      <div>
        <p className={labelCls} style={{ color: labelColor, marginBottom: '0.75rem' }}>
          {t('integrationSection')}
        </p>
        {value.integration.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {(['filter', 'frames', 'expSec', 'gainIso', 'binning', 'intDate'] as const).map((col) => (
                    <th
                      key={col}
                      className="text-left pb-1.5 pr-2 font-normal"
                      style={{ color: dark ? 'rgba(255,255,255,0.35)' : 'var(--ink-faint)', whiteSpace: 'nowrap' }}
                    >
                      {t(col)}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {value.integration.map((row, i) => (
                  <tr key={i}>
                    {/* Filter */}
                    <td className="pr-2 pb-1.5">
                      <input
                        className="input text-xs"
                        style={{ ...inputStyle, width: '4.5rem' }}
                        value={row.filter}
                        onChange={(e) => updateRow(i, 'filter', e.target.value)}
                        placeholder="L"
                      />
                    </td>
                    {/* Frames */}
                    <td className="pr-2 pb-1.5">
                      <input
                        type="number"
                        min={1}
                        className="input text-xs"
                        style={{ ...inputStyle, width: '3.5rem' }}
                        value={row.frames}
                        onChange={(e) => updateRow(i, 'frames', parseInt(e.target.value) || 0)}
                      />
                    </td>
                    {/* Exposure (s) */}
                    <td className="pr-2 pb-1.5">
                      <input
                        type="number"
                        min={1}
                        className="input text-xs"
                        style={{ ...inputStyle, width: '4rem' }}
                        value={row.exposureSec}
                        onChange={(e) => updateRow(i, 'exposureSec', parseInt(e.target.value) || 0)}
                      />
                    </td>
                    {/* Gain/ISO */}
                    <td className="pr-2 pb-1.5">
                      <input
                        className="input text-xs"
                        style={{ ...inputStyle, width: '4rem' }}
                        value={row.gain}
                        onChange={(e) => updateRow(i, 'gain', e.target.value)}
                        placeholder="100"
                      />
                    </td>
                    {/* Binning */}
                    <td className="pr-2 pb-1.5">
                      <select
                        className="input text-xs"
                        style={{ ...inputStyle, width: '4.5rem' }}
                        value={row.binning}
                        onChange={(e) => updateRow(i, 'binning', e.target.value)}
                      >
                        {['1x1', '2x2', '3x3', '4x4'].map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </td>
                    {/* Date */}
                    <td className="pr-2 pb-1.5">
                      <input
                        type="date"
                        className="input text-xs"
                        style={{ ...inputStyle, width: '7rem' }}
                        value={row.date}
                        onChange={(e) => updateRow(i, 'date', e.target.value)}
                      />
                    </td>
                    {/* Remove */}
                    <td className="pb-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-sm leading-none"
                        style={{ color: dark ? 'rgba(255,255,255,0.3)' : 'var(--ink-faint)' }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between mt-1.5">
          <button
            type="button"
            onClick={addRow}
            className="text-xs tracking-wide"
            style={{ color: dark ? 'rgba(255,255,255,0.4)' : 'var(--ink-faint)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = dark ? 'rgba(255,255,255,0.8)' : 'var(--ink)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = dark ? 'rgba(255,255,255,0.4)' : 'var(--ink-faint)')
            }
          >
            {t('addIntRow')}
          </button>
          {value.integration.length > 0 && (
            <span className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.4)' : 'var(--ink-faint)' }}>
              {t('totalExposure')}: <strong style={{ color: dark ? 'rgba(255,255,255,0.75)' : 'var(--ink-secondary)' }}>{formatDuration(total)}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: (item: GalleryItemData) => void;
}) {
  const t = useTranslations('gallery');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [takenAt, setTakenAt] = useState('');
  const [eq, setEq] = useState<EqFormState>({
    telescope: '', camera: '', mount: '', accessory: '', software: '', integration: [],
  });
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [links, setLinks] = useState<GalleryLink[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleFile = (f: File) => {
    setError(null);
    const isImg = f.type.startsWith('image/');
    const isVid = f.type === 'video/mp4';
    if (!isImg && !isVid) { setError(t('fileTypeError')); return; }
    const max = isImg ? 100 * 1024 * 1024 : 500 * 1024 * 1024;
    if (f.size > max) { setError(t('fileTooLarge')); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const hasEquipment = EQUIP_FIELDS.some((f) => eq[f]) || eq.integration.length > 0;

  const submit = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    setError(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title.trim());
    fd.append('description', description);
    fd.append('category', category);
    if (takenAt) fd.append('takenAt', takenAt);
    if (hasEquipment) fd.append('equipment', JSON.stringify(eq));
    if (lat !== null && lng !== null) {
      fd.append('lat', String(lat));
      fd.append('lng', String(lng));
    }
    const validLinks = links.filter(l => l.title.trim() && l.url.trim());
    if (validLinks.length > 0) fd.append('links', JSON.stringify(validLinks));

    try {
      const result = await new Promise<GalleryItemData>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`${xhr.status}: ${xhr.responseText}`));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.open('POST', '/api/gallery');
        xhr.send(fd);
      });
      onUploaded(result);
    } catch (err) {
      setError(`${t('uploadError')} (${err instanceof Error ? err.message : 'unknown'})`);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4 pb-8 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl"
        style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between sticky top-0"
          style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg)', zIndex: 1 }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t('uploadTitle')}</p>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: 'var(--ink-faint)' }}>×</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer flex flex-col items-center justify-center gap-2 py-8 text-sm transition-colors duration-150"
            style={{
              border: `1px dashed ${dragOver ? 'var(--ink)' : 'var(--line)'}`,
              background: dragOver ? 'var(--bg-warm)' : 'transparent',
              color: 'var(--ink-faint)',
            }}
          >
            {file ? (
              <>
                <span className="text-lg" style={{ color: 'var(--ink-secondary)' }}>
                  {file.type.startsWith('video/') ? '▶' : '◈'}
                </span>
                <span style={{ color: 'var(--ink-secondary)' }}>{file.name}</span>
                <span className="text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </>
            ) : (
              <>
                <span className="text-2xl opacity-30">+</span>
                <span>{t('dropHere')}</span>
                <span className="text-xs">{t('orClick')}</span>
                <span className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>{t('fileHint')}</span>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/tiff,video/mp4"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {/* Title */}
          <div>
            <label className="label block mb-1.5">{t('titleField')}</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              maxLength={120}
            />
          </div>

          {/* Description */}
          <div>
            <label className="label block mb-1.5">{t('descField')}</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descPlaceholder')}
            />
          </div>

          {/* Category + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">{t('categoryField')}</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.filter((c) => c !== 'all').map((c) => (
                  <option key={c} value={c}>{t((`categories.${c}`) as Parameters<typeof t>[0])}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label block mb-1.5">{t('dateField')}</label>
              <input type="date" className="input" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
            </div>
          </div>

          {/* Divider */}
          <hr style={{ borderColor: 'var(--line)', borderTopWidth: 1, borderStyle: 'solid' }} />

          {/* Equipment + Integration */}
          <EquipmentForm value={eq} onChange={setEq} />

          {/* Divider */}
          <hr style={{ borderColor: 'var(--line)', borderTopWidth: 1, borderStyle: 'solid' }} />

          {/* Location */}
          <div>
            {showMap ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <label className="label">{t('locationField')}</label>
                  <div className="flex items-center gap-3">
                    {lat !== null && (
                      <button
                        type="button"
                        onClick={() => { setLat(null); setLng(null); }}
                        className="text-xs tracking-ultra uppercase transition-colors duration-150"
                        style={{ color: '#c0392b' }}
                      >
                        {t('removeLocation')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowMap(false)}
                      className="text-xs tracking-ultra uppercase transition-colors duration-150"
                      style={{ color: 'var(--ink-faint)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-faint)')}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div style={{ border: '1px solid var(--line)', overflow: 'hidden' }}>
                  <MapPicker lat={lat} lng={lng} onChange={(la, lo) => { setLat(la); setLng(lo); }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {lat !== null ? `${lat.toFixed(5)}, ${lng!.toFixed(5)}` : t('clickToPin')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) return;
                      navigator.geolocation.getCurrentPosition((pos) => {
                        setLat(pos.coords.latitude);
                        setLng(pos.coords.longitude);
                      });
                    }}
                    className="btn-outline text-xs"
                  >
                    {t('useMyLocation')}
                  </button>
                </div>
              </>
            ) : lat !== null ? (
              <div className="flex items-center justify-between">
                <div>
                  <label className="label mb-0.5 block">{t('locationField')}</label>
                  <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {lat.toFixed(5)}, {lng!.toFixed(5)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowMap(true)} className="btn-outline text-xs">
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLat(null); setLng(null); }}
                    className="text-xs tracking-ultra uppercase"
                    style={{ color: '#c0392b' }}
                  >
                    {t('removeLocation')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <label className="label">{t('locationField')}</label>
                <button type="button" onClick={() => setShowMap(true)} className="btn-outline text-xs">
                  {t('addLocation')}
                </button>
              </div>
            )}
          </div>

          {/* External Links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">{t('linksField')}</label>
              <button
                type="button"
                onClick={() => setLinks(l => [...l, { title: '', url: '' }])}
                className="btn-outline text-xs"
              >
                {t('addLink')}
              </button>
            </div>
            {links.map((link, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  className="input text-sm"
                  style={{ flex: '0 0 36%' }}
                  placeholder={t('linkTitle')}
                  value={link.title}
                  onChange={(e) => setLinks(l => l.map((lk, j) => j === i ? { ...lk, title: e.target.value } : lk))}
                />
                <input
                  className="input text-sm flex-1"
                  placeholder="https://..."
                  value={link.url}
                  onChange={(e) => setLinks(l => l.map((lk, j) => j === i ? { ...lk, url: e.target.value } : lk))}
                />
                <button
                  type="button"
                  onClick={() => setLinks(l => l.filter((_, j) => j !== i))}
                  className="flex items-center justify-center w-8 h-8 text-lg leading-none flex-shrink-0 transition-colors duration-150"
                  style={{ color: 'var(--ink-faint)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#c0392b')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-faint)')}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Progress */}
          {uploading && progress > 0 && (
            <div className="h-px w-full" style={{ background: 'var(--line)' }}>
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'var(--ink)' }}
              />
            </div>
          )}

          {error && <p className="text-xs" style={{ color: '#c0392b' }}>{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="btn-outline" disabled={uploading}>{t('cancel')}</button>
            <button
              onClick={submit}
              className="btn"
              disabled={uploading || !file || !title.trim()}
            >
              {uploading
                ? `${t('uploading')}${progress > 0 ? ` ${progress}%` : ''}`
                : t('submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Equipment & Integration display (in Lightbox) ───────────────────────────

function EquipmentDisplay({
  equipment,
}: {
  equipment: Partial<EquipmentData>;
}) {
  const t = useTranslations('gallery');
  const hasGear = EQUIP_FIELDS.some((f) => equipment[f]);
  const rows = equipment.integration ?? [];
  const total = totalExposureSec(rows);

  return (
    <div
      className="mt-3 pt-3"
      style={{
        borderTop: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* Equipment table */}
      {hasGear && (
        <div style={{ minWidth: 0 }}>
          <p className="label mb-2">
            {t('equipmentSection')}
          </p>
          <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '5.5rem' }} />
              <col />
            </colgroup>
            <tbody>
              {EQUIP_FIELDS.filter((f) => equipment[f]).map((f) => (
                <tr key={f}>
                  <td
                    className="text-xs pr-3 pb-0.5"
                    style={{ color: 'var(--ink-faint)', whiteSpace: 'nowrap', verticalAlign: 'top' }}
                  >
                    {t(f)}
                  </td>
                  <td className="text-xs pb-0.5" style={{ color: 'var(--ink-secondary)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    {equipment[f]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Integration table */}
      {rows.length > 0 && (
        <div style={{ minWidth: 0 }}>
          <p className="label mb-2">
            {t('integrationSection')}
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {(['filter', 'frames', 'expSec', 'gainIso', 'binning', 'intDate', 'totalPerRow'] as const).map((col) => (
                    <th
                      key={col}
                      className="text-left pr-4 pb-1.5 font-normal"
                      style={{ color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}
                    >
                      {t(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const rowTotal = (Number(row.frames) || 0) * (Number(row.exposureSec) || 0);
                  return (
                    <tr key={i}>
                      <td className="pr-4 pb-0.5" style={{ color: 'var(--ink)' }}>{row.filter || '—'}</td>
                      <td className="pr-4 pb-0.5" style={{ color: 'var(--ink-secondary)' }}>{row.frames}</td>
                      <td className="pr-4 pb-0.5" style={{ color: 'var(--ink-secondary)' }}>{row.exposureSec}s</td>
                      <td className="pr-4 pb-0.5" style={{ color: 'var(--ink-secondary)' }}>{row.gain || '—'}</td>
                      <td className="pr-4 pb-0.5" style={{ color: 'var(--ink-secondary)' }}>{row.binning}</td>
                      <td className="pr-4 pb-0.5" style={{ color: 'var(--ink-faint)' }}>{row.date ? row.date.replace(/-/g, '.') : '—'}</td>
                      <td className="pb-0.5" style={{ color: 'var(--ink-faint)' }}>{formatDuration(rowTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--line)' }}>
                  <td
                    colSpan={6}
                    className="text-xs pt-1.5 pr-4"
                    style={{ color: 'var(--ink-faint)' }}
                  >
                    {t('totalExposure')}
                  </td>
                  <td className="text-xs pt-1.5 font-medium" style={{ color: 'var(--ink-secondary)' }}>
                    {formatDuration(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  item,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  canManage,
  onDeleted,
  onSaved,
  locale,
}: {
  item: GalleryItemData;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  canManage: boolean;
  onDeleted: () => void;
  onSaved: (updated: Partial<GalleryItemData>) => void;
  locale: string;
}) {
  const t = useTranslations('gallery');
  const videoRef = useRef<HTMLVideoElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const scaleRef = useRef(1);

  const [editMode, setEditMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Zoom state
  const [zoomMode, setZoomMode] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showHint, setShowHint] = useState(false);
  const [hiResReady, setHiResReady] = useState(false);

  // Panel resize state
  const [panelWidth, setPanelWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [isMdPlus, setIsMdPlus] = useState(true);
  const resizeStartRef = useRef({ x: 0, width: 480 });
  const isResizingRef = useRef(false);

  // Edit form mirrors item fields
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDesc, setEditDesc] = useState(item.description ?? '');
  const [editCategory, setEditCategory] = useState(item.category);
  const [editTakenAt, setEditTakenAt] = useState(item.takenAt ? item.takenAt.slice(0, 10) : '');
  const [editEq, setEditEq] = useState<EqFormState>({
    telescope: (item.equipment?.telescope) ?? '',
    camera: (item.equipment?.camera) ?? '',
    mount: (item.equipment?.mount) ?? '',
    accessory: (item.equipment?.accessory) ?? '',
    software: (item.equipment?.software) ?? '',
    integration: item.equipment?.integration ?? [],
  });
  const [editLat, setEditLat] = useState<number | null>(item.lat);
  const [editLng, setEditLng] = useState<number | null>(item.lng);
  const [editShowMap, setEditShowMap] = useState(false);
  const [editLinks, setEditLinks] = useState<GalleryLink[]>(item.links ?? []);

  // Keep scaleRef in sync so the wheel handler (a stale closure) reads the latest value
  scaleRef.current = scale;

  // Clamp pan so the image edges never leave the viewport
  function clampPan(x: number, y: number, sc: number): { x: number; y: number } {
    const container = lightboxRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth) return { x, y };
    const { width: cW, height: cH } = container.getBoundingClientRect();
    const nat = img.naturalWidth / img.naturalHeight;
    // Rendered image dimensions under objectFit: contain
    let rW: number, rH: number;
    if (cW / cH > nat) { rH = cH; rW = cH * nat; }
    else                { rW = cW; rH = cW / nat; }
    const maxX = Math.max(0, (rW * sc - cW) / 2);
    const maxY = Math.max(0, (rH * sc - cH) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }

  // Reset when item changes
  useEffect(() => {
    setEditMode(false);
    setDeleteConfirm(false);
    setZoomMode(false);
    setScale(1);
    setPan({ x: 0, y: 0 });
    setHiResReady(false);
    setEditTitle(item.title);
    setEditDesc(item.description ?? '');
    setEditCategory(item.category);
    setEditTakenAt(item.takenAt ? item.takenAt.slice(0, 10) : '');
    setEditEq({
      telescope: item.equipment?.telescope ?? '',
      camera: item.equipment?.camera ?? '',
      mount: item.equipment?.mount ?? '',
      accessory: item.equipment?.accessory ?? '',
      software: item.equipment?.software ?? '',
      integration: item.equipment?.integration ?? [],
    });
    setEditLat(item.lat);
    setEditLng(item.lng);
    setEditShowMap(false);
    setEditLinks(item.links ?? []);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomMode) { setZoomMode(false); setScale(1); setPan({ x: 0, y: 0 }); return; }
        if (editMode) { setEditMode(false); return; }
        if (deleteConfirm) { setDeleteConfirm(false); return; }
        onClose();
      }
      if (!editMode && !deleteConfirm && !zoomMode) {
        if (e.key === 'ArrowLeft' && hasPrev) onPrev();
        if (e.key === 'ArrowRight' && hasNext) onNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomMode, editMode, deleteConfirm, hasPrev, hasNext, onClose, onPrev, onNext]);

  // Hint: show on zoom entry, fade out after 3 s (opacity transitions 1→0 over 1 s starting at 2 s)
  useEffect(() => {
    if (!zoomMode) { setShowHint(false); return; }
    setShowHint(true);
    const timer = setTimeout(() => setShowHint(false), 2000);
    return () => clearTimeout(timer);
  }, [zoomMode]);

  // When zoom mode is entered, preload the full-res original in the background
  const fullSrc = item.webname
    ? `/api/gallery/file/thumbs/${item.webname}`
    : `/api/gallery/file/${item.filename}`;
  useEffect(() => {
    if (!zoomMode || item.type !== 'IMAGE' || hiResReady) return;
    const img = new window.Image();
    img.onload = () => setHiResReady(true);
    img.src = fullSrc;
  }, [zoomMode, fullSrc, hiResReady, item.type]);

  // Viewport detection for responsive panel width
  useEffect(() => {
    const check = () => setIsMdPlus(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Panel resize mouse events
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = resizeStartRef.current.x - e.clientX;
      setPanelWidth(Math.max(300, Math.min(800, resizeStartRef.current.width + delta)));
    };
    const onUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsResizing(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Mouse-wheel zoom (only when in zoom mode)
  useEffect(() => {
    if (!zoomMode) return;
    const el = lightboxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newScale = Math.max(0.5, Math.min(8, scaleRef.current * factor));
      scaleRef.current = newScale;
      setScale(newScale);
      setPan(prev => clampPan(prev.x, prev.y, newScale));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomMode]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      const hasEq = EQUIP_FIELDS.some((f) => editEq[f]) || editEq.integration.length > 0;
      const res = await fetch(`/api/gallery/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          category: editCategory,
          takenAt: editTakenAt || null,
          equipment: hasEq ? editEq : null,
          lat: editLat,
          lng: editLng,
          links: editLinks.filter(l => l.title.trim() && l.url.trim()),
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onSaved(updated);
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/gallery/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  const uploader = locale === 'tw' && item.uploaderZh ? item.uploaderZh : item.uploaderEn;
  const hasEquipData =
    !!(item.equipment &&
      (EQUIP_FIELDS.some((f) => item.equipment![f]) || (item.equipment.integration?.length ?? 0) > 0));

  return (
    <div
      ref={lightboxRef}
      className="fixed inset-0 z-50 flex flex-col md:flex-row"
      style={{ background: 'var(--bg)', userSelect: (dragging || isResizing) ? 'none' : undefined, cursor: isResizing ? 'col-resize' : undefined }}
      onMouseMove={(e) => {
        if (!dragging) return;
        setPan(clampPan(e.clientX - dragStart.x, e.clientY - dragStart.y, scale));
      }}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
    >
      {/* Image + nav */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0" style={{ background: '#000' }}>
        {/* Floating close / exit-zoom button */}
        <button
          onClick={() => {
            if (zoomMode) { setZoomMode(false); setScale(1); setPan({ x: 0, y: 0 }); }
            else onClose();
          }}
          className="absolute top-3 left-3 z-20 w-12 h-12 flex items-center justify-center text-3xl leading-none transition-colors duration-150"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          ×
        </button>
        {hasPrev && !zoomMode && (
          <button
            onClick={onPrev}
            className="absolute left-0 top-0 bottom-0 px-4 flex items-center z-10"
            aria-label="Previous"
          >
            <span
              className="text-3xl transition-opacity duration-150"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              ‹
            </span>
          </button>
        )}

        <div
          className="flex items-center justify-center w-full h-full"
          style={{ padding: zoomMode ? 0 : '0.75rem 3.5rem' }}
        >
          {item.type === 'IMAGE' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              key={item.id}
              src={zoomMode && hiResReady
                ? fullSrc
                : item.webname
                  ? `/api/gallery/file/thumbs/${item.webname}`
                  : item.heroname
                    ? `/api/gallery/file/thumbs/${item.heroname}`
                    : `/api/gallery/file/${item.filename}`}
              alt={item.title}
              draggable={false}
              onClick={() => { if (!zoomMode) setZoomMode(true); }}
              onMouseDown={(e) => {
                if (!zoomMode) return;
                e.preventDefault();
                setDragging(true);
                setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
              }}
              style={{
                maxWidth: zoomMode ? undefined : '100%',
                maxHeight: zoomMode ? undefined : '100%',
                width: zoomMode ? '100%' : undefined,
                height: zoomMode ? '100%' : undefined,
                objectFit: zoomMode ? 'contain' : undefined,
                transform: zoomMode ? `translate(${pan.x}px, ${pan.y}px) scale(${scale})` : undefined,
                transformOrigin: 'center center',
                transition: dragging ? 'none' : 'transform 0.1s ease-out',
                cursor: zoomMode ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
                display: 'block',
              }}
            />
          ) : (
            <video
              ref={videoRef}
              key={item.id}
              src={`/api/gallery/file/${item.filename}`}
              controls
              className="max-w-full max-h-full block"
            />
          )}
        </div>

        {hasNext && !zoomMode && (
          <button
            onClick={onNext}
            className="absolute right-0 top-0 bottom-0 px-4 flex items-center z-10"
            aria-label="Next"
          >
            <span
              className="text-3xl transition-opacity duration-150"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              ›
            </span>
          </button>
        )}

        {/* Zoom hint — fades out after 3 s */}
        {zoomMode && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1 pointer-events-none"
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: 'rgba(255,255,255,0.4)',
              borderRadius: '2px',
              opacity: showHint ? 1 : 0,
              transition: 'opacity 1s ease-out',
            }}
          >
            {locale === 'tw' ? 'Esc 退出 · 滾輪縮放 · 拖曳移動' : 'Esc to exit · Scroll to zoom · Drag to pan'}
          </div>
        )}
      </div>

      {/* Info / Edit panel — hidden in zoom mode, right panel on desktop */}
      <div
        className="flex-shrink-0 overflow-y-auto max-h-[40vh] md:max-h-none border-t md:border-t-0 md:border-l relative"
        style={{
          display: zoomMode ? 'none' : undefined,
          borderColor: 'var(--line)',
          background: 'var(--bg)',
          width: isMdPlus ? panelWidth : undefined,
        }}
      >
        {/* Drag-to-resize handle */}
        <div
          className="absolute top-0 bottom-0 hidden md:block z-10 group"
          style={{ left: '-3px', width: '6px', cursor: 'col-resize' }}
          onMouseDown={(e) => {
            e.preventDefault();
            isResizingRef.current = true;
            setIsResizing(true);
            resizeStartRef.current = { x: e.clientX, width: panelWidth };
          }}
        >
          <div
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ background: 'var(--ink-faint)' }}
          />
        </div>
        {editMode ? (
          /* ── Edit form ── */
          <div className="px-6 py-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1">
                  {t('titleField')}
                </label>
                <input
                  className="input text-sm w-full"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label block mb-1">
                    {t('categoryField')}
                  </label>
                  <select
                    className="input text-sm w-full"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                  >
                    {CATEGORIES.filter((c) => c !== 'all').map((c) => (
                      <option key={c} value={c}>{t((`categories.${c}`) as Parameters<typeof t>[0])}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label block mb-1">
                    {t('dateField')}
                  </label>
                  <input
                    type="date"
                    className="input text-sm w-full"
                    value={editTakenAt}
                    onChange={(e) => setEditTakenAt(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="label block mb-1">
                {t('descField')}
              </label>
              <textarea
                className="input resize-none text-sm w-full"
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
            <EquipmentForm value={editEq} onChange={setEditEq} />

            {/* Location (edit) */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
              {editShowMap ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label">{t('locationField')}</label>
                    <div className="flex items-center gap-3">
                      {editLat !== null && (
                        <button
                          type="button"
                          onClick={() => { setEditLat(null); setEditLng(null); }}
                          className="text-xs tracking-ultra uppercase"
                          style={{ color: '#c0392b' }}
                        >
                          {t('removeLocation')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditShowMap(false)}
                        className="text-xs"
                        style={{ color: 'var(--ink-faint)' }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--line)', overflow: 'hidden' }}>
                    <MapPicker lat={editLat} lng={editLng} onChange={(la, lo) => { setEditLat(la); setEditLng(lo); }} height={200} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                      {editLat !== null ? `${editLat.toFixed(5)}, ${editLng!.toFixed(5)}` : t('clickToPin')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!navigator.geolocation) return;
                        navigator.geolocation.getCurrentPosition((pos) => {
                          setEditLat(pos.coords.latitude);
                          setEditLng(pos.coords.longitude);
                        });
                      }}
                      className="btn-outline text-xs"
                    >
                      {t('useMyLocation')}
                    </button>
                  </div>
                </>
              ) : editLat !== null ? (
                <div className="flex items-center justify-between">
                  <div>
                    <label className="label mb-0.5 block">{t('locationField')}</label>
                    <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                      {editLat.toFixed(5)}, {editLng!.toFixed(5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setEditShowMap(true)} className="btn-outline text-xs">{t('edit')}</button>
                    <button
                      type="button"
                      onClick={() => { setEditLat(null); setEditLng(null); }}
                      className="text-xs tracking-ultra uppercase"
                      style={{ color: '#c0392b' }}
                    >
                      {t('removeLocation')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <label className="label">{t('locationField')}</label>
                  <button type="button" onClick={() => setEditShowMap(true)} className="btn-outline text-xs">
                    {t('addLocation')}
                  </button>
                </div>
              )}
            </div>

            {/* External links (edit) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">{t('linksField')}</label>
                <button
                  type="button"
                  onClick={() => setEditLinks(l => [...l, { title: '', url: '' }])}
                  className="btn-outline text-xs"
                >
                  {t('addLink')}
                </button>
              </div>
              {editLinks.map((link, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    className="input text-sm"
                    style={{ flex: '0 0 36%' }}
                    placeholder={t('linkTitle')}
                    value={link.title}
                    onChange={(e) => setEditLinks(l => l.map((lk, j) => j === i ? { ...lk, title: e.target.value } : lk))}
                  />
                  <input
                    className="input text-sm flex-1"
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) => setEditLinks(l => l.map((lk, j) => j === i ? { ...lk, url: e.target.value } : lk))}
                  />
                  <button
                    type="button"
                    onClick={() => setEditLinks(l => l.filter((_, j) => j !== i))}
                    className="flex items-center justify-center w-8 h-8 text-lg leading-none flex-shrink-0 transition-colors duration-150"
                    style={{ color: 'var(--ink-faint)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#c0392b')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-faint)')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={saveEdit}
                disabled={saving || !editTitle.trim()}
                className="btn text-xs"
              >
                {saving ? t('savingEdit') : t('saveEdit')}
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="btn-outline text-xs"
              >
                {t('cancelEdit')}
              </button>
            </div>
          </div>
        ) : (
          /* ── Info view ── */
          <div className="px-6 py-4 flex flex-col gap-1">
            <div className="flex items-start justify-between gap-4" style={{ minWidth: 0 }}>
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                  <h2 className="text-base font-medium" style={{ color: 'var(--ink)' }}>
                    {item.title}
                  </h2>
                  <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>── {uploader}</span>
                </div>
                {(item.takenAt || item.category !== 'other') && (
                  <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
                    {[
                      item.takenAt && item.takenAt.slice(0, 10).replace(/-/g, '.'),
                      item.category !== 'other' && t((`categories.${item.category}`) as Parameters<typeof t>[0]),
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
                {item.description && (
                  <p
                    className="text-sm leading-relaxed mt-2"
                    style={{
                      color: 'var(--ink-secondary)',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {/* Edit icon */}
                {canManage && !editMode && (
                  <button
                    onClick={() => { setEditMode(true); setDeleteConfirm(false); }}
                    aria-label={t('edit')}
                    className="flex items-center justify-center w-8 h-8 transition-colors duration-150"
                    style={{ color: 'var(--ink-faint)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-faint)')}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.5 2.5l2 2-7.5 7.5H2v-2L9.5 2.5z"/>
                    </svg>
                  </button>
                )}
                {/* Delete icon */}
                {canManage && !editMode && (
                  <button
                    onClick={() => setDeleteConfirm(v => !v)}
                    aria-label={t('delete')}
                    className="flex items-center justify-center w-8 h-8 transition-colors duration-150"
                    style={{ color: deleteConfirm ? '#e74c3c' : 'var(--ink-faint)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#e74c3c')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = deleteConfirm ? '#e74c3c' : 'var(--ink-faint)')}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 4h10M5 4V2h4v2M4 4l1 8h4l1-8"/>
                    </svg>
                  </button>
                )}
                {/* Download */}
                <a
                  href={`/api/gallery/file/${item.filename}`}
                  download
                  aria-label={t('download')}
                  className="flex items-center justify-center w-8 h-8 transition-colors duration-150"
                  style={{ color: 'var(--ink-faint)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-faint)')}
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7.5 1.5v8M4.5 7l3 3 3-3M1.5 13.5h12"/>
                  </svg>
                </a>
                {/* Fullscreen — images only */}
                {item.type === 'IMAGE' && (
                  <button
                    onClick={() => setZoomMode(true)}
                    aria-label="Fullscreen"
                    className="flex items-center justify-center w-8 h-8 transition-colors duration-150"
                    style={{ color: 'var(--ink-faint)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-faint)')}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {/* Delete confirm — inline */}
            {deleteConfirm && (
              <div className="flex items-center gap-2 pt-1">
                <span style={{ color: '#e74c3c', fontSize: '12px' }}>{t('deleteConfirm')}</span>
                <button
                  onClick={doDelete}
                  disabled={deleting}
                  style={{ color: '#e74c3c', fontSize: '12px' }}
                  className="tracking-ultra uppercase"
                >
                  {deleting ? t('deleting') : t('delete')}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  style={{ color: 'var(--ink-faint)', fontSize: '12px' }}
                  className="tracking-ultra uppercase"
                >
                  {t('cancelEdit')}
                </button>
              </div>
            )}
            {hasEquipData && <EquipmentDisplay equipment={item.equipment!} />}
            {(item.lat !== null && item.lng !== null || !!(item.links?.length)) && (
              <div className="mt-2 flex gap-3">
                {item.lat !== null && item.lng !== null && (
                  <div style={{ flex: '1 1 0', minWidth: 0, border: '1px solid var(--line)', overflow: 'hidden' }}>
                    <MapPicker lat={item.lat} lng={item.lng} height={180} />
                  </div>
                )}
                {item.links && item.links.length > 0 && (
                  <div style={{ flex: '1 1 0', minWidth: 0 }} className="flex flex-col gap-2 justify-start">
                    {item.links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm transition-colors duration-150"
                        style={{ color: 'var(--ink-secondary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-secondary)')}
                      >
                        <svg width="12" height="12" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M4.5 2H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6.5"/>
                          <path d="M7 1h3m0 0v3m0-3L5.5 5.5"/>
                        </svg>
                        {link.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Gallery Client ──────────────────────────────────────────────────────

export default function GalleryClient({
  initialItems,
  sessionUserId,
  sessionUserRole,
  locale,
}: {
  initialItems: GalleryItemData[];
  sessionUserId: string | null;
  sessionUserRole: string | null;
  locale: string;
}) {
  const t = useTranslations('gallery');
  const [items, setItems] = useState<GalleryItemData[]>(initialItems);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const canUpload = Boolean(sessionUserRole && MEMBER_ROLES.includes(sessionUserRole));

  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);
  const lightboxItem = lightboxIdx !== null ? (filtered[lightboxIdx] ?? null) : null;
  const canManage = Boolean(
    lightboxItem &&
    sessionUserId &&
    (lightboxItem.userId === sessionUserId || MANAGE_ROLES.includes(sessionUserRole ?? '')),
  );

  // Scroll lock
  useEffect(() => {
    const locked = lightboxIdx !== null || uploadOpen;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightboxIdx, uploadOpen]);

  const openLightbox = useCallback((idx: number) => setLightboxIdx(idx), []);
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);

  const goPrev = useCallback(() => {
    setLightboxIdx((prev) =>
      prev !== null && filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : null,
    );
  }, [filtered.length]);

  const goNext = useCallback(() => {
    setLightboxIdx((prev) =>
      prev !== null && filtered.length > 0 ? (prev + 1) % filtered.length : null,
    );
  }, [filtered.length]);

  const onUploaded = (item: GalleryItemData) => {
    setItems((prev) => [item, ...prev]);
    setUploadOpen(false);
  };

  const onDeleted = useCallback(() => {
    if (!lightboxItem) return;
    const id = lightboxItem.id;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setLightboxIdx(null);
  }, [lightboxItem]);

  const onSaved = useCallback(
    (updated: Partial<GalleryItemData>) => {
      if (!lightboxItem) return;
      const id = lightboxItem.id;
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
    },
    [lightboxItem],
  );

  return (
    <div className="page-enter max-w-5xl mx-auto px-6 pt-8 pb-16">
      {/* Header */}
      <div
        className="mb-10 pb-8 flex items-end justify-between"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <div>
          <p className="label mb-3">{t('label')}</p>
          <h1 className="text-3xl font-light tracking-wider" style={{ color: 'var(--ink)' }}>
            {t('title')}
          </h1>
        </div>
        {canUpload && (
          <button onClick={() => setUploadOpen(true)} className="btn">
            {t('upload')}
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="text-xs tracking-ultra uppercase px-4 py-1.5 transition-colors duration-150"
              style={{
                border: '1px solid',
                borderColor: active ? 'var(--ink)' : 'var(--line)',
                color: active ? 'var(--bg)' : 'var(--ink-faint)',
                background: active ? 'var(--ink)' : 'transparent',
              }}
            >
              {t(`categories.${cat}`)}
            </button>
          );
        })}
      </div>

      {/* Mosaic grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t('noItems')}</p>
          {!canUpload && (
            <p className="text-xs mt-2" style={{ color: 'var(--ink-faint)' }}>{t('memberOnly')}</p>
          )}
        </div>
      ) : (
        <div style={{ columns: '3 180px', columnGap: '2px' }}>
          {filtered.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => openLightbox(idx)}
              className="block w-full group relative"
              style={{ breakInside: 'avoid', marginBottom: '2px', overflow: 'hidden' }}
            >
              {item.type === 'IMAGE' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbname
                    ? `/api/gallery/file/thumbs/${item.thumbname}`
                    : `/api/gallery/file/${item.filename}`}
                  alt={item.title}
                  className="w-full h-auto block"
                  loading="lazy"
                />
              ) : item.thumbname ? (
                <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/gallery/file/thumbs/${item.thumbname}`}
                    alt={item.title}
                    className="w-full h-full object-cover block"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl" style={{ color: 'rgba(255,255,255,0.7)', textShadow: '0 0 12px rgba(0,0,0,0.8)' }}>▶</span>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full flex items-center justify-center"
                  style={{ background: '#080808', aspectRatio: '16/9' }}
                >
                  <span className="text-3xl" style={{ color: 'rgba(255,255,255,0.35)' }}>▶</span>
                </div>
              )}
              <div
                className="absolute inset-0 flex items-end p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 55%)' }}
              >
                <span className="text-xs font-medium leading-tight text-white truncate w-full text-left">
                  {item.title}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxItem !== null && lightboxIdx !== null && (
        <Lightbox
          item={lightboxItem}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
          hasPrev={lightboxIdx > 0}
          hasNext={lightboxIdx < filtered.length - 1}
          canManage={canManage}
          onDeleted={onDeleted}
          onSaved={onSaved}
          locale={locale}
        />
      )}

      {/* Upload modal */}
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onUploaded={onUploaded} />}
    </div>
  );
}
