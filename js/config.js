/**
 * lab-api client
 *
 * Replaces the previous Supabase JS SDK. All calls are cookie-authenticated
 * against api.bradsingley.com (better-auth on the same parent domain).
 */

const API_BASE = window.LAB_API_BASE || 'https://api.bradsingley.com';

/**
 * Make a JSON request to the lab-api.
 * Always sends cookies (credentials: 'include').
 *
 * @param {string} path - e.g. '/mudbord/boards'
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {object} [options.body] - Will be JSON.stringify'd
 * @returns {Promise<{data: any, error: {message: string, status: number}|null}>}
 */
async function api(path, options = {}) {
    const method = options.method || 'GET';
    const headers = { ...(options.headers || {}) };
    let body;
    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
    }

    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body,
            credentials: 'include',
            cache: 'no-store',
        });
    } catch (err) {
        return { data: null, error: { message: err.message || 'Network error', status: 0 } };
    }

    if (res.status === 204) return { data: null, error: null };

    let json = null;
    try {
        json = await res.json();
    } catch {
        // No JSON body
    }

    if (!res.ok) {
        const msg = json?.message || json?.error || `Request failed (${res.status})`;
        return { data: null, error: { message: msg, status: res.status } };
    }

    return { data: json, error: null };
}
