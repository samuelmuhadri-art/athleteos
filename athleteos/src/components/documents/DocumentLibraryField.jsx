import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Library, RefreshCw, Search, UploadCloud, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { SESSION_ATTACHMENT_ACCEPT } from "../../utils/storage";
import { listClubDocuments, runDocumentUploadQueue, uploadLibraryDocument } from "../../services/documentLibrary";

function fileSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function DocumentLibraryField({
  value = [], onChange, athletes = [], allowSpecificRecipients = true,
  disabled = false, onBusyChange = () => {},
}) {
  const { clubId } = useAuth();
  const [library, setLibrary] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Entraînement");
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const refresh = useCallback(async () => {
    try { setLibrary(await listClubDocuments(clubId)); }
    catch (err) { setError(err.message ?? "Impossible de charger la bibliothèque."); }
  }, [clubId]);
  useEffect(() => { refresh(); }, [refresh]);

  const selectedIds = useMemo(() => new Set(value.map(document => Number(document.id))), [value]);
  const busy = queue.some(entry => entry.status === "waiting" || entry.status === "uploading");
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  const visible = useMemo(() => library.filter(document => {
    const needle = search.trim().toLocaleLowerCase("fr");
    return !needle || document.name.toLocaleLowerCase("fr").includes(needle)
      || document.category?.toLocaleLowerCase("fr").includes(needle);
  }), [library, search]);

  const toggle = document => onChange(selectedIds.has(Number(document.id))
    ? value.filter(item => Number(item.id) !== Number(document.id))
    : [...value, { ...document, visibility:"all", athleteIds:[] }]);

  const updateRecipients = (documentId, visibility, athleteIds = []) => onChange(value.map(document => (
    Number(document.id) === Number(documentId)
      ? { ...document, visibility, athleteIds:visibility === "selected" ? athleteIds : [] }
      : document
  )));

  const toggleRecipient = (document, athleteId) => {
    const current = new Set(document.athleteIds ?? []);
    current.has(athleteId) ? current.delete(athleteId) : current.add(athleteId);
    updateRecipients(document.id, "selected", [...current]);
  };

  const uploadFiles = useCallback(async filesInput => {
    const files = [...filesInput];
    if (!files.length || disabled) return;
    setError(null);
    const results = await runDocumentUploadQueue(files, {
      concurrency:4,
      onProgress:setQueue,
      upload:file => uploadLibraryDocument({ clubId, file, category }),
    });
    const created = results.filter(entry => entry.status === "done").map(entry => entry.result);
    if (created.length) {
      setLibrary(current => [...created, ...current.filter(item => !created.some(newItem => newItem.id === item.id))]);
      onChange([...value, ...created.filter(item => !selectedIds.has(Number(item.id)))]);
    }
    if (results.some(entry => entry.status === "error")) setError("Certains fichiers n’ont pas été envoyés. Tu peux relancer uniquement les échecs.");
  }, [category, clubId, disabled, onChange, selectedIds, value]);

  const retryErrors = () => uploadFiles(queue.filter(entry => entry.status === "error").map(entry => entry.file));

  return (
    <section className="space-y-3" aria-label="Documents de la séance">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="card-title">Documents</p>
          <p className="card-subtitle">Ajoute plusieurs fichiers ou réutilise la bibliothèque du club.</p>
        </div>
        <span className="chip chip-neutral">{value.length} sélectionné{value.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-2">
        <label className="input-premium flex items-center gap-2">
          <Search size={15} aria-hidden="true" />
          <input className="min-w-0 flex-1 bg-transparent outline-none" value={search}
            onChange={event => setSearch(event.target.value)} placeholder="Rechercher dans la bibliothèque" />
        </label>
        <select className="input-premium" value={category} onChange={event => setCategory(event.target.value)} aria-label="Catégorie du document">
          <option>Entraînement</option><option>Technique</option><option>Compétition</option><option>Stage</option><option>Administratif</option>
        </select>
      </div>

      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}
        onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); uploadFiles(event.dataTransfer.files); }}
        className="w-full min-h-24 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-1.5 px-4 text-center"
        style={{ borderColor:"var(--c-border-strong)", background:"var(--c-surface-2)", color:"var(--c-text-2)" }}>
        <UploadCloud size={22} color="var(--tone-success)" />
        <span className="text-[13px] font-semibold">Dépose tes fichiers ici ou sélectionne-les</span>
        <span className="meta-text">Images, PDF, Word, Excel, PowerPoint, OpenDocument, texte · 30 Mo max</span>
      </button>
      <input ref={inputRef} hidden multiple type="file" accept={SESSION_ATTACHMENT_ACCEPT}
        onChange={event => { uploadFiles(event.target.files); event.target.value = ""; }} />

      {queue.length > 0 && <div className="space-y-1.5">
        {queue.map(entry => <div key={`${entry.file.name}-${entry.index}`} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background:"var(--c-surface-2)" }}>
          {entry.status === "done" ? <Check size={14} color="var(--tone-success)" /> : entry.status === "error" ? <X size={14} color="var(--tone-danger)" /> : <RefreshCw size={14} className={entry.status === "uploading" ? "animate-spin" : ""} />}
          <span className="secondary-text flex-1 truncate">{entry.file.name}</span>
          <span className="meta-text">{entry.status === "uploading" ? "Envoi…" : entry.status === "done" ? "Prêt" : entry.status === "error" ? "Échec" : "En attente"}</span>
        </div>)}
        {queue.some(entry => entry.status === "error") && <button type="button" className="btn-secondary" onClick={retryErrors}><RefreshCw size={14} /> Relancer les échecs</button>}
      </div>}
      {error && <p role="alert" className="text-[12px]" style={{ color:"var(--tone-danger)" }}>{error}</p>}

      <div className="max-h-52 overflow-y-auto rounded-2xl" style={{ border:"1px solid var(--c-border)" }}>
        <div className="px-3 py-2 flex items-center gap-2 sticky top-0" style={{ background:"var(--c-surface-2)", borderBottom:"1px solid var(--c-border)" }}>
          <Library size={14} /><span className="metric-label">BIBLIOTHÈQUE DU CLUB</span>
        </div>
        {visible.length === 0 ? <p className="secondary-text p-4 text-center">Aucun document correspondant.</p> : visible.map(document => {
          const selected = selectedIds.has(Number(document.id));
          return <button key={document.id} type="button" disabled={disabled} onClick={() => toggle(document)}
            className="w-full min-h-12 flex items-center gap-3 px-3 py-2 text-left" style={{ borderBottom:"1px solid var(--c-border)", background:selected ? "var(--c-accent-light)" : "transparent" }}>
            <FileText size={16} color={selected ? "var(--tone-success)" : "var(--c-text-3)"} />
            <span className="flex-1 min-w-0"><span className="secondary-text block truncate">{document.name}</span><span className="meta-text">{document.category || "Sans catégorie"} · {fileSize(document.sizeBytes)}</span></span>
            {selected && <Check size={16} color="var(--tone-success)" />}
          </button>;
        })}
      </div>

      {allowSpecificRecipients && value.length > 0 && athletes.length > 1 && <div className="space-y-2">
        <p className="metric-label">VISIBILITÉ PAR DOCUMENT</p>
        {value.map(document => {
          const specific = document.visibility === "selected";
          return <div key={document.id} className="rounded-2xl p-3 space-y-2" style={{ background:"var(--c-surface-2)", border:"1px solid var(--c-border)" }}>
            <div className="flex items-center gap-2">
              <FileText size={15} color="var(--tone-success)" />
              <span className="secondary-text flex-1 min-w-0 truncate">{document.name}</span>
              <select className="input-premium !w-auto" aria-label={`Visibilité de ${document.name}`}
                value={specific ? "selected" : "all"}
                onChange={event => updateRecipients(document.id, event.target.value, event.target.value === "selected" ? (document.athleteIds ?? []) : [])}>
                <option value="all">Tous les assignés</option>
                <option value="selected">Athlètes précis</option>
              </select>
            </div>
            {specific && <div className="flex flex-wrap gap-2" aria-label={`Destinataires de ${document.name}`}>
              {athletes.map(athlete => {
                const selected = (document.athleteIds ?? []).includes(athlete.id);
                return <button key={athlete.id} type="button" aria-pressed={selected} disabled={disabled}
                  className={selected ? "chip chip-success" : "chip chip-neutral"}
                  onClick={() => toggleRecipient(document, athlete.id)}>{athlete.name}</button>;
              })}
              {(document.athleteIds ?? []).length === 0 && <span role="alert" className="meta-text" style={{ color:"var(--tone-danger)" }}>Choisis au moins un destinataire.</span>}
            </div>}
          </div>;
        })}
      </div>}
    </section>
  );
}
