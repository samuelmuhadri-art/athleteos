import { useCallback, useEffect, useMemo, useState } from "react";
import { BookmarkPlus, Check, Copy, Pencil, Search, Trash2, X } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import { CATEGORIES } from "../../modules/planningUtils";
import { canManageSessionTemplate, filterSessionTemplates, mapSessionTemplate, nextTemplateCopyName, templatePayload } from "../../domain/sessionTemplateLibrary";
import { mapDocument } from "../../services/documentLibrary";

const EMPTY_FILTERS = { search:"", category:"all", scope:"all" };

function valuesFromTemplate(template) {
  return {
    name:template.name ?? "",
    title:template.title ?? "",
    category:template.category ?? "sprint",
    type:template.type ?? "Sprint",
    trainingFocus:template.training_focus ?? "",
    durationMinutes:template.duration_minutes ?? 60,
    description:template.description ?? "",
    instructions:template.instructions ?? "",
    scope:template.scope ?? "personal",
    tags:(template.tags ?? []).join(", "),
  };
}

export default function SessionTemplateLibrary({ draft, documents, currentUserId, isHeadCoach = false, onApply }) {
  const [templates, setTemplates] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editor, setEditor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error:loadError } = await supabase
      .from("session_templates")
      .select("*, session_template_documents(documents(*))")
      .order("updated_at", { ascending:false });
    if (loadError) setError(loadError.message);
    else {
      setTemplates((data ?? []).map(mapSessionTemplate));
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleTemplates = useMemo(() => filterSessionTemplates(templates, filters), [filters, templates]);
  const openDraftEditor = () => setEditor({ id:null, documentIds:documents.map(document => document.id), values:{ ...valuesFromTemplate({
    name:draft.title || "Nouveau modèle",
    title:draft.title,
    category:draft.category,
    type:draft.type,
    training_focus:draft.trainingFocus,
    duration_minutes:draft.durationMinutes,
    description:draft.description,
    instructions:draft.instructions,
    scope:"personal",
    tags:[],
  }) } });
  const openEdit = template => setEditor({
    id:template.id,
    documentIds:template.documents.map(document => document.id),
    scopeLocked:template.created_by !== currentUserId,
    values:valuesFromTemplate(template),
  });
  const setEditorValue = (key, value) => setEditor(current => ({ ...current, values:{ ...current.values, [key]:value } }));

  const save = async () => {
    const payload = templatePayload(editor.values);
    if (!payload.name || !payload.title || payload.durationMinutes < 1) {
      setError("Renseigne au minimum le nom, le titre et une durée valide.");
      return;
    }
    setBusy(true); setError(null);
    const { error:saveError } = await supabase.rpc("upsert_session_template", {
      p_template_id:editor.id,
      p_template:payload,
      p_document_ids:editor.documentIds,
    });
    if (saveError) setError(saveError.message);
    else { setEditor(null); await load(); }
    setBusy(false);
  };

  const duplicate = async template => {
    setBusy(true); setError(null);
    const { error:duplicateError } = await supabase.rpc("duplicate_session_template", {
      p_template_id:template.id,
      p_name:nextTemplateCopyName(template, templates),
      p_scope:"personal",
    });
    if (duplicateError) setError(duplicateError.message);
    else await load();
    setBusy(false);
  };

  const remove = async template => {
    if (!window.confirm(`Supprimer le modèle « ${template.name} » ?`)) return;
    setBusy(true); setError(null);
    const { error:deleteError } = await supabase.rpc("delete_session_template", { p_template_id:template.id });
    if (deleteError) setError(deleteError.message);
    else await load();
    setBusy(false);
  };

  const apply = template => onApply({
    ...template,
    documents:template.documents.map(mapDocument).filter(Boolean),
  });

  return <details className="rounded-2xl p-3" style={{ border:"1px solid var(--c-border)", background:"var(--c-surface-2)" }}>
    <summary className="min-h-11 flex items-center cursor-pointer text-[13px] font-semibold">
      Modèles de séances{templates.length ? ` · ${templates.length}` : ""}
    </summary>
    <div className="space-y-3 pt-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="input-premium flex items-center gap-2 flex-1">
          <Search size={14} aria-hidden="true" />
          <span className="sr-only">Rechercher un modèle</span>
          <input className="w-full bg-transparent outline-none" value={filters.search} onChange={event => setFilters(current => ({ ...current, search:event.target.value }))} placeholder="Rechercher nom, contenu ou tag" />
        </label>
        <button type="button" className="btn-secondary whitespace-nowrap" onClick={openDraftEditor} disabled={busy || !draft.title?.trim()}>
          <BookmarkPlus size={14} /> Enregistrer ce brouillon
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Filtrer les modèles par catégorie" className="input-premium" value={filters.category} onChange={event => setFilters(current => ({ ...current, category:event.target.value }))}>
          <option value="all">Toutes les catégories</option>
          {CATEGORIES.map(category => <option value={category.id} key={category.id}>{category.label}</option>)}
        </select>
        <select aria-label="Filtrer les modèles par portée" className="input-premium" value={filters.scope} onChange={event => setFilters(current => ({ ...current, scope:event.target.value }))}>
          <option value="all">Toutes les portées</option><option value="personal">Mes modèles</option><option value="club">Modèles du club</option>
        </select>
      </div>

      {editor && <div className="rounded-xl p-3 space-y-3" style={{ border:"1px solid var(--c-border-strong)", background:"var(--c-surface)" }}>
        <div className="flex items-center justify-between"><strong className="text-[13px]">{editor.id ? "Modifier le modèle" : "Créer un modèle"}</strong><button type="button" className="btn-icon" aria-label="Fermer l’éditeur de modèle" onClick={() => setEditor(null)}><X size={14} /></button></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-[12px]">Nom du modèle<input aria-label="Nom du modèle" className="input-premium mt-1" maxLength={120} value={editor.values.name} onChange={event => setEditorValue("name", event.target.value)} /></label>
          <label className="text-[12px]">Portée<select aria-label="Portée du modèle" className="input-premium mt-1" disabled={editor.scopeLocked} value={editor.values.scope} onChange={event => setEditorValue("scope", event.target.value)}><option value="personal">Personnel</option><option value="club">Club partagé</option></select></label>
          <label className="text-[12px] sm:col-span-2">Titre de séance<input aria-label="Titre du modèle" className="input-premium mt-1" maxLength={160} value={editor.values.title} onChange={event => setEditorValue("title", event.target.value)} /></label>
          <label className="text-[12px]">Catégorie<select aria-label="Catégorie du modèle" className="input-premium mt-1" value={editor.values.category} onChange={event => setEditorValue("category", event.target.value)}>{CATEGORIES.map(category => <option value={category.id} key={category.id}>{category.label}</option>)}</select></label>
          <label className="text-[12px]">Durée (min)<input aria-label="Durée du modèle" type="number" min="1" max="1440" className="input-premium mt-1" value={editor.values.durationMinutes} onChange={event => setEditorValue("durationMinutes", event.target.value)} /></label>
          <label className="text-[12px] sm:col-span-2">Tags, séparés par des virgules<input aria-label="Tags du modèle" className="input-premium mt-1" value={editor.values.tags} onChange={event => setEditorValue("tags", event.target.value)} placeholder="vitesse, technique, compétition" /></label>
          <label className="text-[12px] sm:col-span-2">Contenu<textarea aria-label="Contenu du modèle" className="input-premium mt-1 resize-none" rows={2} value={editor.values.description} onChange={event => setEditorValue("description", event.target.value)} /></label>
          <label className="text-[12px] sm:col-span-2">Consignes<textarea aria-label="Consignes du modèle" className="input-premium mt-1 resize-none" rows={2} value={editor.values.instructions} onChange={event => setEditorValue("instructions", event.target.value)} /></label>
        </div>
        <div className="flex justify-end"><button type="button" className="btn-primary" onClick={save} disabled={busy}><Check size={14} /> {busy ? "Enregistrement…" : "Enregistrer le modèle"}</button></div>
      </div>}

      {error && <p role="alert" className="text-[12px]" style={{ color:"var(--tone-danger)" }}>{error}</p>}
      {loading ? <p className="meta-text">Chargement des modèles…</p> : visibleTemplates.length === 0 ? <p className="meta-text">Aucun modèle ne correspond à ces filtres.</p> : <div className="space-y-2 max-h-64 overflow-y-auto">
        {visibleTemplates.map(template => {
          const manageable = canManageSessionTemplate(template, currentUserId, isHeadCoach);
          return <article key={template.id} className="rounded-xl p-3" style={{ background:"var(--c-surface)", border:"1px solid var(--c-border)" }}>
            <div className="flex items-start justify-between gap-3">
              <button type="button" className="min-w-0 text-left flex-1" onClick={() => apply(template)}>
                <span className="block text-[13px] font-bold truncate">{template.name}</span>
                <span className="block text-[12px] truncate" style={{ color:"var(--c-text-2)" }}>{template.title} · {template.duration_minutes} min · {template.scope === "club" ? "Club" : "Personnel"}</span>
                {template.tags.length > 0 && <span className="block text-[11px] mt-1" style={{ color:"var(--c-text-3)" }}>{template.tags.join(" · ")}</span>}
              </button>
              <div className="flex items-center gap-1">
                <button type="button" className="btn-icon" aria-label={`Dupliquer ${template.name}`} title="Dupliquer dans mes modèles" disabled={busy} onClick={() => duplicate(template)}><Copy size={14} /></button>
                {manageable && <button type="button" className="btn-icon" aria-label={`Modifier ${template.name}`} disabled={busy} onClick={() => openEdit(template)}><Pencil size={14} /></button>}
                {manageable && <button type="button" className="btn-icon" aria-label={`Supprimer ${template.name}`} disabled={busy} onClick={() => remove(template)}><Trash2 size={14} /></button>}
              </div>
            </div>
          </article>;
        })}
      </div>}
    </div>
  </details>;
}
