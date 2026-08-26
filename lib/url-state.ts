type SearchParamsSnapshot = {
  toString: () => string;
};

export function pushUrlState(href: string): void {
  if (typeof window === "undefined") return;

  const nextUrl = new URL(href, window.location.href);
  if (nextUrl.href === window.location.href) return;

  const nextHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  window.history.pushState(window.history.state, "", nextHref);
  window.dispatchEvent(
    new PopStateEvent("popstate", { state: window.history.state }),
  );
}

export function updateUrlSearchParams(
  pathname: string,
  searchParams: SearchParamsSnapshot,
  update: (params: URLSearchParams) => void,
): void {
  const nextParams = new URLSearchParams(searchParams.toString());
  update(nextParams);

  const queryString = nextParams.toString();
  const hash = typeof window === "undefined" ? "" : window.location.hash;
  const href = `${pathname}${queryString ? `?${queryString}` : ""}${hash}`;

  pushUrlState(href);
}
