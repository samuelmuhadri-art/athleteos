// Allowlist, not a fragile list of sensitive field names. No wellness answers,
// messages, names, tokens, URLs with query strings or DOM breadcrumbs leave here.
export function sanitizeMonitoringEvent(event) {
  const safe = {};
  for (const key of ["event_id", "timestamp", "platform", "level", "release", "environment", "sdk"]) {
    if (event[key] !== undefined) safe[key] = event[key];
  }
  if (event.exception?.values) safe.exception = { values: event.exception.values.map((entry) => ({
    type: /^[A-Za-z][A-Za-z0-9_.]{0,80}$/.test(entry.type ?? "") ? entry.type : "ApplicationError",
    value: "Erreur technique AthleteOS (contenu masqué)",
    stacktrace: { frames: (entry.stacktrace?.frames ?? []).map((frame) => {
      const safeFrame = {};
      for (const key of ["lineno", "colno", "in_app"]) if (frame[key] !== undefined) safeFrame[key] = frame[key];
      // Only production build asset names, never arbitrary paths/user content.
      const asset = String(frame.filename ?? "").split(/[?#]/)[0].match(/\/assets\/([A-Za-z0-9_.-]+\.(?:js|css))$/);
      if (asset) safeFrame.filename = `/assets/${asset[1]}`;
      return safeFrame;
    }) },
  })) };
  return safe;
}
