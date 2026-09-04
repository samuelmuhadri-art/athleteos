export function mergePersonalAlertReadState(alerts = [], readStates = []) {
  const readIds = new Set(readStates.map(state => Number(state.alert_id ?? state.alertId)));
  return alerts.map(alert => ({ ...alert, isRead:readIds.has(Number(alert.id)) }));
}

export function isActiveAlert(alert) {
  return !alert.resolvedAt && !alert.archivedAt;
}

export function filterAlertLifecycle(alerts = [], lifecycle = "active") {
  return alerts.filter(alert => lifecycle === "history" ? !isActiveAlert(alert) : isActiveAlert(alert));
}

export function countUnreadActiveAlerts(alerts = []) {
  return alerts.filter(alert => isActiveAlert(alert) && !alert.isRead).length;
}
