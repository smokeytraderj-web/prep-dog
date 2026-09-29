import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

export function SourceSnippets({images, onChange}) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function addFiles(files) {
    const selected = Array.from(files);
    if (!selected.length) return;
    setError(''); setBusy(true);
    try {
      if (selected.some(file => !['image/png','image/jpeg','image/webp'].includes(file.type))) throw Error('Choose PNG, JPG, or WEBP images.');
      if (selected.some(file => file.size > 8 * 1024 * 1024)) throw Error('Each image must be smaller than 8 MB.');
      const added = await Promise.all(selected.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(Error(`Could not read ${file.name}.`));
        reader.onload = () => {
          const image = new Image();
          image.onerror = () => reject(Error(`Could not open ${file.name}. Please choose a valid image.`));
          image.onload = () => resolve({id:crypto.randomUUID(), name:file.name, title:file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), caption:'', dataUrl:reader.result});
          image.src = reader.result;
        };
        reader.readAsDataURL(file);
      })));
      onChange(current => [...current, ...added]);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="source-snippets">
    <button type="button" className={`snippet-dropzone ${dragging ? 'dragging' : ''}`} disabled={busy}
      onClick={() => input.current.click()}
      onDragOver={e => {e.preventDefault(); setDragging(true);}}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {e.preventDefault(); setDragging(false); if (!busy) addFiles(e.dataTransfer.files);}}>
      <Upload size={28} strokeWidth={1.4}/><strong>{busy ? 'Preparing images…' : 'Drop source images here'}</strong>
      <span>or click to browse · PNG, JPG, WEBP</span><small>One image, one dedicated slide</small>
    </button>
    <input ref={input} type="file" className="hidden" multiple accept="image/png,image/jpeg,image/webp" onChange={e => {addFiles(e.target.files); e.target.value='';}}/>
    {error && <p className="errors" role="alert">{error}</p>}
    {images.length > 0 && <div className="snippet-list">{images.map((image, i) => <div className="snippet-card" key={image.id}>
      <img src={image.dataUrl} alt={image.name}/><div><label className="field-label">Slide {i + 1} title<input maxLength={80} value={image.title} onChange={e => onChange(current => current.map(item => item.id === image.id ? {...item, title:e.target.value} : item))}/></label>
      <label className="field-label">Context or takeaway (optional)<textarea maxLength={260} rows={2} value={image.caption} onChange={e => onChange(current => current.map(item => item.id === image.id ? {...item, caption:e.target.value} : item))}/></label></div>
      <button type="button" className="text-button" aria-label={`Remove ${image.name}`} onClick={() => onChange(current => current.filter(item => item.id !== image.id))}><X size={17}/></button>
    </div>)}</div>}
  </div>;
}

export function SourceSnippetSlide({data}) {
  return <div className="source-snippet-slide"><div className="report-heading"><div><span className="slide-kicker">PORTFOLIO PERSPECTIVE</span><h2>{data.title || 'Portfolio perspective'}</h2></div></div>
    <figure className="snippet-figure"><div className="snippet-frame"><img src={data.dataUrl} alt={data.title || data.name}/></div>{data.caption && <figcaption>{data.caption}</figcaption>}</figure>
    <p className="context-source">Source: {data.name}</p>
  </div>;
}
