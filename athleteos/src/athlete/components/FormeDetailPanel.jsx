// ============================================================
// AthleteOS — src/athlete/components/FormeDetailPanel.jsx
// Extrait de AthleteApp.jsx — const FormeDetailPanel = memo(...)
// Zéro modification du code.
// ============================================================

import { useMemo, memo } from "react";
import { X, Zap } from "lucide-react";
import { getISOWeek, METRIC_SCIENCE } from "../shared";

const FormeDetailPanel = memo(({ metricKey, metrics, sessions, weeklyCharge, athlete, onClose }) => {
  const science     = METRIC_SCIENCE[metricKey];
  const value       = metrics[metricKey] ?? 0;
  const color       = science.color(value);
  const currentWeek = getISOWeek(new Date());

  const threshold = science.thresholds.find(t => value >= t.min && value <= t.max)
    ?? science.thresholds[science.thresholds.length - 1];

  const weekSessions = useMemo(() => {
    return sessions
      .filter(s => s.week === currentWeek || s.week === currentWeek - 1)
      .filter(s => s.athleteIds?.includes(athlete.id))
      .map(s => {
        const val = s.validations?.find(v => v.athleteId === athlete.id);
        return { ...s, validation: val };
      })
      .filter(s => s.validation?.rpe != null)
      .sort((a, b) => b.week - a.week || a.day?.localeCompare(b.day ?? ""));
  }, [sessions, athlete.id, currentWeek]);

  const recentCharge = useMemo(() => {
    return weeklyCharge
      .filter(w => w.athleteId === athlete.id && w.week >= currentWeek - 3 && w.week <= currentWeek)
      .sort((a, b) => a.week - b.week)
      .map(w => ({
        week:  w.week,
        label: `S${w.week}`,
        load:  w.rawLoad,
        color: w.rawLoad > 500 ? "#E24B4A" : w.rawLoad > 350 ? "#EF9F27" : "#1D9E75",
      }));
  }, [weeklyCharge, athlete.id, currentWeek]);

  const maxLoad = Math.max(...recentCharge.map(w => w.load), 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden modal-content">

        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-6 py-5 flex items-start justify-between gap-4 flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${color}18, ${color}08)`, borderBottom: `2px solid ${color}30` }}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: `${color}15` }}>
              <span className="text-[28px]">{science.icon}</span>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color }}>
                État de forme
              </p>
              <h2 className="text-[20px] font-black text-slate-800 leading-tight">{science.label}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[32px] font-black leading-none" style={{ color }}>{value}</span>
                <div>
                  <p className="text-[10px] text-slate-400 font-medium">{science.unit}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${threshold.color}15`, color: threshold.color }}>
                    {threshold.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 flex-shrink-0 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Jauge */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
              <span>{science.inverted ? "Optimal" : "Faible"}</span>
              <span className="font-bold" style={{ color }}>Optimal : {science.optimal}</span>
              <span>{science.inverted ? "Critique" : "Optimal"}</span>
            </div>
            <div className="relative h-4 rounded-full overflow-hidden bg-slate-100">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }} />
              <div className="absolute top-0 h-full w-0.5 bg-white/80"
                style={{ left: science.inverted ? "30%" : "75%" }} />
            </div>
            <div className="flex justify-between text-[9px] text-slate-300 mt-1">
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>

          {/* Conseil */}
          <div className="rounded-2xl p-4"
            style={{ background: `${threshold.color}10`, border: `1.5px solid ${threshold.color}25` }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: threshold.color }}>
                <Zap size={12} color="white" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: threshold.color }}>
                Conseil du jour
              </p>
            </div>
            <p className="text-[13px] text-slate-700 leading-relaxed font-medium">{threshold.advice}</p>
          </div>

          {/* Ce que ça mesure */}
          <div className="card p-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ce que mesure ce score</p>
            <p className="text-[13px] text-slate-600 leading-relaxed">{science.what}</p>
          </div>

          {/* Formule */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">🔢 Formule de calcul</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[12.5px] text-slate-600 leading-relaxed font-mono bg-slate-50 rounded-xl px-3 py-2">
                {science.formula}
              </p>
            </div>
          </div>

          {/* Séances ayant contribué */}
          {weekSessions.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3.5 border-b border-slate-50">
                <p className="text-[13px] font-bold text-slate-800">Séances ayant contribué</p>
                <p className="text-[11px] text-slate-400 mt-0.5">2 dernières semaines · RPE validé</p>
              </div>
              <div className="divide-y divide-slate-50">
                {weekSessions.slice(0, 6).map(s => {
                  const rpe    = s.validation?.rpe ?? 0;
                  const load   = (s.durationMinutes ?? 60) * rpe;
                  const rpeCol = rpe <= 3 ? "#1D9E75" : rpe <= 6 ? "#EF9F27" : "#E24B4A";
                  return (
                    <div key={s.id} className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[11px] font-black text-white"
                        style={{ background: rpeCol }}>
                        {rpe}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-bold text-slate-700 truncate">{s.title}</p>
                        <p className="text-[11px] text-slate-400">{s.day} · S{s.week} · {s.durationMinutes ?? 60} min</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[13px] font-black" style={{ color: rpeCol }}>{load}</p>
                        <p className="text-[9px] text-slate-300 font-medium">charge</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Charge hebdo */}
          {recentCharge.length > 0 && (
            <div className="card p-4">
              <p className="text-[13px] font-bold text-slate-800 mb-1">Charge hebdomadaire</p>
              <p className="text-[11px] text-slate-400 mb-4">4 dernières semaines (méthode session-RPE · Foster 2001)</p>
              <div className="flex items-end gap-2 h-20">
                {recentCharge.map((w, i) => {
                  const pct       = (w.load / maxLoad) * 100;
                  const isCurrent = w.week === currentWeek;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end" style={{ height: "64px" }}>
                        <div className="w-full rounded-t-xl transition-all"
                          style={{ height: `${Math.max(pct, 5)}%`, background: isCurrent ? w.color : w.color + "60",
                            outline: isCurrent ? `2px solid ${w.color}` : "none", outlineOffset: "1px" }} />
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium">{w.label}</p>
                      <p className="text-[9px] font-black" style={{ color: w.color }}>{w.load}</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-300 mt-3">
                Charge = durée (min) × RPE · Foster et al. (2001)
              </p>
            </div>
          )}

          {/* Sources */}
          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">📚 Sources scientifiques</p>
            </div>
            <div className="divide-y divide-slate-50">
              {science.sources.map((src, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="text-[12px] font-bold text-slate-700">{src.ref}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 italic">{src.detail}</p>
                </div>
              ))}
              <div className="px-4 py-3 bg-amber-50/50">
                <p className="text-[10.5px] text-amber-700 leading-relaxed">
                  ⚠️ Les coefficients de pondération sont des conventions de coaching AthleteOS, pas des standards publiés.
                </p>
              </div>
            </div>
          </div>

          {/* Grille d'interprétation */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Grille d'interprétation</p>
            {science.thresholds.map((t, i) => (
              <div key={i}
                className={["rounded-2xl px-4 py-3.5 flex items-center gap-3 border",
                  value >= t.min && value <= t.max ? "border-2" : "border-slate-100"].join(" ")}
                style={value >= t.min && value <= t.max
                  ? { background: `${t.color}10`, borderColor: t.color }
                  : { background: "white" }}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[12.5px] font-bold" style={{ color: t.color }}>{t.label}</p>
                    <span className="text-[10px] text-slate-400">{t.min}–{t.max}</span>
                    {value >= t.min && value <= t.max && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: t.color }}>
                        Tu es ici
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">{t.advice}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default FormeDetailPanel;