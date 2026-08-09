"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const INSTALL_FLAG = "__liteposApiFetchInstalled";

function installApiFetch() {
  if (typeof window === "undefined" || window[INSTALL_FLAG]) return;

  const apiOrigin = new URL(API_URL, window.location.href).origin;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    const requestOrigin = new URL(requestUrl, window.location.href).origin;

    if (requestOrigin !== apiOrigin) {
      return nativeFetch(input, init);
    }

    const headers = new Headers(
      init.headers || (input instanceof Request ? input.headers : undefined)
    );
    const authorization = headers.get("Authorization");

    // The web client now authenticates with an HttpOnly session cookie. Older
    // pages still construct `Bearer null`; remove it so the API can use the
    // cookie instead of attempting to verify an invalid bearer token.
    if (/^Bearer\s+(null|undefined)?$/i.test(authorization || "")) {
      headers.delete("Authorization");
    }

    return nativeFetch(input, {
      ...init,
      headers,
      credentials: "include",
    });
  };

  window[INSTALL_FLAG] = true;
}

installApiFetch();

export default function ApiClientBootstrap({ children }) {
  return children;
}
