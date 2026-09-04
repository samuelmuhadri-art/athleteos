import { describe, expect, it } from "vitest";
import { countUnreadActiveAlerts, filterAlertLifecycle, mergePersonalAlertReadState } from "./alertLifecycle";

describe("cycle de vie des alertes coach", () => {
  const alerts = [
    { id:1, resolvedAt:null, archivedAt:null },
    { id:2, resolvedAt:"2026-09-01T08:00:00Z", archivedAt:null },
    { id:3, resolvedAt:null, archivedAt:"2026-09-01T09:00:00Z" },
  ];

  it("sépare lecture personnelle, résolution métier et historique", () => {
    const merged = mergePersonalAlertReadState(alerts, [{ alert_id:1 }, { alert_id:2 }]);
    expect(merged.map(alert => alert.isRead)).toEqual([true, true, false]);
    expect(filterAlertLifecycle(merged, "active").map(alert => alert.id)).toEqual([1]);
    expect(filterAlertLifecycle(merged, "history").map(alert => alert.id)).toEqual([2, 3]);
  });

  it("ne compte au badge que les alertes actives non lues par ce coach", () => {
    expect(countUnreadActiveAlerts(mergePersonalAlertReadState(alerts, [{ alert_id:2 }]))).toBe(1);
  });
});
