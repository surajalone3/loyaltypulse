/**
 * Waits for App Bridge to be ready, then returns a session token for API calls.
 */
export async function getSessionToken(app) {
  if (app?.ready) {
    await app.ready;
  }

  const token = await app.idToken();

  if (!token) {
    throw new Error("App Bridge did not return a session token");
  }

  return token;
}

/**
 * Authenticated fetch using App Bridge session token.
 * In dev, requests are proxied to the Express backend via Vite.
 */
export async function fetchWithSession(app, path, options = {}) {
  const token = await getSessionToken(app);

  const { body, headers: optionHeaders, ...fetchOptions } = options;

  const response = await fetch(path, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...optionHeaders,
    },
    body:
      body !== undefined
        ? typeof body === "string"
          ? body
          : JSON.stringify(body)
        : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      message = body.message ?? body.error ?? message;
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return response.json();
}
