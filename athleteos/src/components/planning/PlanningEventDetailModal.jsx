import { CalendarDays, Clock, FileText, MapPin, X } from "lucide-react";
import { useAccessibleDialog } from "../../hooks/useAccessibleDialog";
import { openSessionAttachment } from "../../utils/storage";

const LABELS = { stage:"Stage", test:"Test", rest:"Repos", custom:"Événement" };

export default function PlanningEventDetailModal({ event, onClose }) {
  const { dialogRef, titleId } = useAccessibleDialog({ onClose });
  const label = event.kind === "custom" ? event.customLabel || LABELS.custom : LABELS[event.kind] || LABELS.custom;

  return <div className="modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={click => click.target === click.currentTarget && onClose()}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="modal-content w-full sm:max-w-lg max-h-[94dvh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col">
      <header className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:"1px solid var(--c-border)" }}>
        <div><p className="metric-label">{label.toLocaleUpperCase("fr")}</p><h2 id={titleId} className="section-title">{event.name}</h2></div>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
      </header>
      <div className="p-5 space-y-4 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          <span className="chip chip-neutral"><CalendarDays size={13} />{event.startsOn === event.endsOn ? event.startsOn : `${event.startsOn} → ${event.endsOn}`}</span>
          {event.time && <span className="chip chip-neutral"><Clock size={13} />{event.time}</span>}
          {event.location && <span className="chip chip-neutral"><MapPin size={13} />{event.location}</span>}
        </div>
        {event.description && <p className="secondary-text leading-relaxed">{event.description}</p>}
        {event.documents?.length > 0 && <section className="space-y-2">
          <p className="card-title">Documents</p>
          {event.documents.map(document => <button key={document.id} type="button" onClick={() => openSessionAttachment(document.storagePath)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left" style={{ background:"rgba(91,158,245,0.10)", border:"1px solid rgba(91,158,245,0.25)", color:"var(--tone-info)" }}>
            <FileText size={17} /><span className="font-semibold truncate">{document.name}</span>
          </button>)}
        </section>}
      </div>
    </section>
  </div>;
}
