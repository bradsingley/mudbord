/**
 * Boards Module
 * Handles CRUD operations for moodboards
 */

/**
 * Get all boards with thumbnail image
 * @returns {Promise<Array>}
 */
async function getAllBoards() {
    // Get all boards
    const { data: boards, error } = await supabaseClient
        .from(TABLES.BOARDS)
        .select(`
            id,
            name,
            created_at,
            created_by,
            thumbnail_image_id
        `)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching boards:', error);
        return [];
    }
    
    // For each board, get the thumbnail image (selected or first available)
    const boardsWithThumbnails = await Promise.all(
        boards.map(async (board) => {
            let thumbnailUrl = null;
            
            // If a thumbnail is set, use that
            if (board.thumbnail_image_id) {
                const { data: thumbImage } = await supabaseClient
                    .from(TABLES.IMAGES)
                    .select('storage_path')
                    .eq('id', board.thumbnail_image_id)
                    .single();
                
                if (thumbImage) {
                    thumbnailUrl = getImageUrl(thumbImage.storage_path);
                }
            }
            
            // Fallback to first image if no thumbnail set
            if (!thumbnailUrl) {
                const { data: images } = await supabaseClient
                    .from(TABLES.IMAGES)
                    .select('storage_path')
                    .eq('board_id', board.id)
                    .limit(1);
                
                if (images && images.length > 0) {
                    thumbnailUrl = getImageUrl(images[0].storage_path);
                }
            }
            
            return {
                ...board,
                thumbnailUrl
            };
        })
    );
    
    return boardsWithThumbnails;
}

/**
 * Get a single board by ID
 * @param {string} boardId - Board UUID
 * @returns {Promise<object|null>}
 */
async function getBoardById(boardId) {
    const { data, error } = await supabaseClient
        .from(TABLES.BOARDS)
        .select('*')
        .eq('id', boardId)
        .single();
    
    if (error) {
        console.error('Error fetching board:', error);
        return null;
    }
    
    return data;
}

/**
 * Create a new board
 * @param {string} name - Board name
 * @returns {Promise<{data: object, error: object}>}
 */
async function createBoard(name) {
    const user = await getCurrentUser();
    if (!user) {
        return { data: null, error: { message: 'Must be logged in to create a board' } };
    }
    
    const { data, error } = await supabaseClient
        .from(TABLES.BOARDS)
        .insert({
            name,
            created_by: user.id
        })
        .select()
        .single();
    
    return { data, error };
}

/**
 * Rename a board
 * @param {string} boardId - Board UUID
 * @param {string} newName - New board name
 * @returns {Promise<{data: object, error: object}>}
 */
async function renameBoard(boardId, newName) {
    const { data, error } = await supabaseClient
        .from(TABLES.BOARDS)
        .update({ name: newName })
        .eq('id', boardId)
        .select()
        .single();
    
    return { data, error };
}

/**
 * Set the thumbnail image for a board
 * @param {string} boardId - Board UUID
 * @param {string} imageId - Image UUID to use as thumbnail
 * @returns {Promise<{data: object, error: object}>}
 */
async function setBoardThumbnail(boardId, imageId) {
    const { data, error } = await supabaseClient
        .from(TABLES.BOARDS)
        .update({ thumbnail_image_id: imageId })
        .eq('id', boardId)
        .select()
        .single();
    
    return { data, error };
}

/**
 * Delete a board and all its images
 * @param {string} boardId - Board UUID
 * @returns {Promise<{error: object}>}
 */
async function deleteBoard(boardId) {
    // First delete all images from storage
    const { data: images } = await supabaseClient
        .from(TABLES.IMAGES)
        .select('storage_path')
        .eq('board_id', boardId);
    
    if (images && images.length > 0) {
        const paths = images.map(img => img.storage_path);
        await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .remove(paths);
    }
    
    // Delete images from database (cascade should handle this, but just in case)
    await supabaseClient
        .from(TABLES.IMAGES)
        .delete()
        .eq('board_id', boardId);
    
    // Delete the board
    const { error } = await supabaseClient
        .from(TABLES.BOARDS)
        .delete()
        .eq('id', boardId);
    
    return { error };
}

/**
 * Get public URL for a storage path
 * @param {string} storagePath - Path in storage bucket
 * @returns {string}
 */
function getImageUrl(storagePath) {
    const { data } = supabaseClient.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);
    
    return data.publicUrl;
}

/**
 * Render boards to the gallery grid
 * @param {HTMLElement} container - The grid container
 * @param {Array} boards - Array of board objects
 * @param {string|null} currentUserId - Current user's ID for showing edit/delete buttons
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
        
        // Add edit/delete buttons if user owns this board
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

/**
 * Format a date string
 * @param {string} dateStr - ISO date string
 * @returns {string}
 */
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
