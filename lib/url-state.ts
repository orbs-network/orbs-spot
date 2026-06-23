export function pushUrlState(href: string) {
  if (typeof window === "undefined") return;

  const nextUrl = new URL(href, window.location.href);
  if (nextUrl.href === window.location.href) return;

  const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  window.history.pushState(window.history.state, "", nextHref);
  window.dispatchEvent(
    new PopStateEvent("popstate", { state: window.history.state }),
  );
}
