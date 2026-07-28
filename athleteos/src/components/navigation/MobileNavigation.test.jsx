import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import MobileBottomNav from "./MobileBottomNav";
import MobileMoreSheet from "./MobileMoreSheet";
import { COACH_MOBILE_MORE_ITEMS } from "../../navigation/mobileNavigation";

afterEach(cleanup);

function TestIcon(props) {
  return <svg data-testid="navigation-icon" {...props} />;
}

describe("MobileBottomNav", () => {
  it("ouvre toutes les destinations et conserve l'état actif et les compteurs", () => {
    const onSelect = vi.fn();
    const onOpenMore = vi.fn();
    const items = [
      { id: "dashboard", label: "Accueil", icon: TestIcon },
      { id: "planning", label: "Planning", icon: TestIcon },
      { id: "athletes", label: "Athlètes", icon: TestIcon },
      { id: "messaging", label: "Messages", icon: TestIcon, badge: 3 },
    ];

    render(
      <MobileBottomNav
        ariaLabel="Navigation coach"
        items={items}
        activeId="planning"
        onSelect={onSelect}
        more={{
          label: "Plus",
          icon: TestIcon,
          badge: 2,
          active: false,
          expanded: false,
          onSelect: onOpenMore,
        }}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "Navigation coach" });
    expect(within(navigation).getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Planning" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Messages, 3 non lus" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Plus, 2 alertes non lues" })).toBeTruthy();

    items.forEach((item) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${item.label}`) })));
    expect(onSelect.mock.calls.map(([id]) => id)).toEqual(items.map((item) => item.id));

    fireEvent.click(screen.getByRole("button", { name: /^Plus/ }));
    expect(onOpenMore).toHaveBeenCalledOnce();
  });
});

describe("MobileMoreSheet", () => {
  it("rend les cinq liens secondaires, leur compteur et chaque action", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const items = COACH_MOBILE_MORE_ITEMS.map((item) => ({
      ...item,
      icon: TestIcon,
      badge: item.id === "alerts" ? 4 : 0,
    }));

    render(
      <MobileMoreSheet
        items={items}
        activeId="charge"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Plus" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Charge" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Alertes, 4 non lues" })).toBeTruthy();

    items.forEach((item) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${item.label}`) })));
    expect(onSelect.mock.calls.map(([id]) => id)).toEqual(items.map((item) => item.id));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
