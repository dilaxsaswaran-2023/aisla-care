const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5030/api';

// ─── Unauthorized handler ────────────────────────────────────────────────────
// AuthContext registers a forceLogout callback here so any unrecoverable 401
// clears the session and navigates to /auth — without calling any API.
let _onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: () => void) => {
    _onUnauthorized = handler;
};

// ─── Token storage helpers ───────────────────────────────────────────────────
export function getToken(): string | null {
    return localStorage.getItem('aisla_access_token');
}
export function getRefreshToken(): string | null {
    return localStorage.getItem('aisla_refresh_token');
}
export function clearTokenStorage(): void {
    localStorage.removeItem('aisla_access_token');
    localStorage.removeItem('aisla_refresh_token');
    localStorage.removeItem('aisla_user');
    localStorage.removeItem('aisla_role');
}

function authHeaders(token?: string | null): Record<string, string> {
    const t = token !== undefined ? token : getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (t) headers['Authorization'] = `Bearer ${t}`;
    return headers;
}

// ─── Raw auth POST (no refresh interceptor) ──────────────────────────────────
// Used for login, signup, refresh, logout — endpoints that should never trigger
// the silent-refresh flow.
export async function authPost(path: string, body?: unknown): Promise<unknown> {
    const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
    return data;
}

// ─── Silent token refresh ────────────────────────────────────────────────────
// All concurrent requests that hit a 401 wait for a single refresh attempt.
let _isRefreshing = false;
let _refreshQueue: Array<(newToken: string | null) => void> = [];

async function tryRefresh(): Promise<string | null> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        localStorage.setItem('aisla_access_token', data.accessToken);
        localStorage.setItem('aisla_refresh_token', data.refreshToken);
        return data.accessToken as string;
    } catch {
        return null;
    }
}

// ─── Core request helper ─────────────────────────────────────────────────────
async function handleResponse(res: Response): Promise<unknown> {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
    return data;
}

type Fetcher = (token: string | null) => Promise<Response>;

async function requestWithRefresh(fetcher: Fetcher): Promise<unknown> {
    const res = await fetcher(getToken());

    // Happy path
    if (res.status !== 401) return handleResponse(res);

    // ── 401 received — attempt a single silent token refresh ──
    if (_isRefreshing) {
        // Another request already triggered a refresh — queue this one
        return new Promise<unknown>((resolve, reject) => {
            _refreshQueue.push(async (newToken) => {
                if (!newToken) {
                    reject(new Error('Session expired. Please log in again.'));
                    return;
                }
                try {
                    resolve(handleResponse(await fetcher(newToken)));
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    _isRefreshing = true;
    const newToken = await tryRefresh();
    _isRefreshing = false;

    // Flush the queue
    const queued = _refreshQueue.splice(0);
    queued.forEach(cb => cb(newToken));

    if (!newToken) {
        // Refresh failed — force logout (no API call, just clear + redirect)
        clearTokenStorage();
        _onUnauthorized?.();
        throw new Error('Session expired. Please log in again.');
    }

    // Retry the original request with the fresh access token
    return handleResponse(await fetcher(newToken));
}

// ─── Public API client ───────────────────────────────────────────────────────
export const api = {
    get: (path: string) =>
        requestWithRefresh(token =>
            fetch(`${API_URL}${path}`, { headers: authHeaders(token) }),
        ),

    post: (path: string, body?: unknown) =>
        requestWithRefresh(token =>
            fetch(`${API_URL}${path}`, {
                method: 'POST',
                headers: authHeaders(token),
                body: body !== undefined ? JSON.stringify(body) : undefined,
            }),
        ),

    put: (path: string, body?: unknown) =>
        requestWithRefresh(token =>
            fetch(`${API_URL}${path}`, {
                method: 'PUT',
                headers: authHeaders(token),
                body: body !== undefined ? JSON.stringify(body) : undefined,
            }),
        ),

    patch: (path: string, body?: unknown) =>
        requestWithRefresh(token =>
            fetch(`${API_URL}${path}`, {
                method: 'PATCH',
                headers: authHeaders(token),
                body: body !== undefined ? JSON.stringify(body) : undefined,
            }),
        ),

    delete: (path: string) =>
        requestWithRefresh(token =>
            fetch(`${API_URL}${path}`, {
                method: 'DELETE',
                headers: authHeaders(token),
            }),
        ),

    postForm: (path: string, formData: FormData) =>
        requestWithRefresh(token => {
            // Do NOT include Content-Type — browser sets multipart boundary automatically
            const headers: Record<string, string> = {};
            const t = token ?? getToken();
            if (t) headers['Authorization'] = `Bearer ${t}`;
            return fetch(`${API_URL}${path}`, {
                method: 'POST',
                headers,
                body: formData,
            });
        }),
};

export { API_URL };
