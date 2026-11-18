'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, Building2, Check, CheckCircle2, Circle, Clapperboard, ExternalLink, Eye, EyeOff, ImagePlus, LoaderCircle, LockKeyhole, LogOut, Pencil, Plus, Search, ShieldCheck, Star, Trash2, Upload, Users, WifiOff, X } from 'lucide-react';
import type { Brand, Creator, Reel, SiteContent } from '../lib/content-types';
import { ApiError, mediaFile, request, uploadMedia } from './api';
import { getInstagramReel } from '../lib/instagram';

type Section = 'reels' | 'creators' | 'brands';
type Notice = { type: 'success' | 'error'; text: string };
type Editor = ({ kind: 'reel'; value: Reel; isNew: boolean } | { kind: 'creator'; value: Creator; isNew: boolean } | { kind: 'brand'; value: Brand; isNew: boolean }) & { baseline?: string };
const DRAFT_KEY = 'vivid-studio-draft';

function rememberDraft(editor: Editor | null) {
  try {
    if (editor && editor.baseline && JSON.stringify(editor.value) !== editor.baseline) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ editor, savedAt: Date.now() }));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* In-memory draft recovery still works when browser storage is unavailable. */ }
}

function recoveredDraft(): Editor | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    const editor = stored?.editor;
    const age = Date.now() - stored?.savedAt;
    if (!editor || !Number.isFinite(stored.savedAt) || age < 0 || age > 24 * 60 * 60 * 1000 || !['reel', 'creator', 'brand'].includes(editor.kind) || typeof editor.isNew !== 'boolean' || typeof editor.baseline !== 'string') return null;
    const value = editor.value;
    if (editor.kind === 'reel' && value && value.brandId === undefined) value.brandId = '';
    const fields = editor.kind === 'reel' ? ['id', 'title', 'brand', 'brandId', 'creator', 'creatorId', 'category', 'description', 'image', 'video', 'views', 'reach', 'color'] : editor.kind === 'brand' ? ['id', 'name', 'category', 'description', 'logo', 'websiteUrl'] : ['id', 'name', 'category', 'specialty', 'bio', 'image', 'profileUrl', 'handle', 'followers'];
    const flags = editor.kind === 'brand' ? ['published', 'demo'] : ['featured', 'published', 'demo'];
    if (!value || !fields.every(field => typeof value[field] === 'string') || !flags.every(field => typeof value[field] === 'boolean')) return null;
    return editor as Editor;
  } catch { return null; }
}

function Dialog({ title, children, onClose, wide = false, locked = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; locked?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const lockedRef = useRef(locked);
  closeRef.current = onClose;
  lockedRef.current = locked;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !lockedRef.current) closeRef.current();
      if (event.key !== 'Tab') return;
      const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]):not([tabindex="-1"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); ref.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current || !ref.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current || !ref.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const overlay = ref.current?.parentElement;
    if (!viewport || !overlay) return;
    const resize = () => {
      overlay.style.setProperty('--studio-viewport-height', `${viewport.height}px`);
      overlay.style.setProperty('--studio-viewport-top', `${viewport.offsetTop}px`);
    };
    resize();
    viewport.addEventListener('resize', resize);
    viewport.addEventListener('scroll', resize);
    return () => { viewport.removeEventListener('resize', resize); viewport.removeEventListener('scroll', resize); };
  }, []);
  useEffect(() => { ref.current?.focus(); }, [title]);
  return <div className="studio-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !locked) onClose(); }}><div className={`studio-dialog${wide ? ' studio-dialog-wide' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><button className="studio-icon studio-dialog-close" aria-label="Close dialog" onClick={onClose} disabled={locked}><X size={20} /></button>{children}</div></div>;
}

function MediaField({ label, value, onChange, video = false, logo = false, onBusy, disabled, required = true, onSessionExpired }: { label: string; value: string; onChange: (value: string) => void; video?: boolean; logo?: boolean; onBusy: (busy: boolean) => void; disabled: boolean; required?: boolean; onSessionExpired: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setPreviewFailed(false), [value]);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    let selected: File;
    try { selected = mediaFile(file, video); }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Choose a supported file.');
      if (input.current) input.current.value = '';
      return;
    }
    setUploading(true); setProgress(0); onBusy(true); setError('');
    try {
      const data = await uploadMedia(selected, setProgress);
      setFileName(selected.name);
      onChange(data.url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionExpired();
      else setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
    finally { setUploading(false); onBusy(false); if (input.current) input.current.value = ''; }
  };
  return <div className="studio-field">
    <div className="studio-media-label">{label}{required && <span>Required to publish</span>}</div>
    {!video && value && <div className={`studio-cover-preview${logo ? ' studio-logo-preview' : ''}`}><PreviewImage src={value} alt={`${label} preview`} /></div>}
    {video && (/^\/(?!\/)/.test(value) || /^https:\/\//i.test(value)) && !previewFailed && <video className="studio-video-preview" src={value} controls playsInline preload="metadata" onError={() => setPreviewFailed(true)} aria-label={`${label} preview`} />}
    {value && <p className="studio-media-ready"><CheckCircle2 size={15} /><span>{fileName || `Current ${video ? 'video' : 'image'}`}</span></p>}
    <div className="studio-media-tools"><button type="button" className="studio-upload" disabled={disabled || uploading} onClick={() => input.current?.click()}>{uploading ? <LoaderCircle size={18} className="studio-spin" /> : <Upload size={18} />}{uploading ? `${progress}% uploaded` : value ? `Replace ${video ? 'video' : 'image'}` : `Upload ${video ? 'video' : 'image'}`}</button><span>{video ? 'MP4 or WebM · 100 MB max' : 'JPG, PNG, WebP or GIF · 10 MB max'}</span></div>
    {uploading && <div className="studio-media-progress" role="status"><progress value={progress} max={100} aria-label={`${label} upload progress`} /><span>{progress === 100 ? 'Finishing upload…' : 'Keep this tab open while uploading.'}</span></div>}
    <input ref={input} type="file" aria-label={`Upload ${label.toLowerCase()}`} accept={video ? 'video/mp4,video/webm,.mp4,.webm' : 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif'} className="studio-file-input" tabIndex={-1} onChange={event => void upload(event.target.files?.[0])} disabled={disabled || uploading} />
    {previewFailed && <p className="studio-help">Your video is added. This device could not show its preview.</p>}
    {error && <p className="studio-field-error" role="alert">{error}</p>}
  </div>;
}

function ReelVideoField(props: Omit<Parameters<typeof MediaField>[0], 'label' | 'video' | 'logo'>) {
  const startsWithLink = !props.value || Boolean(getInstagramReel(props.value)) || props.value.includes('instagram.com');
  const [mode, setMode] = useState<'instagram' | 'upload'>(startsWithLink ? 'instagram' : 'upload');
  const [link, setLink] = useState(startsWithLink ? props.value : '');
  const [upload, setUpload] = useState(startsWithLink ? '' : props.value);
  const switchMode = (next: 'instagram' | 'upload') => {
    setMode(next);
    props.onChange(next === 'instagram' ? link : upload);
  };
  const instagram = getInstagramReel(link);
  return <div className="studio-reel-source">
    <div className="studio-media-label">Reel video{props.required && <span>Required to publish</span>}</div>
    <div className="studio-source-options" role="group" aria-label="Reel video source">
      <button type="button" aria-pressed={mode === 'instagram'} disabled={props.disabled} onClick={() => switchMode('instagram')}>Instagram link</button>
      <button type="button" aria-pressed={mode === 'upload'} disabled={props.disabled} onClick={() => switchMode('upload')}>Upload video</button>
    </div>
    {mode === 'instagram' ? <>
      <label>Instagram reel link<input type="url" value={link} onChange={event => { setLink(event.target.value); props.onChange(event.target.value); }} maxLength={2048} required={props.required} disabled={props.disabled} placeholder="https://www.instagram.com/reel/…/" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
      <p className="studio-help">Paste the reel’s copied link. The reel must be public and allow embedding. Use the cover image above for your website’s cards.</p>
      {instagram && <a className="studio-reel-link" href={instagram.url} target="_blank" rel="noopener noreferrer">Check reel on Instagram<ExternalLink size={14} /></a>}
    </> : <MediaField {...props} label="Video file" value={upload} onChange={next => { setUpload(next); props.onChange(next); }} video />}
  </div>;
}

function PreviewImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const safe = /^\/(?!\/)/.test(src) || /^https:\/\//i.test(src);
  return safe && !failed ? <img src={src} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" /> : <div className={`studio-image-placeholder ${className}`}><ImagePlus size={30} /><span>{src ? 'Image preview unavailable' : 'Your image goes here'}</span></div>;
}

function ContentEditor({ editor, creators, brands, saving, onSave, onClose, onDraftChange, onSessionExpired, saveError, onErrorClear }: { editor: Editor; creators: Creator[]; brands: Brand[]; saving: boolean; onSave: (editor: Editor) => Promise<boolean>; onClose: () => void; onDraftChange: (editor: Editor) => void; onSessionExpired: () => void; saveError?: string; onErrorClear: () => void }) {
  const [draft, setDraft] = useState<Editor>(() => ({ ...editor, baseline: editor.baseline ?? JSON.stringify(editor.value) }));
  const [uploading, setUploading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(draft.value) !== draft.baseline;
  const blocked = saving || uploading;
  useEffect(() => { onDraftChange(draft); }, [draft, onDraftChange]);
  useEffect(() => {
    if (!uploading) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [uploading]);
  const close = () => { if (blocked) return; if (dirty) setConfirmClose(true); else onClose(); };
  const update = (key: string, value: string | boolean) => setDraft(previous => ({ ...previous, value: { ...previous.value, [key]: value } }) as Editor);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); onErrorClear();
    const image = draft.kind === 'brand' ? draft.value.logo : draft.value.image;
    let existingWordmark = false;
    if (draft.kind === 'brand' && !draft.isNew && draft.baseline) {
      try { const original = JSON.parse(draft.baseline); existingWordmark = original.published === true && original.logo === '' && image === ''; } catch { /* A recovered draft still requires a valid logo. */ }
    }
    if (draft.value.published && (!image.trim() && !existingWordmark || draft.kind === 'reel' && !draft.value.video.trim())) {
      setError(draft.kind === 'reel' ? 'Upload a cover image and add an Instagram reel link or video file, or turn off Published to save a draft.' : `Upload a ${draft.kind === 'brand' ? 'brand logo' : 'profile image'}, or turn off Published to save a draft.`);
      return;
    }
    const success = await onSave(draft);
    if (!success) setError('Your changes are still here. Resolve the error and save again.');
  };
  const value = draft.value;
  const isReel = draft.kind === 'reel';
  const isBrand = draft.kind === 'brand';
  const kindName = isReel ? 'reel' : isBrand ? 'brand' : 'creator';
  // Creator editing is temporarily disabled; keep the draft and data types for restoration.
  if (draft.kind === 'creator') return null;
  if (confirmClose) return <Dialog title="Discard changes?" onClose={() => setConfirmClose(false)}><div className="studio-confirm"><span className="studio-confirm-icon"><Pencil size={25} /></span><h2>Discard your changes?</h2><p>This {kindName} has unsaved edits.</p><div><button className="studio-secondary" onClick={() => setConfirmClose(false)}>Keep editing</button><button className="studio-danger" onClick={onClose}>Discard changes</button></div></div></Dialog>;
  return <Dialog title={`${editor.isNew ? 'Add' : 'Edit'} ${kindName}`} onClose={close} wide locked={blocked}>
    <div className="studio-editor-top"><h2>{editor.isNew ? 'Add' : 'Edit'} {kindName}</h2><p>{isReel ? 'Add an Instagram link or upload a video, then choose where it appears.' : isBrand ? 'Add a logo and details for home, work, and the marquee.' : 'Update the profile and choose where it appears.'}</p></div>
    <form onSubmit={submit} className="studio-editor-form">
      <div className="studio-editor-scroll"><div className="studio-editor-layout"><div className="studio-editor-fields"><fieldset disabled={blocked}>
        {draft.kind === 'reel' ? <>
          <section className="studio-form-section"><div className="studio-form-section-heading"><h3>Details</h3></div>
          <label>Reel title<input required value={draft.value.title} onChange={event => update('title', event.target.value)} maxLength={180} placeholder="A story worth stopping for" /></label>
          <label>Brand profile<select value={draft.value.brandId} onChange={event => { const brand = brands.find(item => item.id === event.target.value); setDraft(previous => previous.kind === 'reel' ? { ...previous, value: { ...previous.value, brandId: brand?.id || '', brand: brand?.name || previous.value.brand } } : previous); }}><option value="">Enter a brand name</option>{brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}{!brand.published ? ' (draft)' : ''}</option>)}</select></label>
          <div className="studio-form-row">{!draft.value.brandId && <label>Brand name<input value={draft.value.brand} onChange={event => update('brand', event.target.value)} maxLength={100} placeholder="Brand name" /></label>}<label>Category<input value={draft.value.category} onChange={event => update('category', event.target.value)} maxLength={100} placeholder="e.g. Fashion & lifestyle" /></label></div>
          {/* Creator fields temporarily disabled. Existing reel associations are preserved.
          <label>Creator profile<select value={draft.value.creatorId} onChange={event => { const creator = creators.find(item => item.id === event.target.value); setDraft(previous => previous.kind === 'reel' ? { ...previous, value: { ...previous.value, creatorId: creator?.id || '', creator: creator?.name || previous.value.creator } } : previous); }}><option value="">Enter a creator name</option>{creators.map(creator => <option key={creator.id} value={creator.id}>{creator.name}{!creator.published ? ' (draft)' : ''}</option>)}</select></label>
          {!draft.value.creatorId && <label>Creator name<input value={draft.value.creator} onChange={event => update('creator', event.target.value)} maxLength={100} placeholder="Who brought this story to life?" /></label>}
          */}
          <label>Description <span className="studio-optional">optional</span><textarea value={draft.value.description} onChange={event => update('description', event.target.value)} maxLength={3000} rows={3} placeholder="A little about the reel" /></label>
          </section><section className="studio-form-section"><div className="studio-form-section-heading"><h3>Media</h3></div>
          <MediaField label="Cover image" value={draft.value.image} onChange={next => update('image', next)} onBusy={setUploading} disabled={saving} required={value.published} onSessionExpired={onSessionExpired} />
          <ReelVideoField value={draft.value.video} onChange={next => update('video', next)} onBusy={setUploading} disabled={blocked} required={value.published} onSessionExpired={onSessionExpired} />
          </section><details className="studio-more-options"><summary>Views and reach <span>optional</span></summary><div className="studio-form-row"><label>Views<input value={draft.value.views} onChange={event => update('views', event.target.value)} maxLength={30} placeholder="e.g. 1.2M" /></label><label>Reach<input value={draft.value.reach} onChange={event => update('reach', event.target.value)} maxLength={30} placeholder="e.g. 850K" /></label></div></details>
        </> : draft.kind === 'brand' ? <>
          <section className="studio-form-section"><div className="studio-form-section-heading"><h3>Brand details</h3></div>
            <label>Brand name<input required value={draft.value.name} onChange={event => update('name', event.target.value)} maxLength={100} placeholder="The brand behind the story" /></label>
            <label>Category <span className="studio-optional">optional</span><input value={draft.value.category} onChange={event => update('category', event.target.value)} maxLength={100} placeholder="e.g. Fashion, technology, beauty" /></label>
            <label>Description <span className="studio-optional">optional</span><textarea value={draft.value.description} onChange={event => update('description', event.target.value)} maxLength={3000} rows={3} placeholder="A little about the brand" /></label>
          </section><section className="studio-form-section"><div className="studio-form-section-heading"><h3>Logo and website</h3></div>
            <MediaField label="Brand logo" value={draft.value.logo} onChange={next => update('logo', next)} onBusy={setUploading} disabled={saving} required={value.published} onSessionExpired={onSessionExpired} logo />
            <label>Brand website URL <span className="studio-optional">optional</span><input type="url" value={draft.value.websiteUrl} onChange={event => update('websiteUrl', event.target.value)} maxLength={2000} placeholder="https://brand.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
          </section>
        </> : null}
        {/* Creator profile form temporarily disabled.
        </> : <>
          <section className="studio-form-section"><div className="studio-form-section-heading"><h3>Profile</h3></div>
          <label>Creator name<input required value={draft.value.name} onChange={event => update('name', event.target.value)} maxLength={100} placeholder="The name behind the content" /></label>
          <div className="studio-form-row"><label>Category<input value={draft.value.category} onChange={event => update('category', event.target.value)} maxLength={100} placeholder="e.g. Beauty & wellness" /></label><label>Social handle<input value={draft.value.handle} onChange={event => update('handle', event.target.value)} maxLength={100} placeholder="@yourcreator" /></label></div>
          <label>Short introduction <span className="studio-optional">optional</span><input value={draft.value.specialty} onChange={event => update('specialty', event.target.value)} maxLength={180} placeholder="A style all their own." /></label>
          <label>Bio <span className="studio-optional">optional</span><textarea value={draft.value.bio} onChange={event => update('bio', event.target.value)} maxLength={3000} rows={3} placeholder="What makes this creator different?" /></label>
          </section><section className="studio-form-section"><div className="studio-form-section-heading"><h3>Photo and social profile</h3></div>
          <MediaField label="Profile image" value={draft.value.image} onChange={next => update('image', next)} onBusy={setUploading} disabled={saving} required={value.published} onSessionExpired={onSessionExpired} />
          <label>Social profile URL <span className="studio-optional">optional</span><input type="url" value={draft.value.profileUrl} onChange={event => update('profileUrl', event.target.value)} maxLength={2000} placeholder="https://instagram.com/…" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
          </section><details className="studio-more-options"><summary>Follower count <span>optional</span></summary><label>Followers<input value={draft.value.followers} onChange={event => update('followers', event.target.value)} maxLength={30} placeholder="e.g. 120K" /></label></details>
        </>}
        */}
        <section className="studio-form-section"><div className="studio-form-section-heading"><h3>Visibility</h3></div><div className="studio-settings"><label className="studio-check"><input type="checkbox" role="switch" checked={value.published} onChange={event => update('published', event.target.checked)} /><span><strong>Published</strong><small>{value.published ? isBrand ? 'Visible on home, work, and the home marquee.' : `Visible on the ${isReel ? 'work' : 'creators'} page.` : 'Draft. Hidden from the website.'}</small></span></label>{draft.kind !== 'brand' && <label className="studio-check"><input type="checkbox" role="switch" checked={draft.value.featured} onChange={event => update('featured', event.target.checked)} /><span><strong>Featured on home</strong><small>{value.published ? isReel ? 'Show on home. The first three featured reels appear in the hero, in priority order.' : 'Also show on the home page.' : 'Appears on home after publishing.'}</small></span></label>}</div></section>
        {/* Sample disclosure controls are paused; existing record flags are preserved.
        <details className="studio-more-options"><summary>Sample content disclosure</summary><label className="studio-check"><input type="checkbox" checked={value.demo} onChange={event => update('demo', event.target.checked)} /><span><strong>Mark as sample content</strong><small>Label illustrative profiles, media, and figures.</small></span></label></details>
        */}
      </fieldset></div></div></div>
      <div className="studio-editor-footer">{error ? <p className="studio-field-error" role="alert">{saveError || error}</p> : <span>{dirty ? 'Unsaved edits kept in this tab' : editor.isNew ? 'Ready when you are' : 'No unsaved changes'}</span>}<div><button type="button" className="studio-secondary" onClick={close} disabled={blocked}>Cancel</button><button type="submit" className="studio-primary" disabled={blocked}>{saving || uploading ? <LoaderCircle size={18} className="studio-spin" /> : <Check size={18} />}{saving ? 'Saving…' : uploading ? 'Uploading…' : 'Save changes'}</button></div></div>
    </form>
  </Dialog>;
}

export default function Studio() {
  const [session, setSession] = useState<{ authenticated: boolean; configured: boolean } | null>(null);
  const [content, setContent] = useState<SiteContent | null>(null);
  const [section, setSection] = useState<Section>('reels');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const loginRef = useRef(false);
  const [online, setOnline] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const retainedEditor = useRef<Editor | null>(null);
  const retainDraft = useCallback((draft: Editor) => { retainedEditor.current = draft; rememberDraft(draft); }, []);
  const [deleting, setDeleting] = useState<{ id: string; name: string; section: Section } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!editor || retainedEditor.current?.value.id !== editor.value.id) retainedEditor.current = editor;
  }, [editor]);
  useEffect(() => {
    const recovered = recoveredDraft();
    // if (recovered) { retainedEditor.current = recovered; setEditor(recovered); }
    // Skip saved creator drafts while creator management is disabled.
    if (recovered && recovered.kind !== 'creator') { retainedEditor.current = recovered; setEditor(recovered); }
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      const draft = retainedEditor.current;
      if (!draft?.baseline || JSON.stringify(draft.value) === draft.baseline) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    const remember = () => rememberDraft(retainedEditor.current);
    window.addEventListener('pagehide', remember);
    return () => { window.removeEventListener('beforeunload', prevent); window.removeEventListener('pagehide', remember); };
  }, []);
  const toast = useCallback((type: Notice['type'], message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setNotice({ type, text: message });
    if (type === 'success') toastTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const load = useCallback(async () => {
    setLoadError('');
    try {
      const info = await request<{ authenticated: boolean; configured: boolean }>('/api/admin/session');
      setSession(info);
      if (info.authenticated) setContent(await request<SiteContent>('/api/admin/content'));
      return info.authenticated;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSession(previous => ({ configured: previous?.configured ?? true, authenticated: false }));
        setContent(null);
      } else setLoadError(err instanceof Error ? err.message : 'Could not connect to your studio.');
      return false;
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (loginRef.current) return;
    loginRef.current = true;
    setLoggingIn(true); setNotice(null);
    try {
      await request('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      setPassword(''); const ready = await load();
      if (ready && editor) toast('success', 'Your unsaved edits are restored. Review and save when ready.');
    } catch (err) { toast('error', err instanceof Error ? err.message : 'Unable to sign in.'); }
    finally { loginRef.current = false; setLoggingIn(false); }
  };
  const closeEditor = () => { retainedEditor.current = null; rememberDraft(null); setEditor(null); };
  const logout = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try { await request('/api/admin/session', { method: 'DELETE' }); setSession(previous => previous ? { ...previous, authenticated: false } : null); setContent(null); closeEditor(); setDeleting(null); setNotice(null); }
    catch (err) { toast('error', err instanceof Error ? err.message : 'Unable to sign out.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const expireSession = () => {
    setEditor(retainedEditor.current); setContent(null); setDeleting(null);
    setSession(previous => previous ? { ...previous, authenticated: false } : null);
    toast('error', 'Your session expired. Sign in again; your unsaved editor is kept in this tab.');
  };
  const persist = async (next: SiteContent, message = 'Changes saved. Your website is up to date.'): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true); setNotice(null);
    try {
      const saved = await request<SiteContent>('/api/admin/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      setContent(saved); toast('success', message); return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        expireSession();
      } else if (err instanceof ApiError && err.status === 409) {
        try { setContent(await request<SiteContent>('/api/admin/content')); toast('error', 'Content changed in another session. The latest version is loaded; review your edits and save again.'); }
        catch { toast('error', 'Content changed elsewhere, but the latest version could not be loaded. Reconnect and try again. Your edits are kept.'); }
      } else if (err instanceof ApiError && err.outcomeUnknown) {
        try { setContent(await request<SiteContent>('/api/admin/content')); toast('error', 'The connection was interrupted. Latest saved content is loaded; review your edits before saving again.'); }
        catch { toast('error', err.message); }
      } else toast('error', err instanceof Error ? err.message : 'Unable to save. Please try again.');
      return false;
    } finally { savingRef.current = false; setSaving(false); }
  };
  const saveEditor = async (draft: Editor) => {
    if (!content || draft.kind === 'creator') return false;
    setEditor(draft);
    const list = draft.kind === 'reel' ? content.reels : draft.kind === 'brand' ? content.brands : content.creators;
    if (!draft.isNew && !list.some(item => item.id === draft.value.id)) {
      toast('error', 'This item was removed in another session. Close the editor and add it again if needed.');
      return false;
    }
    const next = { ...content };
    if (draft.kind === 'reel') next.reels = content.reels.some(item => item.id === draft.value.id) ? content.reels.map(item => item.id === draft.value.id ? draft.value : item) : [...content.reels, draft.value];
    else if (draft.kind === 'brand') next.brands = content.brands.some(item => item.id === draft.value.id) ? content.brands.map(item => item.id === draft.value.id ? draft.value : item) : [...content.brands, draft.value];
    // Creator saving temporarily disabled.
    // else next.creators = content.creators.some(item => item.id === draft.value.id) ? content.creators.map(item => item.id === draft.value.id ? draft.value : item) : [...content.creators, draft.value];
    const success = await persist(next, `${draft.kind === 'reel' ? 'Reel' : draft.kind === 'brand' ? 'Brand' : 'Creator'} saved${draft.value.published ? '. Your website is up to date.' : ' as a draft.'}`);
    if (success) closeEditor();
    return success;
  };
  const add = () => {
    const id = crypto.randomUUID();
    if (section === 'reels') setEditor({ kind: 'reel', isNew: true, value: { id, title: '', brand: '', brandId: '', creator: '', creatorId: '', category: '', description: '', image: '', video: '', views: '', reach: '', color: '#e6f8f2', featured: false, published: true, demo: false } });
    else if (section === 'brands') setEditor({ kind: 'brand', isNew: true, value: { id, name: '', category: '', description: '', logo: '', websiteUrl: '', published: true, demo: false } });
    // Creator creation temporarily disabled.
    // else setEditor({ kind: 'creator', isNew: true, value: { id, name: '', category: '', specialty: '', bio: '', image: '', profileUrl: '', handle: '', followers: '', featured: false, published: true, demo: false } });
  };
  const toggle = (id: string, key: 'featured' | 'published') => {
    if (!content) return;
    const next = { ...content, [section]: content[section].map(item => item.id !== id ? item : key === 'published' ? { ...item, published: !item.published } : 'featured' in item ? { ...item, featured: !item.featured } : item) };
    void persist(next);
  };
  const move = (id: string, direction: number) => {
    if (!content) return;
    const list = [...content[section]];
    const index = list.findIndex(item => item.id === id), target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    void persist({ ...content, [section]: list }, section === 'reels' ? 'Reel priority updated.' : 'Display order updated.');
  };
  const remove = async () => {
    if (!deleting || !content || deleting.section === 'creators') return;
    const next = { ...content, [deleting.section]: content[deleting.section].filter(item => item.id !== deleting.id) };
    // if (deleting.section === 'creators') next.reels = next.reels.map(reel => reel.creatorId === deleting.id ? { ...reel, creatorId: '' } : reel);
    if (deleting.section === 'brands') next.reels = next.reels.map(reel => reel.brandId === deleting.id ? { ...reel, brandId: '' } : reel);
    if (await persist(next, `${deleting.section === 'reels' ? 'Reel' : deleting.section === 'brands' ? 'Brand' : 'Creator'} removed.`)) setDeleting(null);
  };
  const visible = content?.[section].filter(item => {
    // const text = 'title' in item ? `${item.title} ${item.brand} ${item.creator} ${item.category}` : 'logo' in item ? `${item.name} ${item.category} ${item.description}` : `${item.name} ${item.category} ${item.handle}`;
    const text = 'title' in item ? `${item.title} ${item.brand} ${item.category}` : 'logo' in item ? `${item.name} ${item.category} ${item.description}` : '';
    return text.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || filter === 'featured' && 'featured' in item && item.featured || filter === 'published' && item.published || filter === 'draft' && !item.published);
  }) || [];
  const sectionName = section === 'reels' ? 'Reels' : section === 'brands' ? 'Brands' : 'Creators';
  const itemName = section === 'reels' ? 'reel' : section === 'brands' ? 'brand' : 'creator';
  const heroReelIds = content?.reels.filter(item => item.published && item.featured).slice(0, 3).map(item => item.id) || [];
  const notification = notice && (!session?.authenticated || !editor) && <div className={`studio-toast studio-toast-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.type === 'success' ? <CheckCircle2 size={19} /> : <Circle size={19} />}<span>{notice.text}</span><button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={16} /></button></div>;

  if (!session || session.authenticated && !content) return <div className="studio-loading"><img src="/images/vivid-logo.svg" alt="Vivid Media Works" width={289} height={98} />{loadError ? <><p role="alert">{loadError}</p><button className="studio-primary" onClick={() => void load()}>Try again</button></> : <><LoaderCircle size={25} className="studio-spin" /><p>Opening your studio…</p></>}</div>;
  if (!session.authenticated) return <div className="studio-login"><main className="studio-login-main">
    <a className="studio-brand" href="/" aria-label="Vivid Media Works home"><img src="/images/vivid-logo.svg" alt="Vivid Media Works" width={289} height={98} /></a>
    <div className="studio-login-box"><span className="studio-lock"><LockKeyhole size={24} /></span><h1>Sign in to your studio</h1>
      {/* <p>Manage your reels, creators, and brands.</p> */}
      <p>Manage your reels and brands.</p>
      {session.configured ? <form onSubmit={login}><label>Admin password<input type="password" name="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required placeholder="Enter your password" disabled={loggingIn} /></label><button type="submit" className="studio-primary" disabled={loggingIn}>{loggingIn ? <LoaderCircle size={18} className="studio-spin" /> : <ArrowUpRight size={18} />}{loggingIn ? 'Signing in…' : 'Sign in'}</button></form> : <div className="studio-setup"><h3>Set up studio access</h3><p>Add <code>VIVID_ADMIN_PASSWORD</code> (12+ characters) and <code>VIVID_SESSION_SECRET</code> (32+ characters) to <code>.env.local</code>, then restart the server.</p><button className="studio-secondary" onClick={() => void load()}>Check again</button></div>}
      {editor && <p className="studio-recovery-note">Your unsaved edits will reopen after sign-in.</p>}
      <span className="studio-login-note"><ShieldCheck size={15} /> Private admin access</span>
    </div><a href="/" className="studio-back"><ArrowLeft size={16} /> Back to website</a>
  </main>{notification}</div>;

  return <div className="studio-shell">
    <header className="studio-header"><div className="studio-header-inner"><a className="studio-brand" href="/"><img src="/images/vivid-logo.svg" alt="Vivid Media Works" width={289} height={98} /><span>Studio</span></a><div className="studio-header-actions"><a className="studio-secondary" href="/" target="_blank" rel="noopener noreferrer">View site <ExternalLink size={16} /></a><button className="studio-icon" aria-label="Sign out" title="Sign out" onClick={() => void logout()} disabled={saving}><LogOut size={19} /></button></div></div></header>
    <main className="studio-main"><div className="studio-main-content"><div className="studio-page-heading"><h1>Content studio</h1><p>Keep your website up to date.</p></div>
      {!online && <div className="studio-offline" role="status"><WifiOff size={18} /><span>You’re offline. Reconnect to save or upload. Your edits are kept in this tab.</span></div>}
      {/* Creators tab temporarily disabled.
      <nav className="studio-tabs" aria-label="Content type">{(['reels', 'creators', 'brands'] as const).map(value => <button key={value} className={section === value ? 'active' : ''} aria-pressed={section === value} onClick={() => { setSection(value); setQuery(''); setFilter('all'); }}>{value === 'reels' ? <Clapperboard size={18} /> : value === 'brands' ? <Building2 size={18} /> : <Users size={18} />}{value === 'reels' ? 'Reels' : value === 'brands' ? 'Brands' : 'Creators'}<span>{content![value].length}</span></button>)}</nav>
      */}
      <nav className="studio-tabs" aria-label="Content type">{(['reels', 'brands'] as const).map(value => <button key={value} className={section === value ? 'active' : ''} aria-pressed={section === value} onClick={() => { setSection(value); setQuery(''); setFilter('all'); }}>{value === 'reels' ? <Clapperboard size={18} /> : <Building2 size={18} />}{value === 'reels' ? 'Reels' : 'Brands'}<span>{content![value].length}</span></button>)}</nav>
      <div className="studio-content-heading"><div><h2>{sectionName}</h2><p>{content![section].filter(item => item.published).length} published{section === 'brands' ? ' · Home, work & marquee' : ` · ${content![section].filter(item => item.published && 'featured' in item && item.featured).length} featured on home`}</p></div><button className="studio-primary" onClick={add} disabled={saving}><Plus size={18} />Add {itemName}</button></div>
      <div className="studio-toolbar"><label className="studio-search"><Search size={17} /><input aria-label={`Search ${section}`} placeholder={
        // `Search ${section === 'reels' ? 'reels, brands, creators…' : section === 'brands' ? 'brands, categories…' : 'creators, categories…'}`
        `Search ${section === 'reels' ? 'reels, brands, categories…' : 'brands, categories…'}`
      } value={query} onChange={event => setQuery(event.target.value)} /></label><div className="studio-filters" role="group" aria-label="Filter content">{[['all', 'All'], ...(section === 'brands' ? [] : [['featured', 'Featured']]), ['published', 'Published'], ['draft', 'Drafts']].map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div></div>
      {visible.length ? <div className={`studio-content-grid studio-grid-${section}`}>{visible.map(item => {
        const reel = 'title' in item;
        const brand = 'logo' in item;
        const name = reel ? item.title : item.name;
        // const subtitle = reel ? item.creator && `with ${item.creator}` : brand ? item.description : item.handle || item.specialty;
        const subtitle = brand ? item.description : '';
        const edit: Editor = reel ? { kind: 'reel', value: item, isNew: false } : brand ? { kind: 'brand', value: item, isNew: false } : { kind: 'creator', value: item, isNew: false };
        const index = content![section].findIndex(value => value.id === item.id);
        const heroPriority = reel ? heroReelIds.indexOf(item.id) : -1;
        return <article className="studio-content-card" key={item.id}>
          <button className={`studio-card-image${brand ? ' studio-brand-image' : ''}`} disabled={saving} onClick={() => setEditor(edit)} aria-label={`Edit ${name}`}>{brand && !item.logo ? <span className="studio-brand-wordmark">{name}</span> : <PreviewImage src={brand ? item.logo : item.image} alt={name} />}</button>
          <div className="studio-card-body"><div className="studio-card-details"><span className="studio-card-eyebrow">{reel ? [item.brand, item.category].filter(Boolean).join(' · ') : item.category || (brand ? 'Brand' : 'Creator')}</span><h3>{name}</h3>{subtitle && <p>{subtitle}</p>}{heroPriority >= 0 && <p>Home hero · Priority {heroPriority + 1} · {['Main', 'Left', 'Right'][heroPriority]}</p>}</div>
            <div className="studio-card-options">{'featured' in item && <button className={`studio-status-toggle${item.featured ? ' selected' : ''}`} aria-label={`${item.featured ? 'Unfeature' : 'Feature'} ${name} on home`} aria-pressed={item.featured} onClick={() => toggle(item.id, 'featured')} disabled={saving}><Star size={16} fill={item.featured ? 'currentColor' : 'none'} />{item.featured ? 'Featured' : 'Feature'}</button>}<button className="studio-status-toggle" aria-label={`${item.published ? 'Unpublish' : 'Publish'} ${name}`} aria-pressed={item.published} onClick={() => toggle(item.id, 'published')} disabled={saving}>{item.published ? <Eye size={16} /> : <EyeOff size={16} />}{item.published ? 'Published' : 'Draft'}</button></div>
            <div className="studio-card-footer"><button className="studio-edit-link" onClick={() => setEditor(edit)} disabled={saving}><Pencil size={16} />Edit {reel ? 'reel' : brand ? 'brand' : 'profile'}</button><div><button className="studio-icon" aria-label={reel ? `Increase ${name} priority` : `Move ${name} earlier`} title={reel ? 'Increase priority' : 'Move earlier'} disabled={saving || index === 0} onClick={() => move(item.id, -1)}><ArrowUp size={18} /></button><button className="studio-icon" aria-label={reel ? `Decrease ${name} priority` : `Move ${name} later`} title={reel ? 'Decrease priority' : 'Move later'} disabled={saving || index === content![section].length - 1} onClick={() => move(item.id, 1)}><ArrowDown size={18} /></button><button className="studio-icon studio-delete-icon" aria-label={`Delete ${name}`} title="Delete" disabled={saving} onClick={() => setDeleting({ id: item.id, name, section })}><Trash2 size={18} /></button></div></div>
          </div>
        </article>;
      })}</div> : <div className="studio-empty"><span>{section === 'reels' ? <Clapperboard size={31} /> : section === 'brands' ? <Building2 size={31} /> : <Users size={31} />}</span><h3>{content![section].length ? 'No matches this time.' : `Add your first ${itemName}.`}</h3><p>{content![section].length ? 'Try another search or filter to find what you need.' : section === 'brands' ? 'Add a logo and details to introduce a brand across your website.' : `Add your first ${itemName} and bring your showcase to life.`}</p>{content![section].length ? <button className="studio-secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</button> : <button className="studio-primary" onClick={add}><Plus size={17} />Add {itemName}</button>}</div>}
      <div className="studio-content-note"><ShieldCheck size={15} /><span>{section === 'brands' ? 'Published brands appear on home, the work page, and the home marquee in this order.' : 'Use the arrows to set reel priority. The first three published reels marked Featured on home appear in the hero: first in the center, second on the left, third on the right.'}</span></div>
    </div></main>{notification}
    {editor && <ContentEditor key={`${editor.kind}-${editor.value.id}`} editor={editor} creators={content!.creators} brands={content!.brands} saving={saving} onSave={saveEditor} onClose={closeEditor} onDraftChange={retainDraft} onSessionExpired={expireSession} saveError={notice?.type === 'error' ? notice.text : undefined} onErrorClear={() => setNotice(null)} />}
    {deleting && <Dialog title={`Delete ${deleting.section === 'reels' ? 'reel' : deleting.section === 'brands' ? 'brand' : 'creator'}`} onClose={() => setDeleting(null)} locked={saving}><div className="studio-confirm"><span className="studio-confirm-icon"><Trash2 size={25} /></span><h2>Remove this {deleting.section === 'reels' ? 'reel' : deleting.section === 'brands' ? 'brand' : 'creator'}?</h2><p><strong>{deleting.name}</strong> will be removed from the studio and your website.{deleting.section === 'creators' ? ' Their reels will remain with the creator name attached.' : deleting.section === 'brands' ? ' Linked reels will remain with the brand name attached.' : ''}</p><div><button className="studio-secondary" disabled={saving} onClick={() => setDeleting(null)}>Keep it</button><button className="studio-danger" disabled={saving} onClick={() => void remove()}>{saving ? <LoaderCircle size={16} className="studio-spin" /> : <Trash2 size={16} />}{saving ? 'Removing…' : 'Remove'}</button></div></div></Dialog>}
  </div>;
}
