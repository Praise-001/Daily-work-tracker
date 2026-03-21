// NavBar is no longer the primary nav — dashboards use their own top-bar layout.
// This component is kept as a lightweight brand bar for any standalone pages.
"use client";

export default function NavBar() {
  return (
    <nav className="nav">
      <div className="brand">
        <div className="brand-logo">R</div>
        <span>RateLog</span>
      </div>
    </nav>
  );
}
