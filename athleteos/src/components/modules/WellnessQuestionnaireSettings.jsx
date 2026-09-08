import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, HeartPulse } from "lucide-react";
import { WELLNESS_QUESTION_CATALOG } from "../../domain/wellnessQuestionnaire";
import { fetchWellnessQuestionnaire, saveWellnessQuestionnaire } from "../../services/wellnessQuestionnaireService";

const DAYS = [
  { id:1, label:"L" }, { id:2, label:"M" }, { id:3, label:"M" }, { id:4, label:"J" },
  { id:5, label:"V" }, { id:6, label:"S" }, { id:7, label:"D" },
];

function editorQuestions(configuration) {
  const active = new Map((configuration.questions ?? []).map(item => [item.key, item]));
  const orderedKeys = [
    ...(configuration.questions ?? []).map(item => item.key),
    ...WELLNESS_QUESTION_CATALOG.map(item => item.key).filter(key => !active.has(key)),
  ];
  return orderedKeys.map(key => ({ key, active:active.has(key), required:active.has(key) ? active.get(key)?.required !== false : false }));
}

export default function WellnessQuestionnaireSettings() {
  const [configuration, setConfiguration] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [days, setDays] = useState([]);
  const [visibility, setVisibility] = useState("staff");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    fetchWellnessQuestionnaire(new Date().toISOString().slice(0, 10))
      .then(value => {
        if (!active) return;
        setConfiguration(value);
        setQuestions(editorQuestions(value));
        setDays(value.activeDays);
        setVisibility(value.responseVisibility);
      })
      .catch(error => { if (active) setMessage({ tone:"error", text:error.message }); });
    return () => { active = false; };
  }, []);

  const updateQuestion = (key, patch) => setQuestions(current => current.map(item => item.key === key ? { ...item, ...patch } : item));
  const move = (index, direction) => setQuestions(current => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const toggleDay = day => setDays(current => current.includes(day) ? current.filter(item => item !== day) : [...current, day].sort((a, b) => a - b));

  const save = async () => {
    const activeQuestions = questions.filter(item => item.active).map(({ key, required }) => ({ key, required }));
    if (activeQuestions.length === 0 || days.length === 0) {
      setMessage({ tone:"error", text:"Garde au moins une question et un jour actifs." });
      return;
    }
    setSaving(true); setMessage(null);
    try {
      const result = await saveWellnessQuestionnaire({ questions:activeQuestions, activeDays:days, responseVisibility:visibility });
      setConfiguration(current => ({ ...current, versionId:result.versionId, versionNumber:result.versionNumber, isDefault:false }));
      setMessage({ tone:"success", text:`Questionnaire v${result.versionNumber} activé. L’historique conserve ses anciennes versions.` });
    } catch (error) {
      setMessage({ tone:"error", text:error.message ?? "Enregistrement impossible." });
    } finally { setSaving(false); }
  };

  return <section className="settings-branding-card" aria-labelledby="settings-wellness-title">
    <div className="settings-branding-heading">
      <span><HeartPulse size={18} aria-hidden="true" /></span>
      <div>
        <p className="meta-text">BIEN-ÊTRE · {configuration?.isDefault ? "PRESET ATHLETEOS" : `VERSION ${configuration?.versionNumber ?? "—"}`}</p>
        <h4 id="settings-wellness-title">Questionnaire du club</h4>
        <p>Active et ordonne uniquement les repères utiles à ta méthode. Chaque changement crée une version ; les anciennes réponses gardent leur sens.</p>
      </div>
    </div>

    {!configuration ? <p className="meta-text">Chargement du questionnaire…</p> : <div className="space-y-4">
      <div className="space-y-2">
        {questions.map((item, index) => {
          const question = WELLNESS_QUESTION_CATALOG.find(entry => entry.key === item.key);
          return <div key={item.key} className="rounded-xl p-3 flex items-center gap-3" style={{ background:"var(--c-surface-2)", border:"1px solid var(--c-border)" }}>
            <label className="flex items-center gap-2 min-w-0 flex-1 text-[12px] font-semibold">
              <input type="checkbox" checked={item.active} onChange={event => updateQuestion(item.key, { active:event.target.checked })} />
              <span className="truncate">{question.label}</span>
            </label>
            {item.active && <label className="flex items-center gap-1 text-[11px] whitespace-nowrap" style={{ color:"var(--c-text-2)" }}>
              <input type="checkbox" checked={item.required} onChange={event => updateQuestion(item.key, { required:event.target.checked })} /> Obligatoire
            </label>}
            <div className="flex gap-1">
              <button type="button" className="btn-icon" aria-label={`Monter ${question.label}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={13} /></button>
              <button type="button" className="btn-icon" aria-label={`Descendre ${question.label}`} disabled={index === questions.length - 1} onClick={() => move(index, 1)}><ArrowDown size={13} /></button>
            </div>
          </div>;
        })}
      </div>

      <div>
        <p className="metric-label mb-2">JOURS OÙ LE QUESTIONNAIRE EST DEMANDÉ</p>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map(day => <button type="button" key={day.id} aria-label={["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"][day.id - 1]} aria-pressed={days.includes(day.id)} onClick={() => toggleDay(day.id)} className={days.includes(day.id) ? "btn-primary" : "btn-secondary"}>{day.label}</button>)}
        </div>
      </div>

      <details className="rounded-xl p-3" style={{ border:"1px solid var(--c-border)" }}>
        <summary className="min-h-11 flex items-center cursor-pointer text-[12px] font-semibold">Visibilité des réponses</summary>
        <label className="block text-[12px] mt-2">Qui peut consulter les nouvelles réponses ?
          <select className="input-premium mt-1" value={visibility} onChange={event => setVisibility(event.target.value)}>
            <option value="staff">Responsable et coachs du club</option>
            <option value="head_coach">Responsable du club uniquement</option>
          </select>
        </label>
        <p className="meta-text mt-2">L’athlète garde toujours accès à ses propres réponses. Ce réglage n’altère pas les anciennes versions.</p>
      </details>
    </div>}

    {message && <p className="text-[12px]" role="status" style={{ color:message.tone === "error" ? "var(--tone-danger)" : "var(--tone-success)" }}>{message.text}</p>}
    {configuration && <div className="flex justify-end"><button type="button" className="btn-primary" disabled={saving} onClick={save}><CheckCircle2 size={15} /> {saving ? "Enregistrement…" : "Activer cette configuration"}</button></div>}
  </section>;
}
