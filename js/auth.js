/**
 * Authentication Module
 * Wraps better-auth endpoints exposed by lab-api.
 *
 * Endpoints:
 *   POST /auth/sign-up/email   { email, password, name }
 *   POST /auth/sign-in/email   { email, password }
 *   POST /auth/sign-out
 *   GET  /me                   -> { user: { id, email, name } | null }
 */

// Cache the current session for the duration of a page load to avoid hammering /me.
let _userPromise = null;

/**
 * Sign up a new user
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
async function signUp(email, password, displayName) {
    _userPromise = null;
    return api('/auth/sign-up/email', {
        method: 'POST',
        body: { email, password, name: displayName || (email || '').split('@')[0] },
    });
}

/**
 * Sign in an existing user
 * @param {string} email
 * @param {string} password
 */
async function signIn(email, password) {
    _userPromise = null;
    return api('/auth/sign-in/email', {
        method: 'POST',
        body: { email, password },
    });
}

/** Sign out the current user */
async function signOut() {
    _userPromise = null;
    const result = await api('/auth/sign-out', { method: 'POST' });
    return { error: result.error };
}

/**
 * Get the current logged-in user, or null if not signed in.
 * Result is cached per page load.
 */
async function getCurrentUser() {
    if (!_userPromise) {
        _userPromise = api('/me').then(({ data, error }) => {
            if (error || !data) return null;
            return data.user || null;
        });
    }
    return _userPromise;
}

/**
 * Get the current user's display name (cached via getCurrentUser).
 */
async function getCurrentUserDisplayName() {
    const user = await getCurrentUser();
    if (!user) return null;
    return user.name || (user.email || '').split('@')[0] || 'Anonymous';
}

/**
 * Get a user profile by id. Used by images.js to label uploaders.
 * Profiles are returned by lab-api as part of the /mudbord/* responses
 * when needed; this helper falls back to a tiny lookup endpoint if you
 * need a specific user's display name and only have their id.
 */
const _profileCache = new Map();
async function getUserProfile(userId) {
    if (!userId) return null;
    if (_profileCache.has(userId)) return _profileCache.get(userId);
    // lab-api currently returns uploaderName inline on image rows where possible.
    // For a stand-alone lookup we just resolve from the current user; otherwise null.
    const me = await getCurrentUser();
    if (me && me.id === userId) {
        const profile = { id: me.id, display_name: me.name || (me.email || '').split('@')[0] };
        _profileCache.set(userId, profile);
        return profile;
    }
    _profileCache.set(userId, null);
    return null;
}

/**
 * Update the navigation based on auth state.
 * @param {HTMLElement} navElement
 */
async function updateNav(navElement) {
    if (!navElement) return;
    const user = await getCurrentUser();

    if (user) {
        const displayName = await getCurrentUserDisplayName();
        navElement.innerHTML = `
            <span class="header__user">Hi, ${escapeHtml(displayName)}</span>
            <button class="btn btn--ghost btn--sm" id="signOutBtn">Sign Out</button>
        `;
        document.getElementById('signOutBtn')?.addEventListener('click', async () => {
            await signOut();
            window.location.reload();
        });
    } else {
        navElement.innerHTML = `
            <a href="login.html" class="btn btn--ghost btn--sm">Sign In</a>
            <a href="signup.html" class="btn btn--primary btn--sm">Sign Up</a>
        `;
    }
}

/** Escape HTML to prevent XSS */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}
