const PRODUCTION_APP_URL = "https://podo360.supremetechdev.com";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLocalUrl(value: string) {
  return /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(value);
}

export function getAuthRedirectUrl() {
  const configuredUrl = String(import.meta.env.VITE_APP_URL || "").trim();
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const basePath = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

  let appUrl = configuredUrl || browserOrigin || PRODUCTION_APP_URL;

  if (import.meta.env.PROD && isLocalUrl(appUrl)) {
    appUrl = PRODUCTION_APP_URL;
  }

  return `${trimTrailingSlash(appUrl)}${basePath === "" ? "" : basePath}/`;
}
