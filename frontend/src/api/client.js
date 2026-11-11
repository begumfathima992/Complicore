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

/**
 * Core request helper. Every API module in this folder builds on this.
 * - Attaches the bearer token automatically.
 * - Parses JSON error bodies from the backend ({ error: "..." }) so pages
 *   can show the real message instead of a generic failure string.
 * - `blob: true` switches to a binary response, for report file downloads.
 */
export async function request(path, { method = 'GET', body, params, blob = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(buildUrl(path, params), {
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

  if (res.status === 401) {
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
