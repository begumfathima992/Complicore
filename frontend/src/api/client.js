const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.status = status;
    // Full parsed JSON body, when there was one - lets callers read fields
    // beyond `error`, e.g. the shift-conflict endpoint's `conflicts` array.
    this.data = data;
  }
}

function getToken() {
  return localStorage.getItem('accessToken');
}

/**
 * Fires when a request 401s so the app can drop back to the login page.
 * Set by AuthContext at startup - kept outside React so the plain fetch
 * wrapper below doesn't need to import context/hook machinery.
 */
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function buildUrl(path, params) {
  const url = new URL(BASE_URL.replace(/\/$/, '') + path);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }
  return url;
}

async function rawFetch(path, { method, body, params, token }) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    return await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(
      `Could not reach the API at ${BASE_URL}. Is the backend running? (${networkErr.message})`,
      0
    );
  }
}

/**
 * The access token is short-lived (15m) by design - this is what lets a
 * routine expiry refresh silently instead of bouncing an active user back
 * to the login page. De-duped via `inFlight` so N requests that all 401 at
 * once (e.g. a page firing several loads in parallel) trigger exactly one
 * POST /auth/refresh, not N - the refresh token itself isn't rotated by
 * the backend, so re-using the same one across de-duped callers is safe.
 * Returns the new access token, or null if the refresh token is missing,
 * invalid, or itself expired (the only case that should actually log the
 * user out - see request() below).
 */
let inFlight = null;
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  if (!inFlight) {
    inFlight = rawFetch('/auth/refresh', { method: 'POST', body: { refreshToken } })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        return data && data.accessToken ? data.accessToken : null;
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * Core request helper. Every API module in this folder builds on this.
 * - Attaches the bearer token automatically.
 * - On a 401, tries exactly one silent refresh-and-retry before giving up -
 *   only a refresh-token failure (missing/invalid/expired, or the retried
 *   request 401-ing again) triggers onUnauthorized() and the "session
 *   expired" error; a plain expired access token never reaches the user.
 * - Parses JSON error bodies from the backend ({ error: "..." }) so pages
 *   can show the real message instead of a generic failure string.
 * - `blob: true` switches to a binary response, for report file downloads.
 */
export async function request(path, { method = 'GET', body, params, blob = false } = {}, _retried = false) {
  const res = await rawFetch(path, { method, body, params, token: getToken() });

  if (res.status === 401) {
    if (!_retried) {
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        localStorage.setItem('accessToken', newAccessToken);
        return request(path, { method, body, params, blob }, true);
      }
    }
    onUnauthorized();
    throw new ApiError('Your session has expired. Please log in again.', 401);
  }

  if (blob) {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError(text || `Request failed (${res.status})`, res.status);
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    return { blob: await res.blob(), filename: match ? match[1] : 'download' };
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const message = isJson && data && data.error ? data.error : typeof data === 'string' && data ? data : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, isJson ? data : null);
  }

  return data;
}

export const api = {
  get: (path, params) => request(path, { method: 'GET', params }),
  post: (path, body, params) => request(path, { method: 'POST', body, params }),
  patch: (path, body, params) => request(path, { method: 'PATCH', body, params }),
  delete: (path, params) => request(path, { method: 'DELETE', params }),
  download: (path, params) => request(path, { method: 'GET', params, blob: true }),
};

/**
 * PUTs a file directly to a pre-signed storage URL (R2/S3) - deliberately
 * NOT routed through request() above, since this targets a completely
 * different host than our own API and must not carry our bearer token;
 * the pre-signed URL itself is the only auth it needs.
 */
export async function uploadToPresignedUrl(uploadUrl, file, contentType) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(`Upload to storage failed (${res.status})${text ? `: ${text}` : ''}`, res.status);
  }
}
