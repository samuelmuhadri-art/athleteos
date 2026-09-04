import { CalendarDays, Edit3, MapPin, Trash2, Trophy, Users, X } from "lucide-react";
import { useAccessibleDialog } from "../../hooks/useAccessibleDialog";
import { formatCivilDate } from "../../utils/dateTime";
import { getTypeConfig } from "../../modules/competitionsShared";

export default function CompetitionDetailModal({ competition, athletes = [], athleteId = null, onClose, onEdit, onDelete }) {
  const { dialogRef, titleId } = useAccessibleDialog({ onClose, enabled:Boolean(competition) });
  if (!competition) return null;
  const config = getTypeConfig(competition.type);
  const participants = athletes.filter(athlete => competition.athleteIds?.includes(athlete.id));
  const athleteEvent = athleteId != null ? competition.plannedEvents?.[athleteId] : null;
  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={event => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="modal-content w-full sm:max-w-lg max-h-[92dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl flex flex-col" style={{ background:"var(--c-surface)" }}>
        <header className="px-5 py-4 flex items-start justify-between gap-4" style={{ background:config.bg, borderBottom:`1px solid ${config.border}55` }}>
          <div className="min-w-0">
            <span className="chip chip-neutral"><Trophy size={12} /> {config.label}</span>
            <h2 id={titleId} className="section-title mt-2">{competition.name}</h2>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="btn-icon"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="card p-4 space-y-3">
            <p className="flex items-center gap-2 text-[13px]" style={{ color:"var(--c-text-2)" }}><CalendarDays size={15} color={config.border} />{formatCivilDate(competition.date, { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</p>
            <p className="flex items-center gap-2 text-[13px]" style={{ color:"var(--c-text-2)" }}><MapPin size={15} color={config.border} />{competition.location || "Lieu non renseigné"}</p>
            <p className="flex items-center gap-2 text-[13px]" style={{ color:"var(--c-text-2)" }}><Users size={15} color={config.border} />{participants.length} athlète{participants.length !== 1 ? "s" : ""}</p>
          </div>
          {athleteEvent && <div className="card p-4"><p className="metric-label">ÉPREUVE PRÉVUE</p><p className="card-title mt-1">{athleteEvent}</p></div>}
          {competition.notes && <div className="card p-4"><p className="metric-label">NOTES</p><p className="secondary-text mt-2 whitespace-pre-wrap">{competition.notes}</p></div>}
          {athleteId == null && participants.length > 0 && <div><p className="metric-label mb-2">PARTICIPANTS</p><div className="flex flex-wrap gap-2">{participants.map(athlete => <span key={athlete.id} className="chip chip-neutral">{athlete.name}</span>)}</div></div>}
        </div>
        {(onEdit || onDelete) && <footer className="px-5 py-4 flex items-center justify-between gap-3" style={{ borderTop:"1px solid var(--c-border)" }}>
          {onDelete ? <button type="button" className="btn-ghost" style={{ color:"var(--tone-danger)" }} onClick={() => onDelete(competition)}><Trash2 size={15} /> Supprimer</button> : <span />}
          {onEdit && <button type="button" className="btn-primary" onClick={() => onEdit(competition)}><Edit3 size={15} /> Modifier</button>}
        </footer>}
      </section>
    </div>
  );
}
