import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import {
  ALERT_RECIPIENT_SCOPES,
  ALERT_RULE_CATALOG,
  ALERT_SEVERITIES,
} from "../../domain/alertRules";
import { useModules } from "../../hooks/useModules";
import { fetchAlertRules, saveAlertRules } from "../../services/alertRulesService";

function RuleEditor({ catalogRule, rule, groups, moduleEnabled, onChange }) {
  const set = patch => onChange({ ...rule, ...patch });
  const setParameter = (key, value) => set({ parameters:{ ...rule.parameters, [key]:Number(value) } });

  return <article className="rounded-xl p-3 space-y-3" style={{ background:"var(--c-surface-2)", border:"1px solid var(--c-border)" }}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h5 className="text-[13px] font-semibold" style={{ color:"var(--c-text-1)" }}>{catalogRule.label}</h5>
          {!moduleEnabled && <span className="text-[10px] rounded-full px-2 py-0.5" style={{ color:"var(--c-text-3)", background:"var(--c-surface-3)" }}>En pause · outil désactivé</span>}
        </div>
        <p className="meta-text mt-1">{catalogRule.description}</p>
      </div>
      <label className="module-toggle flex-shrink-0" data-on={rule.enabled ? "true" : "false"} aria-label={`Activer ${catalogRule.label}`}>
        <input className="sr-only" type="checkbox" checked={rule.enabled} onChange={event => set({ enabled:event.target.checked })} />
        <span aria-hidden="true" />
      </label>
    </div>

    {rule.enabled && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {catalogRule.fields.map(field => <label key={field.key} className="text-[11px] font-semibold" style={{ color:"var(--c-text-2)" }}>
        {field.label}
        <span className="flex items-center gap-2 mt-1">
          <input className="input-premium" type="number" min={field.min} max={field.max} step={field.step} value={rule.parameters[field.key]} onChange={event => setParameter(field.key, event.target.value)} />
          {field.suffix && <span className="meta-text whitespace-nowrap">{field.suffix}</span>}
        </span>
      </label>)}
      <label className="text-[11px] font-semibold" style={{ color:"var(--c-text-2)" }}><span id={`${rule.key}-population-label`}>Population</span>
        <select aria-labelledby={`${rule.key}-population-label`} className="input-premium mt-1" value={rule.targetGroup ?? ""} onChange={event => set({ targetGroup:event.target.value || null })}>
          <option value="">Tous les athlètes concernés</option>
          {groups.map(group => <option key={group} value={group}>Groupe · {group}</option>)}
        </select>
      </label>
      <label className="text-[11px] font-semibold" style={{ color:"var(--c-text-2)" }}><span id={`${rule.key}-severity-label`}>Niveau</span>
        <select aria-labelledby={`${rule.key}-severity-label`} className="input-premium mt-1" value={rule.severity} onChange={event => set({ severity:event.target.value })}>
          {ALERT_SEVERITIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="text-[11px] font-semibold sm:col-span-2" style={{ color:"var(--c-text-2)" }}><span id={`${rule.key}-recipients-label`}>Destinataires</span>
        <select aria-labelledby={`${rule.key}-recipients-label`} className="input-premium mt-1" value={rule.recipientScope} onChange={event => set({ recipientScope:event.target.value })}>
          {ALERT_RECIPIENT_SCOPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
    </div>}
  </article>;
}

export default function AlertRulesSettings() {
  const { athletes = [], club } = useModules();
  const [rules, setRules] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const groups = useMemo(() => [...new Set(athletes.map(item => item.group_name).filter(Boolean))].sort(), [athletes]);

  useEffect(() => {
    let active = true;
    fetchAlertRules()
      .then(value => { if (active) setRules(value); })
      .catch(error => { if (active) setMessage({ tone:"error", text:error.message }); });
    return () => { active = false; };
  }, []);

  const updateRule = (key, value) => setRules(current => current.map(rule => rule.key === key ? value : rule));
  const save = async () => {
    for (const rule of rules) {
      const catalogRule = ALERT_RULE_CATALOG.find(item => item.key === rule.key);
      const invalid = catalogRule.fields.find(field => !Number.isInteger(rule.parameters[field.key])
        || rule.parameters[field.key] < field.min || rule.parameters[field.key] > field.max);
      if (invalid) {
        setMessage({ tone:"error", text:`${catalogRule.label} : ${invalid.label.toLowerCase()} doit être compris entre ${invalid.min} et ${invalid.max}.` });
        return;
      }
    }
    setSaving(true); setMessage(null);
    try {
      const saved = await saveAlertRules(rules);
      setRules(saved);
      setMessage({ tone:"success", text:"Règles d’alertes enregistrées. Chaque nouvelle alerte indiquera la règle et les données qui l’ont déclenchée." });
    } catch (error) {
      setMessage({ tone:"error", text:error.message ?? "Enregistrement impossible." });
    } finally { setSaving(false); }
  };

  return <section className="settings-branding-card" aria-labelledby="settings-alert-rules-title">
    <div className="settings-branding-heading">
      <span><BellRing size={18} aria-hidden="true" /></span>
      <div>
        <p className="meta-text">ALERTES DU CLUB</p>
        <h4 id="settings-alert-rules-title">Règles du club</h4>
        <p>Active uniquement les signaux utiles à ta méthode. AthleteOS décrit les faits observés ; il ne pose aucun diagnostic et ne modifie jamais un entraînement automatiquement.</p>
      </div>
    </div>

    {!rules ? <p className="meta-text">Chargement des règles…</p> : <div className="space-y-2">
      {ALERT_RULE_CATALOG.map(catalogRule => <RuleEditor
        key={catalogRule.key}
        catalogRule={catalogRule}
        rule={rules.find(rule => rule.key === catalogRule.key)}
        groups={groups}
        moduleEnabled={club[catalogRule.moduleKey] !== false}
        onChange={value => updateRule(catalogRule.key, value)}
      />)}
    </div>}

    {message && <p className="text-[12px]" role="status" style={{ color:message.tone === "error" ? "var(--tone-danger)" : "var(--tone-success)" }}>{message.text}</p>}
    {rules && <div className="flex justify-end"><button type="button" className="btn-primary" disabled={saving} onClick={save}><CheckCircle2 size={15} /> {saving ? "Enregistrement…" : "Enregistrer les règles"}</button></div>}
  </section>;
}
