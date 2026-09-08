import { Children } from "react";

// Real DOM ordering, including keyboard/reader order; no CSS-only reordering.
export default function DashboardLayout({ preferences, children }) {
  const blocks = Children.toArray(children);
  return preferences.order.filter(key => !preferences.hidden.includes(key)).map(key =>
    blocks.find(child => child.props?.["data-dashboard-block"] === key) ?? null);
}
