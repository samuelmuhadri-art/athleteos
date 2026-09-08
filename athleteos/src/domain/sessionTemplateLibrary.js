export function mapSessionTemplate(row) {
  return {
    ...row,
    scope:row.scope === "club" ? "club" : "personal",
    tags:Array.isArray(row.tags) ? row.tags : [],
    documents:(row.session_template_documents ?? [])
      .map(link => link.documents)
      .filter(Boolean),
  };
}

export function filterSessionTemplates(templates, { search = "", category = "all", scope = "all" } = {}) {
  const needle = search.trim().toLocaleLowerCase("fr");
  return templates.filter(template => {
    if (category !== "all" && template.category !== category) return false;
    if (scope !== "all" && template.scope !== scope) return false;
    if (!needle) return true;
    return [template.name, template.title, template.description, ...(template.tags ?? [])]
      .filter(Boolean)
      .some(value => String(value).toLocaleLowerCase("fr").includes(needle));
  });
}

export function canManageSessionTemplate(template, currentUserId, isHeadCoach) {
  return template.created_by === currentUserId || (isHeadCoach && template.scope === "club");
}

export function nextTemplateCopyName(template, templates) {
  const base = `${template.name} — copie`;
  const names = new Set(templates
    .filter(item => item.scope === "personal")
    .map(item => item.name));
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

export function templatePayload(values) {
  return {
    name:values.name.trim(),
    title:values.title.trim(),
    category:values.category || null,
    type:values.type || null,
    trainingFocus:values.trainingFocus || null,
    durationMinutes:Number(values.durationMinutes),
    description:values.description?.trim() || null,
    instructions:values.instructions?.trim() || null,
    scope:values.scope === "club" ? "club" : "personal",
    tags:(Array.isArray(values.tags) ? values.tags : String(values.tags ?? "").split(","))
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 12),
  };
}
