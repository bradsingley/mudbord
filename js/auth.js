/**
 * Authentication Module
 * Handles user signup, signin, signout, and session management
 */

/**
 * Sign up a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - User display name
 * @returns {Promise<{data: object, error: object}>}
 */
async function signUp(email, password, displayName) {
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                display_name: displayName
            }
        }
    });
    
    return { data, error };
}

/**
 * Sign in an existing user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{data: object, error: object}>}
 */
async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });
    
    return { data, error };
}

/**
 * Sign out the current user
 * @returns {Promise<{error: object}>}
 */
async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    return { error };
}

/**
 * Get the current logged-in user
 * @returns {Promise<object|null>}
 */
async function getCurrentUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

/**
 * Get the current session
 * @returns {Promise<object|null>}
 */
async function getSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

/**
 * Get user profile by ID
 * @param {string} userId - User UUID
 * @returns {Promise<object|null>}
 */
async function getUserProfile(userId) {
    const { data, error } = await supabaseClient
        .from(TABLES.PROFILES)
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
    
    return data;
}

/**
 * Get current user's display name
 * @returns {Promise<string>}
 */
async function getCurrentUserDisplayName() {
    const user = await getCurrentUser();
    if (!user) return null;
    
    // Try to get from profile first
    const profile = await getUserProfile(user.id);
    if (profile?.display_name) {
        return profile.display_name;
    }
    
    // Fall back to user metadata
    return user.user_metadata?.display_name || 'Anonymous';
}

/**
 * Update the navigation based on auth state
 * @param {HTMLElement} navElement - The navigation container element
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

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string}
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
