import { describe, expect, it } from "vitest";
import { ALERT_RULE_CATALOG, alertRuleExplanation, normalizeAlertRules } from "./alertRules";

describe("alertRules", () => {
  it("expose uniquement le catalogue métier fermé", () => {
    expect(ALERT_RULE_CATALOG.map(rule => rule.key)).toEqual([
      "wellness_missing", "sleep_low", "soreness_high", "feedback_missing",
      "rpe_missing", "competition_unplanned", "load_variation",
    ]);
  });

  it("complète les règles manquantes avec des valeurs sûres et désactivées", () => {
    const rules = normalizeAlertRules([{ key:"sleep_low", enabled:true, parameters:{ threshold:0, consecutiveResponses:99 } }]);
    expect(rules).toHaveLength(ALERT_RULE_CATALOG.length);
    expect(rules.find(rule => rule.key === "sleep_low")).toMatchObject({
      enabled:true, parameters:{ threshold:1, consecutiveResponses:7 }, severity:"modérée", recipientScope:"staff",
    });
    expect(rules.find(rule => rule.key === "wellness_missing").enabled).toBe(false);
  });

  it("normalise groupe, destinataires, sévérité et version", () => {
    const [rule] = normalizeAlertRules([{
      key:"wellness_missing", enabled:true, parameters:{ days:3 }, targetGroup:"  Sprint  ",
      severity:"critique", recipientScope:"head_coach", version:4,
    }]);
    expect(rule).toMatchObject({ targetGroup:"Sprint", severity:"critique", recipientScope:"head_coach", version:4 });
  });

  it("produit une provenance courte sans diagnostic", () => {
    expect(alertRuleExplanation({ ruleKey:"sleep_low", triggerData:{ since:"2026-09-05" } }))
      .toBe("Sommeil sous le seuil · observée depuis le 05/09/2026");
    expect(alertRuleExplanation({ type:"performance" })).toBeNull();
  });
});
