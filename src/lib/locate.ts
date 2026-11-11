/** Scroll to an element on the page, move focus to it, and mark it briefly so the eye can find it. */
export function locate(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  el.classList.remove("is-located");
  // Force a reflow so the marker replays when the same result is chosen twice.
  void el.offsetWidth;
  el.classList.add("is-located");
  window.setTimeout(() => el.classList.remove("is-located"), 1700);
}
