// ============================================================
// AthleteOS — src/modules/Alerts.jsx
// Version nettoyée Phase 2 :
// - Utilise <LoadingState> et <ErrorState> (fini les blocs dupliqués)
// - Utilise <Modal> générique pour la création d'alerte
// - club_id vient de useAuth() — plus de hardcode =1
// Fonctionnalités identiques : filtres, marquage lu, suppression, création.
// ============================================================

import { memo, useState, useMemo, useEffect, useCallback } from "react";
import {
  Bell, Activity, AlertTriangle, Users,
  TrendingUp, CheckCheck, Filter, Plus, Trash2,
} from "lucide-react";
import { supabase }    from "../utils/supabaseClient";
import { useAuth }     from "../context/AuthContext";
import LoadingState    from "../components/ui/LoadingState";
import ErrorState      from "../components/ui/ErrorState";
import Modal           from "../components/ui/Modal";

// ─── Config UI statique ───────────────────────────────────────────────────────

const TYPE_CONFIG = {
  surcharge:   { label: "Surcharge",   icon: Activity,      color: "#E24B4A", bg: "#FEF2F2" },
  blessure:    { label: "Blessure",    icon: AlertTriangle, color: "#EF9F27", bg: "#FFFBEB" },
  absence:     { label: "Absence",     icon: Users,         color: "#378ADD", bg: "#EFF6FF" },
  performance: { label: "Performance", icon: TrendingUp,    color: "#1D9E75", bg: "#F0FDF4" },
};

const SEVERITY_CONFIG = {
  critique: { cls: "bg-red-100 text-red-700",     label: "Critique" },
  modérée:  { cls: "bg-amber-100 text-amber-700", label: "Modérée"  },
  légère:   { cls: "bg-slate-100 text-slate-500", label: "Légère"   },
  info:     { cls: "bg-blue-50 text-blue-700",    label: "Info"     },
};

const EMPTY_FORM = {
  type: "surcharge", athleteId: "", title: "", description: "", severity: "modérée",
};

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white";
const labelCls = "block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-BE", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ─── Contenu du formulaire de création (utilisé dans <Modal>) ────────────────
const AlertFormContent = memo(({ form, set, athletes, saveError }) => (
  <div className="space-y-4">
    {saveError && (
      <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-[12px] text-red-700">
        {saveError}
      </div>
    )}

    <div>
      <label className={labelCls}>Type d'alerte</label>
      <select className={inputCls} value={form.type} onChange={(e) => set("type", e.target.value)}>
        {Object.entries(TYPE_CONFIG).map(([key, c]) => (
          <option key={key} value={key}>{c.label}</option>
        ))}
      </select>
    </div>

    <div>
      <label className={labelCls}>Athlète concerné</label>
      <select className={inputCls} value={form.athleteId} onChange={(e) => set("athleteId", e.target.value)}>
        <option value="">Aucun athlète spécifique</option>
        {athletes.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
    </div>

    <div>
      <label className={labelCls}>Titre *</label>
      <input
        className={inputCls}
        placeholder="Ex: Douleur signalée à l'entraînement"
        value={form.title}
        onChange={(e) => set("title", e.target.value)}
      />
    </div>

    <div>
      <label className={labelCls}>Description</label>
      <textarea
        className={`${inputCls} resize-none`}
        rows={3}
        placeholder="Détails de la situation…"
        value={form.description}
        onChange={(e) => set("description", e.target.value)}
      />
    </div>

    <div>
      <label className={labelCls}>Gravité</label>
      <div className="flex gap-2">
        {Object.entries(SEVERITY_CONFIG).map(([key, c]) => (
          <button
            key={key}
            type="button"
            onClick={() => set("severity", key)}
            className={[
              "flex-1 px-2 py-1.5 rounded-lg text-[12px] font-semibold transition-all border",
              form.severity === key
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 text-slate-500 hover:border-slate-300",
            ].join(" ")}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  </div>
));

// ─── Composant principal ──────────────────────────────────────────────────────
function Alerts() {
  const { clubId } = useAuth(); // remplace club_id: 1

  const [alertList, setAlertList] = useState([]);
  const [athletes,  setAthletes]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const [filterType,    setFilterType]    = useState("tous");
  const [filterRead,    setFilterRead]    = useState("tous");
  const [filterAthlete, setFilterAthlete] = useState("tous");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // État du formulaire de création
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = useCallback((key, val) => setForm((f) => ({ ...f, [key]: val })), []);

  // ═══ Chargement ═══════════════════════════════════════════════════════════
  const fetchAll = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      setError(null);

      const [alertsRes, athletesRes] = await Promise.all([
        supabase.from("alerts").select("*").eq("club_id", clubId).order("created_at", { ascending: false }),
        supabase.from("athletes").select("id, name, profile_data").eq("club_id", clubId),
      ]);
      if (alertsRes.error)   throw alertsRes.error;
      if (athletesRes.error) throw athletesRes.error;

      setAlertList(alertsRes.data.map((a) => ({
        id:          a.id,
        type:        a.type,
        athleteId:   a.athlete_id,
        title:       a.title,
        description: a.description,
        severity:    a.severity,
        isRead:      a.is_read,
        date:        a.created_at,
      })));

      setAthletes(athletesRes.data.map((a) => ({
        id:     a.id,
        name:   a.name,
        avatar: a.profile_data?.avatar ?? initialsFromName(a.name),
      })));
    } catch (err) {
      console.error("Alerts — chargement :", err);
      setError(err.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ═══ Écritures ════════════════════════════════════════════════════════════

  const markRead = async (id) => {
    // Mise à jour optimiste
    setAlertList((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    const { error: err } = await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    if (err) {
      console.error("Alerts — markRead :", err);
      setAlertList((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: false } : a)));
    }
  };

  const markAllRead = async () => {
    const unreadIds = alertList.filter((a) => !a.isRead).map((a) => a.id);
    if (unreadIds.length === 0) return;
    setAlertList((prev) => prev.map((a) => ({ ...a, isRead: true })));
    const { error: err } = await supabase.from("alerts").update({ is_read: true }).in("id", unreadIds);
    if (err) { console.error("Alerts — markAllRead :", err); fetchAll(); }
  };

  const deleteAlert = async (id) => {
    const previous = alertList;
    setAlertList((prev) => prev.filter((a) => a.id !== id));
    const { error: err } = await supabase.from("alerts").delete().eq("id", id);
    if (err) { console.error("Alerts — delete :", err); setAlertList(previous); }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data, error: insertError } = await supabase
        .from("alerts")
        .insert({
          club_id:     clubId,
          athlete_id:  form.athleteId ? Number(form.athleteId) : null,
          type:        form.type,
          title:       form.title,
          description: form.description || null,
          severity:    form.severity,
          is_read:     false,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      setAlertList((prev) => [{
        id:          data.id,
        type:        data.type,
        athleteId:   data.athlete_id,
        title:       data.title,
        description: data.description,
        severity:    data.severity,
        isRead:      data.is_read,
        date:        data.created_at,
      }, ...prev]);

      setForm(EMPTY_FORM);
      setShowCreateModal(false);
    } catch (err) {
      setSaveError(err.message ?? "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  // ═══ Filtrage ═════════════════════════════════════════════════════════════
  const filtered = useMemo(() => alertList
    .filter((a) => filterType === "tous" || a.type === filterType)
    .filter((a) => {
      if (filterRead === "lues")     return  a.isRead;
      if (filterRead === "non_lues") return !a.isRead;
      return true;
    })
    .filter((a) => filterAthlete === "tous" || String(a.athleteId) === filterAthlete)
    .sort((a, b) => new Date(b.date) - new Date(a.date)),
  [alertList, filterType, filterRead, filterAthlete]);

  const unreadCount = alertList.filter((a) => !a.isRead).length;

  // ═══ Render ═══════════════════════════════════════════════════════════════
  if (loading) return <LoadingState message="Chargement des alertes…" />;
  if (error)   return <ErrorState  message={error} onRetry={fetchAll} />;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-slate-800 tracking-tight">Alertes</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} alerte${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`
              : "Tout est à jour"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 hover:text-emerald-700 border border-emerald-200 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <CheckCheck size={14} />
              Tout marquer comme lu
            </button>
          )}
          <button
            onClick={() => { setForm(EMPTY_FORM); setSaveError(null); setShowCreateModal(true); }}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm hover:shadow-md"
            style={{ background: "#1D9E75" }}
          >
            <Plus size={14} />
            Créer une alerte
          </button>
        </div>
      </div>

      {/* ── Filtres ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className="text-slate-400" />
          <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mr-2">Type</span>
          {["tous", "surcharge", "blessure", "absence", "performance"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={[
                "px-3 py-1 rounded-full text-[12px] font-medium transition-all",
                filterType === t ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
              ].join(" ")}
            >
              {t === "tous" ? "Tous" : TYPE_CONFIG[t]?.label ?? t}
            </button>
          ))}

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mr-2">Statut</span>
          {[{ id: "tous", label: "Tous" }, { id: "non_lues", label: "Non lues" }, { id: "lues", label: "Lues" }].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterRead(f.id)}
              className={[
                "px-3 py-1 rounded-full text-[12px] font-medium transition-all",
                filterRead === f.id ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>

        {athletes.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-50">
            <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mr-2">Athlète</span>
            <select
              value={filterAthlete}
              onChange={(e) => setFilterAthlete(e.target.value)}
              className="text-[12px] font-medium bg-slate-100 text-slate-600 rounded-full px-3 py-1 border-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="tous">Tous les athlètes</option>
              {athletes.map((a) => (
                <option key={a.id} value={String(a.id)}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Liste des alertes ────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 flex flex-col items-center gap-3 text-slate-400">
          <Bell size={32} strokeWidth={1.5} />
          <p className="text-[14px] font-medium">
            {alertList.length === 0 ? "Aucune alerte pour l'instant" : "Aucune alerte pour ce filtre"}
          </p>
          {alertList.length === 0 && (
            <p className="text-[12px] text-slate-300 text-center max-w-xs">
              Les alertes automatiques apparaîtront ici, ou crée-en une manuellement.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const typeConf = TYPE_CONFIG[alert.type] ?? { label: alert.type, icon: Bell, color: "#94a3b8", bg: "#f8fafc" };
            const Icon     = typeConf.icon;
            const sevConf  = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.légère;
            const athlete  = athletes.find((a) => a.id === alert.athleteId);

            return (
              <div
                key={alert.id}
                className={[
                  "bg-white rounded-xl border shadow-sm transition-all overflow-hidden group",
                  alert.isRead ? "border-slate-100" : "border-l-4",
                ].join(" ")}
                style={!alert.isRead ? { borderLeftColor: typeConf.color } : {}}
              >
                <div className="p-5 flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: typeConf.bg }}
                  >
                    <Icon size={18} color={typeConf.color} strokeWidth={2} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-[14px] font-semibold text-slate-800">{alert.title}</h4>
                        {!alert.isRead && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeConf.color }} />
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sevConf.cls}`}>
                          {sevConf.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {!alert.isRead && (
                          <button
                            onClick={() => markRead(alert.id)}
                            className="text-[11px] text-slate-400 hover:text-emerald-600 flex items-center gap-1 transition-colors"
                          >
                            <CheckCheck size={13} />
                            Marquer lu
                          </button>
                        )}
                        <button
                          onClick={() => deleteAlert(alert.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Supprimer l'alerte"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
                      {alert.description || "Aucune description."}
                    </p>

                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      {athlete && (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                            style={{ background: "#378ADD" }}
                          >
                            {athlete.avatar}
                          </div>
                          <span className="text-[11px] font-medium text-slate-600">{athlete.name}</span>
                        </div>
                      )}
                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] text-slate-400">{formatDate(alert.date)}</span>
                      <span className="text-slate-300">·</span>
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: typeConf.bg, color: typeConf.color }}
                      >
                        {typeConf.label}
                      </span>
                      {alert.isRead && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-[11px] text-slate-300 flex items-center gap-1">
                            <CheckCheck size={11} /> Lue
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal création ───────────────────────────────────────────────── */}
      {showCreateModal && (
        <Modal
          title="Créer une alerte"
          onClose={() => setShowCreateModal(false)}
          onConfirm={handleCreate}
          confirmLabel="Créer l'alerte"
          confirmDisabled={!form.title.trim() || saving}
          loading={saving}
          loadingLabel="Création…"
          disabled={saving}
        >
          <AlertFormContent
            form={form}
            set={set}
            athletes={athletes}
            saveError={saveError}
          />
        </Modal>
      )}
    </div>
  );
}

export default memo(Alerts);