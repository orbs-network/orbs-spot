export const DEVELOPER_PLAYGROUND_PATH = "/dev";
export const ORDER_INSPECTOR_PATH = "/dev/eip712";

export function isDeveloperPlaygroundPath(pathname: string): boolean {
  return pathname === DEVELOPER_PLAYGROUND_PATH || pathname.startsWith(`${DEVELOPER_PLAYGROUND_PATH}/`);
}

/** The playground reuses trading navigation and order pages. */
export function getTradingPathname(pathname: string): string {
  if (pathname === ORDER_INSPECTOR_PATH) return "/developers/eip712";
  if (isDeveloperPlaygroundPath(pathname)) return pathname.slice(DEVELOPER_PLAYGROUND_PATH.length) || "/";
  return pathname;
}

export function getPlaygroundHref(href: string): string {
  const url = new URL(href, "https://app.local");
  if (url.pathname === "/" || url.pathname === "/orders" || url.pathname.startsWith("/orders/")) {
    url.pathname = url.pathname === "/" ? DEVELOPER_PLAYGROUND_PATH : `${DEVELOPER_PLAYGROUND_PATH}${url.pathname}`;
  } else if (url.pathname === "/developers/eip712") {
    url.pathname = ORDER_INSPECTOR_PATH;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getMainTradingHref(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of ["dev", "mockorders", "draft"]) params.delete(key);
  return params.size ? `/?${params}` : "/";
}
