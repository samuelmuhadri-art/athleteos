import { cloneElement, isValidElement, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";
import "./premium-primitives.css";

function classes(...values) {
  return values.filter(Boolean).join(" ");
}

function headingTag(level) {
  const safeLevel = Math.min(6, Math.max(1, Number(level) || 2));
  return `h${safeLevel}`;
}

function Icon({ component: Component, size = 20 }) {
  if (!Component) return null;
  return <Component size={size} aria-hidden="true" focusable="false" />;
}

/** En-tête commun d'un écran. Les actions restent lisibles sur mobile. */
export function PageHeader({
  title,
  description,
  eyebrow,
  meta,
  actions,
  headingLevel = 1,
  className,
}) {
  const titleId = useId();
  const Heading = headingTag(headingLevel);

  return (
    <header className={classes("aos-page-header", className)} aria-labelledby={titleId}>
      <div className="aos-page-header__copy">
        {eyebrow && <p className="aos-page-header__eyebrow">{eyebrow}</p>}
        <div className="aos-page-header__title-row">
          <Heading id={titleId} className="aos-page-header__title">{title}</Heading>
          {meta && <div className="aos-page-header__meta">{meta}</div>}
        </div>
        {description && <p className="aos-page-header__description">{description}</p>}
      </div>
      {actions && <div className="aos-page-header__actions">{actions}</div>}
    </header>
  );
}

/** Carte KPI non interactive par défaut, ou bouton complet avec `onClick`. */
export function StatCard({
  label,
  value,
  unit,
  helper,
  trend,
  icon,
  tone = "accent",
  onClick,
  disabled = false,
  loading = false,
  ariaLabel,
  className,
}) {
  const labelId = useId();
  const Component = onClick ? "button" : "article";
  const trendValue = typeof trend === "string" ? { label: trend, direction: "neutral" } : trend;
  const interactiveProps = onClick
    ? {
        type: "button",
        onClick,
        disabled: disabled || loading,
        "aria-label": ariaLabel,
      }
    : {};

  return (
    <Component
      {...interactiveProps}
      className={classes("aos-stat-card", onClick && "aos-stat-card--interactive", className)}
      data-tone={tone}
      aria-labelledby={ariaLabel ? undefined : labelId}
      aria-busy={loading || undefined}
    >
      <div className="aos-stat-card__topline">
        <span id={labelId} className="aos-stat-card__label">{label}</span>
        {icon && <span className="aos-stat-card__icon"><Icon component={icon} /></span>}
      </div>

      {loading ? (
        <div className="aos-stat-card__skeleton" aria-hidden="true" />
      ) : (
        <div className="aos-stat-card__value-row">
          <strong className="aos-stat-card__value">{value}</strong>
          {unit && <span className="aos-stat-card__unit">{unit}</span>}
        </div>
      )}

      {(helper || trendValue) && (
        <div className="aos-stat-card__footer">
          {trendValue && (
            <span className="aos-stat-card__trend" data-direction={trendValue.direction || "neutral"}>
              {trendValue.label}
            </span>
          )}
          {helper && <span className="aos-stat-card__helper">{helper}</span>}
        </div>
      )}
    </Component>
  );
}

/** Cadre homogène pour Recharts, SVG, canvas ou toute autre visualisation. */
export function ChartCard({
  title,
  description,
  actions,
  legend,
  children,
  ariaLabel,
  headingLevel = 2,
  minHeight,
  loading = false,
  className,
}) {
  const titleId = useId();
  const Heading = headingTag(headingLevel);
  const bodyStyle = minHeight
    ? { "--aos-chart-min-height": typeof minHeight === "number" ? `${minHeight}px` : minHeight }
    : undefined;

  return (
    <section className={classes("aos-chart-card", className)} aria-labelledby={titleId} aria-busy={loading || undefined}>
      <div className="aos-chart-card__header">
        <div className="aos-chart-card__copy">
          <Heading id={titleId} className="aos-chart-card__title">{title}</Heading>
          {description && <p className="aos-chart-card__description">{description}</p>}
        </div>
        {actions && <div className="aos-chart-card__actions">{actions}</div>}
      </div>
      <div
        className={classes("aos-chart-card__body", loading && "aos-chart-card__body--loading")}
        style={bodyStyle}
        role="group"
        aria-label={ariaLabel || `Graphique : ${title}`}
      >
        {loading ? <div className="aos-chart-card__skeleton" aria-hidden="true" /> : children}
      </div>
      {legend && <div className="aos-chart-card__legend">{legend}</div>}
    </section>
  );
}

/** Onglets contrôlés avec navigation clavier et cibles tactiles de 44 px. */
export function SegmentedTabs({
  items,
  value,
  onChange,
  ariaLabel = "Choisir une vue",
  className,
}) {
  const tabRefs = useRef([]);
  const enabledItems = items.filter((item) => !item.disabled);
  const fallbackId = enabledItems[0]?.id;
  const hasEnabledSelection = enabledItems.some((item) => item.id === value);
  // A real ARIA tab needs a corresponding panel. View/filter selectors without
  // panels use radio semantics instead of announcing tabs that control nothing.
  const usesTabSemantics = items.length > 0 && items.every((item) => Boolean(item.panelId));

  function activate(item) {
    if (!item || item.disabled) return;
    onChange?.(item.id, item);
  }

  function handleKeyDown(event, item) {
    const enabledIndex = enabledItems.findIndex((candidate) => candidate.id === item.id);
    if (enabledIndex < 0) return;

    let target;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      target = enabledItems[(enabledIndex + 1) % enabledItems.length];
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      target = enabledItems[(enabledIndex - 1 + enabledItems.length) % enabledItems.length];
    } else if (event.key === "Home") {
      target = enabledItems[0];
    } else if (event.key === "End") {
      target = enabledItems[enabledItems.length - 1];
    } else {
      return;
    }

    event.preventDefault();
    const targetIndex = items.findIndex((candidate) => candidate.id === target.id);
    tabRefs.current[targetIndex]?.focus();
    activate(target);
  }

  return (
    <div
      className={classes("aos-segmented-tabs", className)}
      role={usesTabSemantics ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
    >
      {items.map((item, index) => {
        const selected = !item.disabled && item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => { tabRefs.current[index] = node; }}
            type="button"
            role={usesTabSemantics ? "tab" : "radio"}
            className="aos-segmented-tabs__tab"
            aria-label={item.ariaLabel || (item.badge != null ? `${item.label}, ${item.badge}` : undefined)}
            aria-selected={usesTabSemantics ? selected : undefined}
            aria-checked={usesTabSemantics ? undefined : selected}
            aria-controls={usesTabSemantics ? item.panelId : undefined}
            id={item.tabId}
            tabIndex={selected || (!hasEnabledSelection && item.id === fallbackId) ? 0 : -1}
            disabled={item.disabled}
            onClick={() => activate(item)}
            onKeyDown={(event) => handleKeyDown(event, item)}
          >
            {item.icon && <Icon component={item.icon} size={15} />}
            <span>{item.label}</span>
            {item.badge != null && <span className="aos-segmented-tabs__badge">{item.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Ligne de filtres qui défile horizontalement sur les petits écrans. */
export function FilterBar({ children, actions, label = "Filtres", className }) {
  return (
    <div className={classes("aos-filter-bar", className)} role="group" aria-label={label}>
      <span className="aos-filter-bar__label">{label}</span>
      <div className="aos-filter-bar__controls">{children}</div>
      {actions && <div className="aos-filter-bar__actions">{actions}</div>}
    </div>
  );
}

/**
 * Groupe label/contrôle/aide/erreur. Avec un enfant React unique, les attributs
 * d'association et d'invalidité sont ajoutés sans écraser ceux du contrôle.
 */
export function FormField({
  label,
  children,
  controlId,
  hint,
  error,
  required = false,
  optionalLabel = "Facultatif",
  className,
}) {
  const generatedControlId = useId();
  const hintId = useId();
  const errorId = useId();
  const child = isValidElement(children) ? children : null;
  const resolvedControlId = controlId || child?.props?.id || generatedControlId;
  const describedBy = [
    child?.props?.["aria-describedby"],
    hint && hintId,
    error && errorId,
  ].filter(Boolean).join(" ") || undefined;
  const control = child
    ? cloneElement(child, {
        id: resolvedControlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : child.props["aria-invalid"],
        required: required || child.props.required || undefined,
      })
    : children;

  return (
    <div className={classes("aos-form-field", error && "aos-form-field--error", className)}>
      <div className="aos-form-field__label-row">
        <label className="aos-form-field__label" htmlFor={resolvedControlId}>
          {label}
          {required && <span className="aos-form-field__required" aria-hidden="true"> *</span>}
        </label>
        {!required && optionalLabel && <span className="aos-form-field__optional">{optionalLabel}</span>}
      </div>
      <div className="aos-form-field__control">{control}</div>
      {hint && <p id={hintId} className="aos-form-field__hint">{hint}</p>}
      {error && <p id={errorId} className="aos-form-field__error" role="alert">{error}</p>}
    </div>
  );
}

/** Sélecteur natif : fiable au clavier et ouvre le picker du système sur mobile. */
export function MobileSelect({
  options = [],
  placeholder,
  children,
  className,
  selectClassName,
  onChange,
  onValueChange,
  ariaLabel,
  ...selectProps
}) {
  function renderOption(option) {
    if (Array.isArray(option.options)) {
      return (
        <optgroup key={option.label} label={option.label} disabled={option.disabled}>
          {option.options.map(renderOption)}
        </optgroup>
      );
    }
    return <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>;
  }

  return (
    <span className={classes("aos-mobile-select", className)}>
      <select
        {...selectProps}
        className={classes("aos-mobile-select__control", selectClassName)}
        aria-label={ariaLabel}
        onChange={(event) => {
          onChange?.(event);
          onValueChange?.(event.target.value, event);
        }}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {children || options.map(renderOption)}
      </select>
      <ChevronDown className="aos-mobile-select__icon" size={17} aria-hidden="true" />
    </span>
  );
}

/** État vide guidé : explique la prochaine action au lieu d'afficher un vide. */
export function EmptyState({
  title,
  description,
  icon = Sparkles,
  action,
  secondaryAction,
  compact = false,
  className,
}) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <section
      className={classes("aos-empty-state", compact && "aos-empty-state--compact", className)}
      role="status"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      {icon && <span className="aos-empty-state__icon"><Icon component={icon} size={24} /></span>}
      <h3 id={titleId} className="aos-empty-state__title">{title}</h3>
      {description && <p id={descriptionId} className="aos-empty-state__description">{description}</p>}
      {(action || secondaryAction) && (
        <div className="aos-empty-state__actions">
          {action}
          {secondaryAction}
        </div>
      )}
    </section>
  );
}

const NOTICE_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
};

/** Information contextuelle non bloquante avec ton sémantique. */
export function InlineNotice({
  title,
  children,
  tone = "info",
  icon,
  action,
  onDismiss,
  dismissLabel = "Fermer la notification",
  className,
}) {
  const titleId = useId();
  const contentId = useId();
  const NoticeIcon = icon === null ? null : (icon || NOTICE_ICONS[tone] || Info);
  const urgent = tone === "danger";

  return (
    <aside
      className={classes("aos-inline-notice", className)}
      data-tone={tone}
      role={urgent ? "alert" : "status"}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={children ? contentId : undefined}
    >
      {NoticeIcon && <span className="aos-inline-notice__icon"><Icon component={NoticeIcon} /></span>}
      <div className="aos-inline-notice__content">
        {title && <p id={titleId} className="aos-inline-notice__title">{title}</p>}
        {children && <div id={contentId} className="aos-inline-notice__message">{children}</div>}
      </div>
      {action && <div className="aos-inline-notice__action">{action}</div>}
      {onDismiss && (
        <button type="button" className="aos-inline-notice__dismiss" onClick={onDismiss} aria-label={dismissLabel}>
          <X size={17} aria-hidden="true" />
        </button>
      )}
    </aside>
  );
}

function focusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getAttribute("aria-hidden") !== "true");
}

/** Dialogue de confirmation avec focus piégé, Échap et restauration du focus. */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  loadingLabel = "Enregistrement…",
  tone = "danger",
  icon,
  onConfirm,
  onClose,
  confirmDisabled = false,
  loading = false,
  closeOnBackdrop = true,
  initialFocus = "cancel",
}) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const loadingRef = useRef(loading);
  const titleId = useId();
  const descriptionId = useId();
  const contentId = useId();
  onCloseRef.current = onClose;
  loadingRef.current = loading;

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const firstFocus = initialFocus === "confirm" && !confirmDisabled
      ? confirmRef.current
      : cancelRef.current;
    firstFocus?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (!loadingRef.current) {
          event.preventDefault();
          onCloseRef.current?.();
        }
        return;
      }

      if (event.key !== "Tab") return;
      const focusables = focusableElements(dialogRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open, initialFocus, confirmDisabled]);

  if (!open || typeof document === "undefined") return null;

  const DialogIcon = icon === null ? null : (icon || (tone === "danger" ? AlertTriangle : Info));
  const describedBy = [description && descriptionId, children && contentId].filter(Boolean).join(" ") || undefined;

  return createPortal(
    <div
      className="aos-confirm-dialog__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && closeOnBackdrop && !loading) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className="aos-confirm-dialog"
        data-tone={tone}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        <div className="aos-confirm-dialog__header">
          {DialogIcon && <span className="aos-confirm-dialog__icon"><Icon component={DialogIcon} size={22} /></span>}
          <div className="aos-confirm-dialog__copy">
            <h2 id={titleId} className="aos-confirm-dialog__title">{title}</h2>
            {description && <p id={descriptionId} className="aos-confirm-dialog__description">{description}</p>}
          </div>
          <button
            type="button"
            className="aos-confirm-dialog__close"
            onClick={onClose}
            disabled={loading}
            aria-label="Fermer"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        {children && <div id={contentId} className="aos-confirm-dialog__content">{children}</div>}

        <div className="aos-confirm-dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="aos-dialog-button aos-dialog-button--secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="aos-dialog-button aos-dialog-button--confirm"
            onClick={onConfirm}
            disabled={confirmDisabled || loading}
          >
            {loading && <LoaderCircle className="aos-dialog-button__spinner" size={17} aria-hidden="true" />}
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Panneau modal générique ancré en bas, adapté aux choix et formulaires mobiles. */
export function BottomSheet({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  closeLabel = "Fermer le panneau",
  closeOnBackdrop = true,
  dismissDisabled = false,
  size = "md",
  className,
}) {
  const sheetRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const dismissDisabledRef = useRef(dismissDisabled);
  const titleId = useId();
  const descriptionId = useId();
  onCloseRef.current = onClose;
  dismissDisabledRef.current = dismissDisabled;

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (!dismissDisabledRef.current) {
          event.preventDefault();
          onCloseRef.current?.();
        }
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = focusableElements(sheetRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        sheetRef.current?.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !sheetRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !sheetRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="aos-bottom-sheet__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && closeOnBackdrop && !dismissDisabled) onClose?.();
      }}
    >
      <section
        ref={sheetRef}
        className={classes("aos-bottom-sheet", className)}
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="aos-bottom-sheet__handle" aria-hidden="true" />
        <header className="aos-bottom-sheet__header">
          <div className="aos-bottom-sheet__copy">
            <h2 id={titleId} className="aos-bottom-sheet__title">{title}</h2>
            {description && <p id={descriptionId} className="aos-bottom-sheet__description">{description}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="aos-bottom-sheet__close"
            onClick={onClose}
            disabled={dismissDisabled}
            aria-label={closeLabel}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className="aos-bottom-sheet__content">{children}</div>
        {footer && <footer className="aos-bottom-sheet__footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
