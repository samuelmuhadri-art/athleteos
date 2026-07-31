import { memo, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import {
  ATHLETE_CSV_LIMITS,
  getAthleteCsvTemplate,
  parseAthleteCsv,
  validateAthleteCsvFile,
} from "../utils/athleteCsv";

const PREVIEW_LIMIT = 8;
const ERROR_PREVIEW_LIMIT = 8;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} octets`;
  return `${Math.ceil(bytes / 1024)} Ko`;
}

function ImportAthletesCsvModal({ onClose, onImport, existingEmails = [] }) {
  const titleId = useId();
  const descriptionId = useId();
  const fileInputId = useId();
  const dialogRef = useRef(null);
  const fileInputRef = useRef(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [fileError, setFileError] = useState("");
  const [importError, setImportError] = useState("");
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const readSequence = useRef(0);
  const busy = reading || importing;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  const resetSelection = () => {
    readSequence.current += 1;
    setFileInfo(null);
    setResult(null);
    setFileError("");
    setImportError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const readFile = async (file) => {
    const sequence = readSequence.current + 1;
    readSequence.current = sequence;
    setFileInfo(file ? { name: file.name, size: file.size } : null);
    setResult(null);
    setFileError("");
    setImportError("");

    const validationError = validateAthleteCsvFile(file);
    if (validationError) {
      setFileError(validationError.message);
      return;
    }

    setReading(true);
    try {
      const text = await file.text();
      if (readSequence.current !== sequence) return;
      const parsed = parseAthleteCsv(text, { existingEmails });
      setResult(parsed);
      if (parsed.fatalErrors.length) setFileError(parsed.fatalErrors[0].message);
    } catch {
      if (readSequence.current === sequence) {
        setFileError("Impossible de lire ce fichier. Réenregistre-le au format CSV UTF-8 puis réessaie.");
      }
    } finally {
      if (readSequence.current === sequence) setReading(false);
    }
  };

  const handleFileChange = (event) => {
    const [file] = event.target.files ?? [];
    void readFile(file);
  };

  const handleImport = async () => {
    if (!result?.canImport || importing) return;
    setImporting(true);
    setImportError("");
    try {
      await onImport(result.athletes, {
        fileName: fileInfo?.name ?? "",
        meta: result.meta,
        skippedRows: result.errors,
        sourceRows: result.entries.map(({ row }) => row),
      });
      onClose();
    } catch (error) {
      setImportError(error?.message || "L'import n'a pas pu être terminé. Aucun nouvel essai n'a été lancé automatiquement.");
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF", getAthleteCsvTemplate()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modele-athletes-athleteos.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const validCount = result?.meta.validRows ?? 0;
  const invalidCount = result?.meta.invalidRows ?? 0;
  const previewEntries = result?.entries.slice(0, PREVIEW_LIMIT) ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden outline-none modal-content"
        style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0" aria-hidden="true">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--c-border-strong)" }} />
        </div>

        <header
          className="px-5 sm:px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--c-border)" }}
        >
          <div className="flex gap-3 min-w-0">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--c-accent-light)", color: "var(--c-accent)" }}
              aria-hidden="true"
            >
              <FileSpreadsheet size={20} />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-[17px] font-bold" style={{ color: "var(--c-text-1)" }}>
                Importer des athlètes
              </h2>
              <p id={descriptionId} className="text-[13px] mt-1" style={{ color: "var(--c-text-2)" }}>
                Ajoute plusieurs profils depuis un fichier CSV UTF-8, sans écraser les athlètes existants.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer l'import CSV"
            onClick={onClose}
            disabled={busy}
            className="p-2 rounded-xl transition-colors disabled:opacity-40 hover:bg-[var(--c-surface-2)]"
            style={{ color: "var(--c-text-2)" }}
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          <section
            className="rounded-2xl p-4 sm:p-5"
            style={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}
            aria-labelledby={`${titleId}-format`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 id={`${titleId}-format`} className="text-[14px] font-bold" style={{ color: "var(--c-text-1)" }}>
                  Prépare ton fichier
                </h3>
                <p className="text-[13px] mt-1 leading-relaxed" style={{ color: "var(--c-text-2)" }}>
                  CSV uniquement — les fichiers Excel .xlsx ne sont pas acceptés. Nom complet obligatoire ; email, âge, discipline, groupe et niveau facultatifs.
                </p>
                <p className="text-[12px] mt-1" style={{ color: "var(--c-text-3)" }}>
                  Maximum {ATHLETE_CSV_LIMITS.maxDataRows} athlètes et {ATHLETE_CSV_LIMITS.maxFileBytes / 1024 / 1024} Mo par import.
                </p>
              </div>
              <button type="button" onClick={downloadTemplate} className="btn-secondary flex-shrink-0">
                <Download size={15} aria-hidden="true" />
                Télécharger le modèle
              </button>
            </div>
          </section>

          <section aria-labelledby={`${titleId}-file`}>
            <h3 id={`${titleId}-file`} className="text-[14px] font-bold mb-2" style={{ color: "var(--c-text-1)" }}>
              Fichier à analyser
            </h3>
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Fichier CSV à importer"
              tabIndex={-1}
              onChange={handleFileChange}
              disabled={busy}
            />
            <div
              className="rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
              style={{ border: "1px dashed var(--c-border-strong)", background: "var(--c-surface)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--c-surface-3)", color: "var(--c-text-2)" }}
                  aria-hidden="true"
                >
                  <Upload size={19} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: "var(--c-text-1)" }}>
                    {fileInfo?.name ?? "Aucun fichier sélectionné"}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--c-text-3)" }}>
                    {reading ? "Analyse en cours…" : fileInfo ? formatFileSize(fileInfo.size) : "Format attendu : .csv encodé en UTF-8"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {fileInfo && (
                  <button type="button" onClick={resetSelection} disabled={busy} className="btn-ghost">
                    Retirer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="btn-secondary"
                >
                  Choisir un fichier CSV
                </button>
              </div>
            </div>
          </section>

          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {reading
              ? "Analyse du fichier CSV en cours."
              : result
                ? `${validCount} athlètes prêts à importer, ${invalidCount} lignes ignorées.`
                : fileError}
          </div>

          {fileError && (
            <div
              role="alert"
              className="rounded-2xl px-4 py-3 flex items-start gap-3 text-[13px]"
              style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.25)", color: "var(--tone-danger)" }}
            >
              <AlertCircle size={17} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>{fileError}</span>
            </div>
          )}

          {result && !result.fatalErrors.length && (
            <>
              <section aria-labelledby={`${titleId}-summary`} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 id={`${titleId}-summary`} className="text-[14px] font-bold" style={{ color: "var(--c-text-1)" }}>
                      Aperçu avant import
                    </h3>
                    <p className="text-[13px] mt-0.5" style={{ color: "var(--c-text-2)" }}>
                      Vérifie les profils : rien n'est encore enregistré.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold"
                      style={{ background: "rgba(61,190,139,0.13)", color: "var(--tone-success)" }}
                    >
                      <CheckCircle2 size={14} aria-hidden="true" /> {validCount} prêt{validCount > 1 ? "s" : ""}
                    </span>
                    {invalidCount > 0 && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold"
                        style={{ background: "rgba(239,159,39,0.13)", color: "var(--tone-warning)" }}
                      >
                        <AlertCircle size={14} aria-hidden="true" /> {invalidCount} ignorée{invalidCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {result.warnings.map((warning) => (
                  <p key={warning.code} className="text-[12px]" style={{ color: "var(--c-text-3)" }}>
                    {warning.message}
                  </p>
                ))}

                {previewEntries.length > 0 ? (
                  <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid var(--c-border)" }}>
                    <table className="w-full min-w-[620px] text-left">
                      <caption className="sr-only">Premiers athlètes valides détectés dans le fichier CSV</caption>
                      <thead style={{ background: "var(--c-surface-2)" }}>
                        <tr>
                          {["Ligne", "Athlète", "Email", "Âge", "Discipline", "Groupe"].map((label) => (
                            <th key={label} scope="col" className="px-3 py-2.5 text-[12px] font-bold" style={{ color: "var(--c-text-2)" }}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewEntries.map(({ row, athlete }) => (
                          <tr key={`${row}-${athlete.email || athlete.name}`} style={{ borderTop: "1px solid var(--c-border)" }}>
                            <td className="px-3 py-3 text-[12px]" style={{ color: "var(--c-text-3)" }}>{row}</td>
                            <td className="px-3 py-3 text-[13px] font-semibold" style={{ color: "var(--c-text-1)" }}>{athlete.name}</td>
                            <td className="px-3 py-3 text-[12px]" style={{ color: "var(--c-text-2)" }}>{athlete.email || "—"}</td>
                            <td className="px-3 py-3 text-[12px]" style={{ color: "var(--c-text-2)" }}>{athlete.age || "—"}</td>
                            <td className="px-3 py-3 text-[12px]" style={{ color: "var(--c-text-2)" }}>{athlete.mainDiscipline || "—"}</td>
                            <td className="px-3 py-3 text-[12px]" style={{ color: "var(--c-text-2)" }}>{athlete.group || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-2xl p-4 text-[13px]" style={{ background: "var(--c-surface-2)", color: "var(--c-text-2)" }}>
                    Aucun profil valide à importer. Corrige les lignes indiquées puis sélectionne à nouveau le fichier.
                  </div>
                )}
                {result.entries.length > PREVIEW_LIMIT && (
                  <p className="text-[12px]" style={{ color: "var(--c-text-3)" }}>
                    Aperçu limité aux {PREVIEW_LIMIT} premiers profils ; les {result.entries.length} profils valides seront bien transmis.
                  </p>
                )}
              </section>

              {result.errors.length > 0 && (
                <section aria-labelledby={`${titleId}-errors`}>
                  <h3 id={`${titleId}-errors`} className="text-[14px] font-bold mb-2" style={{ color: "var(--c-text-1)" }}>
                    Lignes à corriger
                  </h3>
                  <ul
                    className="rounded-2xl divide-y overflow-hidden"
                    style={{ border: "1px solid var(--c-border)" }}
                  >
                    {result.errors.slice(0, ERROR_PREVIEW_LIMIT).map((error, index) => (
                      <li key={`${error.row}-${error.code}-${index}`} className="px-4 py-3 flex items-start gap-3 text-[13px]" style={{ color: "var(--c-text-2)" }}>
                        <span className="font-bold flex-shrink-0" style={{ color: "var(--tone-warning)" }}>Ligne {error.row ?? "—"}</span>
                        <span>{error.message}</span>
                      </li>
                    ))}
                  </ul>
                  {result.errors.length > ERROR_PREVIEW_LIMIT && (
                    <p className="text-[12px] mt-2" style={{ color: "var(--c-text-3)" }}>
                      {result.errors.length - ERROR_PREVIEW_LIMIT} autre(s) ligne(s) incorrecte(s) ne sont pas affichées.
                    </p>
                  )}
                </section>
              )}
            </>
          )}

          {importError && (
            <div role="alert" className="rounded-2xl px-4 py-3 text-[13px]" style={{ background: "rgba(226,75,74,0.1)", color: "var(--tone-danger)" }}>
              {importError}
            </div>
          )}
        </div>

        <footer
          className="px-5 sm:px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0"
          style={{ borderTop: "1px solid var(--c-border)" }}
        >
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!result?.canImport || busy}
            className="btn-primary"
          >
            {importing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
                Import en cours…
              </>
            ) : (
              <>
                <Upload size={15} aria-hidden="true" />
                {validCount
                  ? `Importer ${validCount} athlète${validCount > 1 ? "s" : ""}`
                  : "Importer les athlètes"}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export default memo(ImportAthletesCsvModal);
