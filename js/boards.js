/**
 * Boards Module
 * Handles CRUD operations for moodboards via lab-api.
 *
 * The lab-api returns camelCase fields (id, createdAt, createdBy,
 * thumbnailImageId, thumbnailUrl). We expose them as snake_case to keep
 * the rest of the frontend (which was originally Supabase-based) working.
 */

/** Convert a lab-api board record to the snake_case shape the UI expects. */
function _normalizeBoard(b) {
    if (!b) return b;
    return {
        id: b.id,
        name: b.name,
        created_at: b.createdAt,
        created_by: b.createdBy,
        thumbnail_image_id: b.thumbnailImageId,
        thumbnailUrl: b.thumbnailUrl ?? null,
    };
}

/**
 * Get all boards with thumbnail URLs.
 * @returns {Promise<Array>}
 */
async function getAllBoards() {
    const { data, error } = await api('/mudbord/boards');
    if (error) {
        console.error('Error fetching boards:', error);
        return [];
    }
    return (data?.boards || []).map(_normalizeBoard);
}

/**
 * Get a single board by ID.
 * @param {string} boardId
 * @returns {Promise<object|null>}
 */
async function getBoardById(boardId) {
    const { data, error } = await api(`/mudbord/boards/${encodeURIComponent(boardId)}`);
    if (error) {
        console.error('Error fetching board:', error);
        return null;
    }
    return _normalizeBoard(data?.board);
}

/**
 * Create a new board.
 * @param {string} name
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
async function createBoard(name) {
    const { data, error } = await api('/mudbord/boards', {
        method: 'POST',
        body: { name },
    });
    return { data: _normalizeBoard(data?.board), error };
}

/**
 * Rename a board.
 * @param {string} boardId
 * @param {string} newName
 */
async function renameBoard(boardId, newName) {
    const { data, error } = await api(`/mudbord/boards/${encodeURIComponent(boardId)}`, {
        method: 'PATCH',
        body: { name: newName },
    });
    return { data: _normalizeBoard(data?.board), error };
}

/**
 * Set a board's thumbnail image.
 * @param {string} boardId
 * @param {string} imageId
 */
async function setBoardThumbnail(boardId, imageId) {
    const { data, error } = await api(
        `/mudbord/boards/${encodeURIComponent(boardId)}/thumbnail`,
        { method: 'PUT', body: { thumbnailImageId: imageId } },
    );
    return { data: _normalizeBoard(data?.board), error };
}

/**
 * Delete a board (cascade removes images server-side).
 * @param {string} boardId
 */
async function deleteBoard(boardId) {
    const { error } = await api(`/mudbord/boards/${encodeURIComponent(boardId)}`, {
        method: 'DELETE',
    });
    return { error };
}

/**
 * Render boards to the gallery grid.
 * @param {HTMLElement} container
 * @param {Array} boards
 * @param {string|null} currentUserId
 */
function renderBoardsGrid(container, boards, currentUserId = null) {
    container.innerHTML = '';

    if (boards.length === 0) {
        container.innerHTML = '<p class="gallery__loading">No boards yet. Create the first one!</p>';
        return;
    }

    boards.forEach(board => {
        const card = document.createElement('a');
        card.className = 'board-card';
        card.href = `board.html?id=${board.id}`;
        card.dataset.boardId = board.id;
        card.dataset.boardName = board.name;

        const imageContainer = document.createElement('div');
        imageContainer.className = 'board-card__image';

        if (board.thumbnailUrl) {
            const img = document.createElement('img');
            img.src = board.thumbnailUrl;
            img.alt = board.name;
            img.loading = 'lazy';
            imageContainer.appendChild(img);
        } else {
            imageContainer.innerHTML = '<span class="board-card__placeholder">🖼️</span>';
        }

        const content = document.createElement('div');
        content.className = 'board-card__content';

        const titleRow = document.createElement('div');
        titleRow.className = 'board-card__title-row';

        const title = document.createElement('h3');
        title.className = 'board-card__title';
        title.textContent = board.name;
        titleRow.appendChild(title);

        if (currentUserId && board.created_by === currentUserId) {
            const actions = document.createElement('div');
            actions.className = 'board-card__actions';
            actions.innerHTML = `
                <button class="board-card__action" data-action="rename" title="Rename">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M10.5 1.5L12.5 3.5L4.5 11.5L1.5 12.5L2.5 9.5L10.5 1.5Z"/>
                    </svg>
                </button>
                <button class="board-card__action" data-action="delete" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M2.5 4.5H11.5L10.5 12.5H3.5L2.5 4.5Z"/>
                        <path d="M1 2.5H13"/>
                        <path d="M5 2.5V1.5H9V2.5"/>
                    </svg>
                </button>
            `;
            titleRow.appendChild(actions);
        }

        content.appendChild(titleRow);

        const meta = document.createElement('p');
        meta.className = 'board-card__meta';
        meta.textContent = `Created ${formatDate(board.created_at)}`;
        content.appendChild(meta);

        card.appendChild(imageContainer);
        card.appendChild(content);
        container.appendChild(card);
    });
}

/** Format a date string */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
}
