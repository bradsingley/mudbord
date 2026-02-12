/**
 * Board Page - Individual board view logic
 */

let currentBoard = null;
let currentUser = null;

// Canvas zoom/pan state
let canvasScale = 1;
let panX = 0;
let panY = 0;
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;

/**
 * Apply zoom and pan transforms to the board
 */
function applyTransform(board) {
    board.style.transform = `translate(${panX}px, ${panY}px) scale(${canvasScale})`;
    updateZoomIndicator();
}

document.addEventListener('DOMContentLoaded', async () => {
    // Get board ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const boardId = urlParams.get('id');
    
    if (!boardId) {
        window.location.href = 'index.html';
        return;
    }
    
    // Update navigation
    const nav = document.getElementById('nav');
    await updateNav(nav);
    
    // Get current user
    currentUser = await getCurrentUser();
    
    // Setup canvas zoom/pan first (so fitContentToView can use it)
    setupCanvasControls();
    
    // Setup arrangement controls
    setupArrangementControls();
    
    // Load board
    await loadBoard(boardId);
    
    // Setup upload functionality if logged in
    if (currentUser) {
        setupUpload(boardId);
    }
});

/**
 * Load board and its images
 * @param {string} boardId - Board UUID
 */
async function loadBoard(boardId) {
    const titleEl = document.getElementById('boardTitle');
    const boardEl = document.getElementById('board');
    const loadingEl = document.getElementById('boardLoading');
    const addImageBtn = document.getElementById('addImageBtn');
    
    // Load board details
    currentBoard = await getBoardById(boardId);
    
    if (!currentBoard) {
        titleEl.textContent = 'Board not found';
        loadingEl.textContent = 'This board does not exist.';
        return;
    }
    
    // Update title
    titleEl.textContent = currentBoard.name;
    document.title = `${currentBoard.name} - Mūdbord`;
    
    // Show add button if logged in
    if (currentUser) {
        addImageBtn.hidden = false;
        
        // Show edit controls (arrange buttons)
        document.querySelectorAll('.canvas-controls__edit-only').forEach(el => {
            el.hidden = false;
        });
        
        // Setup AI image generation
        if (typeof setupImageGeneration === 'function') {
            setupImageGeneration(boardId, currentBoard.name);
        }
    }
    
    // Load images
    const images = await getBoardImages(boardId);
    loadingEl?.remove();
    
    // Render images
    images.forEach(imageData => {
        const canDelete = currentUser && (
            imageData.uploaded_by === currentUser.id ||
            currentBoard.created_by === currentUser.id
        );
        
        const imgEl = createImageElement(imageData, canDelete, boardId);
        
        // Mark current thumbnail
        if (currentBoard.thumbnail_image_id === imageData.id) {
            const thumbBtn = imgEl.querySelector('.board-image__thumbnail');
            if (thumbBtn) thumbBtn.classList.add('board-image__thumbnail--active');
        }
        
        // Make draggable and resizable if logged in
        if (currentUser) {
            makeDraggable(imgEl, async (id, x, y, z) => {
                await updateImagePosition(id, x, y, z);
            });
            makeResizable(imgEl);
        }
        
        boardEl.appendChild(imgEl);
    });
    
    // After all images are added, fit view to show all content
    // Use setTimeout to allow images to load and get their sizes
    setTimeout(() => fitContentToView(), 100);
}

/**
 * Calculate bounding box of all content and zoom/pan to fit it in view
 */
function fitContentToView() {
    const viewport = document.getElementById('boardViewport');
    const board = document.getElementById('board');
    const images = board.querySelectorAll('.board-image');
    
    if (!viewport || !board) return;
    
    const viewportWidth = viewport.offsetWidth;
    const viewportHeight = viewport.offsetHeight;
    
    if (images.length === 0) {
        // No content - center on canvas center (10000, 10000)
        canvasScale = 1;
        panX = viewportWidth / 2 - 10000;
        panY = viewportHeight / 2 - 10000;
        applyTransform(board);
        return;
    }
    
    // Find bounding box of all images
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    images.forEach(img => {
        const x = parseFloat(img.style.left) || 0;
        const y = parseFloat(img.style.top) || 0;
        const width = img.offsetWidth || 300;
        const height = img.offsetHeight || 300;
        
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
    });
    
    // Add padding around content
    const padding = 100;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    
    // Calculate zoom to fit content in viewport
    const scaleX = viewportWidth / contentWidth;
    const scaleY = viewportHeight / contentHeight;
    const newScale = Math.min(scaleX, scaleY, MAX_SCALE);
    canvasScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    
    // Calculate pan to center content in viewport
    panX = viewportWidth / 2 - contentCenterX * canvasScale;
    panY = viewportHeight / 2 - contentCenterY * canvasScale;
    
    applyTransform(board);
}

/**
 * Setup file upload functionality
 * @param {string} boardId - Board UUID
 */
function setupUpload(boardId) {
    const addImageBtn = document.getElementById('addImageBtn');
    const fileInput = document.getElementById('fileInput');
    const uploadIndicator = document.getElementById('uploadIndicator');
    const boardEl = document.getElementById('board');
    
    // Add button click opens file picker
    addImageBtn?.addEventListener('click', () => {
        fileInput?.click();
    });
    
    // File input change
    fileInput?.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await handleUpload(boardId, e.target.files);
            e.target.value = ''; // Reset input
        }
    });
    
    // Also allow dropping on the board itself
    const viewport = document.getElementById('boardViewport');
    
    viewport?.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    viewport?.addEventListener('drop', async (e) => {
        e.preventDefault();
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            await handleUpload(boardId, files);
        }
    });
    
    /**
     * Handle file upload
     * @param {string} boardId - Board UUID
     * @param {FileList} files - Files to upload
     */
    async function handleUpload(boardId, files) {
        uploadIndicator.hidden = false;
        
        try {
            const uploadedImages = await uploadImages(boardId, files);
            
            // Add new images to the board
            uploadedImages.forEach(imageData => {
                // Add uploader name
                imageData.uploaderName = currentUser?.user_metadata?.display_name || 'Anonymous';
                
                const imgEl = createImageElement(imageData, true);
                makeDraggable(imgEl, async (id, x, y, z) => {
                    await updateImagePosition(id, x, y, z);
                });
                makeResizable(imgEl);
                boardEl.appendChild(imgEl);
            });
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error uploading images: ' + error.message);
        } finally {
            uploadIndicator.hidden = true;
        }
    }
}

/**
 * Update zoom indicator display
 */
function updateZoomIndicator() {
    const indicator = document.getElementById('zoomIndicator');
    if (indicator) {
        indicator.textContent = `${Math.round(canvasScale * 100)}%`;
    }
}

/**
 * Setup canvas zoom (pinch/scroll) and pan controls - FigJam style
 */
function setupCanvasControls() {
    const viewport = document.getElementById('boardViewport');
    const board = document.getElementById('board');
    
    if (!viewport || !board) return;
    
    // Initialize
    updateZoomIndicator();
    
    // Center the board initially
    const viewportRect = viewport.getBoundingClientRect();
    panX = viewportRect.width / 2 - 10000 * canvasScale;
    panY = viewportRect.height / 2 - 10000 * canvasScale;
    applyTransform(board);
    
    // Canvas panning state
    let isPanning = false;
    let panStartX, panStartY, startPanX, startPanY;
    
    // Mouse down starts panning (on empty areas)
    viewport.addEventListener('mousedown', (e) => {
        if (e.target === board || e.target === viewport || e.target.classList.contains('board__loading')) {
            isPanning = true;
            viewport.classList.add('panning');
            panStartX = e.clientX;
            panStartY = e.clientY;
            startPanX = panX;
            startPanY = panY;
            e.preventDefault();
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        
        panX = startPanX + (e.clientX - panStartX);
        panY = startPanY + (e.clientY - panStartY);
        applyTransform(board);
    });
    
    document.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            viewport.classList.remove('panning');
        }
    });
    
    // Wheel zoom - zoom toward cursor position
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, canvasScale * delta));
        
        if (newScale !== canvasScale) {
            const rect = viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Calculate the point on the canvas under the cursor
            const canvasX = (mouseX - panX) / canvasScale;
            const canvasY = (mouseY - panY) / canvasScale;
            
            // Update scale
            canvasScale = newScale;
            
            // Adjust pan to keep the point under cursor fixed
            panX = mouseX - canvasX * canvasScale;
            panY = mouseY - canvasY * canvasScale;
            
            applyTransform(board);
        }
    }, { passive: false });
    
    // Pinch-to-zoom for touch devices
    let lastTouchDistance = 0;
    let lastTouchCenter = { x: 0, y: 0 };
    
    viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            lastTouchDistance = getTouchDistance(e.touches);
            lastTouchCenter = getTouchCenter(e.touches, viewport);
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            if (e.target === board || e.target === viewport) {
                isPanning = true;
                panStartX = touch.clientX;
                panStartY = touch.clientY;
                startPanX = panX;
                startPanY = panY;
            }
        }
    }, { passive: false });
    
    viewport.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            
            const distance = getTouchDistance(e.touches);
            const center = getTouchCenter(e.touches, viewport);
            
            if (lastTouchDistance > 0) {
                const delta = distance / lastTouchDistance;
                const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, canvasScale * delta));
                
                if (newScale !== canvasScale) {
                    // Calculate the point on the canvas at pinch center
                    const canvasX = (center.x - panX) / canvasScale;
                    const canvasY = (center.y - panY) / canvasScale;
                    
                    // Update scale
                    canvasScale = newScale;
                    
                    // Adjust pan to keep pinch center fixed
                    panX = center.x - canvasX * canvasScale;
                    panY = center.y - canvasY * canvasScale;
                    
                    applyTransform(board);
                }
            }
            
            lastTouchDistance = distance;
            lastTouchCenter = center;
        } else if (e.touches.length === 1 && isPanning) {
            const touch = e.touches[0];
            panX = startPanX + (touch.clientX - panStartX);
            panY = startPanY + (touch.clientY - panStartY);
            applyTransform(board);
        }
    }, { passive: false });
    
    viewport.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            lastTouchDistance = 0;
        }
        if (e.touches.length === 0) {
            isPanning = false;
        }
    });
}

/**
 * Get distance between two touch points
 */
function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get center point between two touches relative to viewport
 */
function getTouchCenter(touches, viewport) {
    const rect = viewport.getBoundingClientRect();
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
        y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
    };
}

/**
 * Setup arrangement controls
 */
function setupArrangementControls() {
    const gridBtn = document.getElementById('arrangeGridBtn');
    const mosaicBtn = document.getElementById('arrangeMosaicBtn');
    
    gridBtn?.addEventListener('click', arrangeInGrid);
    mosaicBtn?.addEventListener('click', arrangeInMosaic);
}

/**
 * Arrange all images in a uniform grid
 */
async function arrangeInGrid() {
    const board = document.getElementById('board');
    const images = board.querySelectorAll('.board-image');
    
    if (images.length === 0) return;
    
    const canvasCenter = 10000;
    const gap = 20;
    const cols = Math.ceil(Math.sqrt(images.length));
    
    // Get max dimensions for uniform cells
    let maxWidth = 0;
    let maxHeight = 0;
    
    images.forEach(container => {
        const img = container.querySelector('img');
        if (img) {
            maxWidth = Math.max(maxWidth, img.offsetWidth);
            maxHeight = Math.max(maxHeight, img.offsetHeight);
        }
    });
    
    const cellWidth = maxWidth + gap;
    const cellHeight = maxHeight + gap;
    
    // Calculate grid start position (centered)
    const gridWidth = cols * cellWidth;
    const rows = Math.ceil(images.length / cols);
    const gridHeight = rows * cellHeight;
    const startX = canvasCenter - gridWidth / 2;
    const startY = canvasCenter - gridHeight / 2;
    
    // Position each image
    images.forEach((container, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = startX + col * cellWidth;
        const y = startY + row * cellHeight;
        
        container.style.left = `${x}px`;
        container.style.top = `${y}px`;
        
        // Save to database
        updateImagePosition(container.dataset.imageId, x, y);
    });
    
    // Fit view to content
    setTimeout(fitContentToView, 100);
}

/**
 * Arrange images in a tight organic mosaic (gravity-based packing)
 */
async function arrangeInMosaic() {
    const board = document.getElementById('board');
    const images = Array.from(board.querySelectorAll('.board-image'));
    
    if (images.length === 0) return;
    
    const canvasCenter = 10000;
    const gap = 8;
    
    // Get image dimensions and sort by area (largest first)
    const imageData = images.map(container => {
        const img = container.querySelector('img');
        return {
            container,
            width: (img?.offsetWidth || 200) + gap,
            height: (img?.offsetHeight || 200) + gap
        };
    }).sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    // Placed rectangles for collision detection
    const placed = [];
    
    // Place first image at center
    imageData[0].x = 0;
    imageData[0].y = 0;
    placed.push(imageData[0]);
    
    // For each remaining image, find the best position
    for (let i = 1; i < imageData.length; i++) {
        const item = imageData[i];
        let bestPos = null;
        let bestScore = Infinity;
        
        // Try positions around each placed image (all 4 sides)
        for (const ref of placed) {
            const candidates = [
                // Right of reference
                { x: ref.x + ref.width, y: ref.y },
                // Below reference
                { x: ref.x, y: ref.y + ref.height },
                // Left of reference
                { x: ref.x - item.width, y: ref.y },
                // Above reference
                { x: ref.x, y: ref.y - item.height },
                // Align bottom edges
                { x: ref.x + ref.width, y: ref.y + ref.height - item.height },
                // Align right edges
                { x: ref.x + ref.width - item.width, y: ref.y + ref.height },
            ];
            
            for (const pos of candidates) {
                // Check for collisions
                const collides = placed.some(p => 
                    pos.x < p.x + p.width &&
                    pos.x + item.width > p.x &&
                    pos.y < p.y + p.height &&
                    pos.y + item.height > p.y
                );
                
                if (!collides) {
                    // Score: prefer positions closer to center, more compact
                    const centerDist = Math.sqrt(
                        Math.pow(pos.x + item.width / 2, 2) + 
                        Math.pow(pos.y + item.height / 2, 2)
                    );
                    const score = centerDist;
                    
                    if (score < bestScore) {
                        bestScore = score;
                        bestPos = pos;
                    }
                }
            }
        }
        
        // Fallback: place below everything
        if (!bestPos) {
            const maxY = Math.max(...placed.map(p => p.y + p.height));
            bestPos = { x: 0, y: maxY };
        }
        
        item.x = bestPos.x;
        item.y = bestPos.y;
        placed.push(item);
    }
    
    // Calculate bounds and center offset
    const minX = Math.min(...placed.map(p => p.x));
    const minY = Math.min(...placed.map(p => p.y));
    const maxX = Math.max(...placed.map(p => p.x + p.width));
    const maxY = Math.max(...placed.map(p => p.y + p.height));
    
    const totalWidth = maxX - minX;
    const totalHeight = maxY - minY;
    const offsetX = canvasCenter - totalWidth / 2 - minX;
    const offsetY = canvasCenter - totalHeight / 2 - minY;
    
    // Apply positions
    imageData.forEach(item => {
        const x = Math.round(offsetX + item.x);
        const y = Math.round(offsetY + item.y);
        
        item.container.style.left = `${x}px`;
        item.container.style.top = `${y}px`;
        
        // Save to database
        updateImagePosition(item.container.dataset.imageId, x, y);
    });
    
    // Fit view to content
    setTimeout(fitContentToView, 100);
}
