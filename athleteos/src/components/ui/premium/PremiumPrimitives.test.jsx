import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  BottomSheet,
  ChartCard,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  FormField,
  InlineNotice,
  MobileSelect,
  PageHeader,
  SegmentedTabs,
  StatCard,
} from "./PremiumPrimitives";

afterEach(cleanup);

function TestIcon(props) {
  return <svg data-testid="test-icon" {...props} />;
}

describe("Premium UI primitives", () => {
  it("structure les titres, KPI, graphiques, filtres et états vides de façon accessible", () => {
    const onStatClick = vi.fn();

    render(
      <main>
        <PageHeader
          eyebrow="Club Vinci"
          title="Tableau de bord"
          description="Les priorités de la semaine."
          meta={<span>5 athlètes</span>}
          actions={<button type="button">Ajouter</button>}
        />
        <StatCard
          label="Charge moyenne"
          value="84"
          unit="%"
          helper="Sur 7 jours"
          trend={{ label: "+8 %", direction: "positive" }}
          icon={TestIcon}
          onClick={onStatClick}
        />
        <ChartCard title="Progression" description="Cette saison" ariaLabel="Courbe de progression">
          <svg aria-label="Données du graphique" />
        </ChartCard>
        <FilterBar label="Filtrer les athlètes">
          <button type="button">Sprint</button>
        </FilterBar>
        <EmptyState
          title="Aucune séance"
          description="Créez la première séance du club."
          action={<button type="button">Créer une séance</button>}
        />
      </main>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Charge moyenne/ })).not.toHaveAttribute("aria-busy");
    fireEvent.click(screen.getByRole("button", { name: /Charge moyenne/ }));
    expect(onStatClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("group", { name: "Courbe de progression" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Filtrer les athlètes" })).toBeVisible();
    expect(screen.getByRole("status", { name: "Aucune séance" })).toHaveAccessibleDescription("Créez la première séance du club.");
  });

  it("gère les onglets au clavier en ignorant les choix désactivés", () => {
    const onChange = vi.fn();
    render(
      <SegmentedTabs
        ariaLabel="Période"
        value="week"
        onChange={onChange}
        items={[
          { id: "week", label: "Semaine", panelId: "period-panel" },
          { id: "month", label: "Mois", disabled: true, panelId: "period-panel" },
          { id: "season", label: "Saison", badge: 2, panelId: "period-panel" },
        ]}
      />,
    );

    const week = screen.getByRole("tab", { name: "Semaine" });
    const season = screen.getByRole("tab", { name: "Saison, 2" });
    expect(week).toHaveAttribute("aria-selected", "true");

    week.focus();
    fireEvent.keyDown(week, { key: "ArrowRight" });
    expect(season).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("season", expect.objectContaining({ id: "season" }));

    fireEvent.keyDown(season, { key: "Home" });
    expect(week).toHaveFocus();
    fireEvent.click(season);
    expect(onChange).toHaveBeenLastCalledWith("season", expect.objectContaining({ label: "Saison" }));
  });

  it("utilise une sélection radio pour un filtre qui ne contrôle pas de panneaux", () => {
    render(
      <SegmentedTabs
        ariaLabel="Filtrer les conversations"
        value="all"
        items={[{ id: "all", label: "Toutes" }, { id: "unread", label: "Non lues" }]}
      />,
    );

    expect(screen.getByRole("radiogroup", { name: "Filtrer les conversations" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Toutes" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Non lues" })).toHaveAttribute("aria-checked", "false");
  });

  it("annonce une notification urgente et permet de la fermer", () => {
    const onDismiss = vi.fn();
    render(
      <InlineNotice tone="danger" title="Données incomplètes" onDismiss={onDismiss}>
        Deux athlètes n'ont pas rempli leur suivi.
      </InlineNotice>,
    );

    expect(screen.getByRole("alert")).toHaveAccessibleName("Données incomplètes");
    fireEvent.click(screen.getByRole("button", { name: "Fermer la notification" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("ConfirmDialog", () => {
  it("place le focus sur l'action sûre, confirme et se ferme avec Échap", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Supprimer la séance ?"
        description="Cette action est définitive."
        confirmLabel="Supprimer"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Supprimer la séance ?" });
    expect(dialog).toHaveAccessibleDescription("Cette action est définitive.");
    expect(screen.getByRole("button", { name: "Annuler" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(onConfirm).toHaveBeenCalledOnce();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("piège puis restaure le focus et bloque la fermeture pendant le chargement", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Ouvrir";
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();

    const { rerender } = render(
      <ConfirmDialog
        open
        title="Enregistrement"
        loading
        onClose={onClose}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enregistrement…" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement);
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <ConfirmDialog
        open={false}
        title="Enregistrement"
        loading={false}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    );
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});

describe("Form and mobile primitives", () => {
  it("associe le label, l'aide et l'erreur au champ sans perdre les attributs existants", () => {
    render(
      <FormField
        label="Nom du club"
        hint="Visible par tous les athlètes."
        error="Le nom est requis."
        required
      >
        <input aria-describedby="external-help" />
      </FormField>,
    );

    const input = screen.getByLabelText(/Nom du club/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain("external-help");
    expect(screen.getByRole("alert")).toHaveTextContent("Le nom est requis.");
  });

  it("utilise le sélecteur natif du système et expose la valeur choisie", () => {
    const onValueChange = vi.fn();
    render(
      <MobileSelect
        ariaLabel="Groupe d’entraînement"
        defaultValue="sprint"
        onValueChange={onValueChange}
        options={[
          { value: "sprint", label: "Sprint" },
          { value: "jumps", label: "Sauts" },
        ]}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Groupe d’entraînement" });
    expect(select).toHaveValue("sprint");
    fireEvent.change(select, { target: { value: "jumps" } });
    expect(onValueChange).toHaveBeenCalledWith("jumps", expect.anything());
  });

  it("ouvre le panneau bas, piège le focus puis le restaure", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Choisir";
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();

    const { rerender } = render(
      <BottomSheet
        open
        title="Choisir des athlètes"
        description="Sélectionnez un ou plusieurs membres."
        onClose={onClose}
        footer={<button type="button">Valider</button>}
      >
        <button type="button">Groupe sprint</button>
      </BottomSheet>,
    );

    expect(screen.getByRole("dialog", { name: "Choisir des athlètes" })).toHaveAccessibleDescription("Sélectionnez un ou plusieurs membres.");
    expect(screen.getByRole("button", { name: "Fermer le panneau" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    const validate = screen.getByRole("button", { name: "Valider" });
    validate.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Fermer le panneau" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<BottomSheet open={false} title="Choisir des athlètes" onClose={onClose} />);
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
    trigger.remove();
  });
});
