/**
 * App.js - Main application logic for the homepage
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Update navigation based on auth state
    const nav = document.getElementById('nav');
    await updateNav(nav);
    
    // Get current user
    currentUser = await getCurrentUser();
    
    // Load and display boards
    await loadBoards();
    
    // Setup create board functionality
    setupCreateBoard();
    
    // Setup board actions (rename/delete)
    setupBoardActions();
});

/**
 * Load and render all boards
 */
async function loadBoards() {
    const grid = document.getElementById('boardsGrid');
    const loading = document.getElementById('loadingIndicator');
    
    try {
        const boards = await getAllBoards();
        loading?.remove();
        renderBoardsGrid(grid, boards, currentUser?.id);
    } catch (error) {
        console.error('Error loading boards:', error);
        if (loading) {
            loading.textContent = 'Error loading boards. Please refresh.';
        }
    }
}

/**
 * Setup create board modal and form
 */
function setupCreateBoard() {
    const createBtn = document.getElementById('createBoardBtn');
    const createModal = document.getElementById('createBoardModal');
    const authModal = document.getElementById('authRequiredModal');
    const cancelBtn = document.getElementById('cancelCreateBtn');
    const closeAuthBtn = document.getElementById('closeAuthModal');
    const createForm = document.getElementById('createBoardForm');
    
    // Create board button click
    createBtn?.addEventListener('click', async () => {
        const user = await getCurrentUser();
        
        if (user) {
            createModal.hidden = false;
            document.getElementById('boardName')?.focus();
        } else {
            authModal.hidden = false;
        }
    });
    
    // Cancel buttons
    cancelBtn?.addEventListener('click', () => {
        createModal.hidden = true;
    });
    
    closeAuthBtn?.addEventListener('click', () => {
        authModal.hidden = true;
    });
    
    // Close modals on overlay click
    document.querySelectorAll('.modal__overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            createModal.hidden = true;
            authModal.hidden = true;
        });
    });
    
    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            createModal.hidden = true;
            authModal.hidden = true;
        }
    });
    
    // Form submission
    createForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById('boardName');
        const name = nameInput.value.trim();
        
        if (!name) return;
        
        const { data, error } = await createBoard(name);
        
        if (error) {
            alert('Error creating board: ' + error.message);
            return;
        }
        
        // Redirect to the new board
        window.location.href = `board.html?id=${data.id}`;
    });
}

/**
 * Setup rename and delete board functionality
 */
function setupBoardActions() {
    const grid = document.getElementById('boardsGrid');
    const renameModal = document.getElementById('renameBoardModal');
    const deleteModal = document.getElementById('deleteBoardModal');
    const renameForm = document.getElementById('renameBoardForm');
    const newNameInput = document.getElementById('newBoardName');
    const cancelRenameBtn = document.getElementById('cancelRenameBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    let selectedBoardId = null;
    let selectedBoardCard = null;
    
    // Event delegation for action buttons
    grid?.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.board-card__action');
        if (!actionBtn) return;
        
        // Prevent the link navigation
        e.preventDefault();
        e.stopPropagation();
        
        const card = actionBtn.closest('.board-card');
        selectedBoardId = card.dataset.boardId;
        selectedBoardCard = card;
        const boardName = card.dataset.boardName;
        const action = actionBtn.dataset.action;
        
        if (action === 'rename') {
            newNameInput.value = boardName;
            renameModal.hidden = false;
            newNameInput.focus();
            newNameInput.select();
        } else if (action === 'delete') {
            deleteModal.hidden = false;
        }
    });
    
    // Close rename modal
    cancelRenameBtn?.addEventListener('click', () => {
        renameModal.hidden = true;
        selectedBoardId = null;
    });
    
    renameModal?.querySelector('.modal__overlay')?.addEventListener('click', () => {
        renameModal.hidden = true;
        selectedBoardId = null;
    });
    
    // Submit rename
    renameForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = newNameInput.value.trim();
        
        if (!newName || !selectedBoardId) return;
        
        const { data, error } = await renameBoard(selectedBoardId, newName);
        
        if (error) {
            alert('Error renaming board: ' + error.message);
            return;
        }
        
        // Update UI
        if (selectedBoardCard) {
            selectedBoardCard.dataset.boardName = newName;
            const titleEl = selectedBoardCard.querySelector('.board-card__title');
            if (titleEl) titleEl.textContent = newName;
        }
        
        renameModal.hidden = true;
        selectedBoardId = null;
        selectedBoardCard = null;
    });
    
    // Close delete modal
    cancelDeleteBtn?.addEventListener('click', () => {
        deleteModal.hidden = true;
        selectedBoardId = null;
    });
    
    deleteModal?.querySelector('.modal__overlay')?.addEventListener('click', () => {
        deleteModal.hidden = true;
        selectedBoardId = null;
    });
    
    // Confirm delete
    confirmDeleteBtn?.addEventListener('click', async () => {
        if (!selectedBoardId) return;
        
        confirmDeleteBtn.textContent = 'Deleting...';
        confirmDeleteBtn.disabled = true;
        
        const { error } = await deleteBoard(selectedBoardId);
        
        if (error) {
            alert('Error deleting board: ' + error.message);
            confirmDeleteBtn.textContent = 'Delete';
            confirmDeleteBtn.disabled = false;
            return;
        }
        
        // Remove card from UI
        selectedBoardCard?.remove();
        
        deleteModal.hidden = true;
        confirmDeleteBtn.textContent = 'Delete';
        confirmDeleteBtn.disabled = false;
        selectedBoardId = null;
        selectedBoardCard = null;
    });
    
    // Close modals on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            renameModal.hidden = true;
            deleteModal.hidden = true;
            selectedBoardId = null;
            selectedBoardCard = null;
        }
    });
}
