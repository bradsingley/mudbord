/**
 * Images Module
 * Handles image upload, positioning, and management on boards
 */

console.log('=== images.js loaded ===');

/**
 * Get all images for a board
 * @param {string} boardId - Board UUID
 * @returns {Promise<Array>}
 */
async function getBoardImages(boardId) {
    const { data, error } = await supabaseClient
        .from(TABLES.IMAGES)
        .select(`
            id,
            storage_path,
            position_x,
            position_y,
            z_index,
            width,
            height,
            uploaded_by,
            created_at
        `)
        .eq('board_id', boardId)
        .order('z_index', { ascending: true });
    
    if (error) {
        console.error('Error fetching images:', error);
        return [];
    }
    
    // Get uploader display names
    const imagesWithUploaders = await Promise.all(
        data.map(async (img) => {
            let uploaderName = 'Anonymous';
            if (img.uploaded_by) {
                const profile = await getUserProfile(img.uploaded_by);
                uploaderName = profile?.display_name || 'Anonymous';
            }
            
            return {
                ...img,
                url: getImageUrl(img.storage_path),
                uploaderName
            };
        })
    );
    
    return imagesWithUploaders;
}

/**
 * Upload images to a board
 * @param {string} boardId - Board UUID
 * @param {FileList|Array<File>} files - Files to upload
 * @returns {Promise<Array>} - Array of created image records
 */
async function uploadImages(boardId, files) {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('Must be logged in to upload images');
    }
    
    const uploadedImages = [];
    
    for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            console.warn(`Skipping non-image file: ${file.name}`);
            continue;
        }
        
        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            console.warn(`File too large: ${file.name}`);
            continue;
        }
        
        // Generate unique filename
        const ext = file.name.split('.').pop();
        const filename = `${user.id}/${boardId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(filename, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
        }
        
        // Calculate position centered on canvas, with spacing for multiple images
        const canvasCenter = 10000; // Canvas is 20000x20000, center is 10000
        const spacing = 320; // Space between images
        const uploadIndex = uploadedImages.length;
        const cols = Math.ceil(Math.sqrt(files.length));
        const row = Math.floor(uploadIndex / cols);
        const col = uploadIndex % cols;
        const offsetX = (col - (cols - 1) / 2) * spacing;
        const offsetY = (row - (Math.ceil(files.length / cols) - 1) / 2) * spacing;
        const posX = canvasCenter + offsetX - 150; // -150 to center the ~300px image
        const posY = canvasCenter + offsetY - 150;
        
        // Create database record
        const { data: imageData, error: dbError } = await supabaseClient
            .from(TABLES.IMAGES)
            .insert({
                board_id: boardId,
                uploaded_by: user.id,
                storage_path: uploadData.path,
                position_x: posX,
                position_y: posY,
                z_index: Date.now() % 10000 // Simple z-index based on time
            })
            .select()
            .single();
        
        if (dbError) {
            console.error('Database error:', dbError);
            continue;
        }
        
        uploadedImages.push({
            ...imageData,
            url: getImageUrl(uploadData.path)
        });
    }
    
    return uploadedImages;
}

/**
 * Update image position
 * @param {string} imageId - Image UUID
 * @param {number} x - New X position
 * @param {number} y - New Y position
 * @param {number} zIndex - Optional new z-index
 * @returns {Promise<{error: object}>}
 */
async function updateImagePosition(imageId, x, y, zIndex = null) {
    const updateData = {
        position_x: x,
        position_y: y
    };
    
    if (zIndex !== null) {
        updateData.z_index = zIndex;
    }
    
    const { error } = await supabaseClient
        .from(TABLES.IMAGES)
        .update(updateData)
        .eq('id', imageId);
    
    return { error };
}

/**
 * Update image size
 * @param {string} imageId - Image UUID
 * @param {number} width - New width
 * @param {number} height - New height
 * @returns {Promise<{error: object}>}
 */
async function updateImageSize(imageId, width, height) {
    console.log('updateImageSize called with:', { imageId, width, height });
    
    const { data, error } = await supabaseClient
        .from(TABLES.IMAGES)
        .update({
            width: width,
            height: height
        })
        .eq('id', imageId)
        .select();
    
    console.log('updateImageSize result:', { data, error });
    
    return { error };
}

/**
 * Delete an image
 * @param {string} imageId - Image UUID
 * @param {string} storagePath - Storage path to delete
 * @returns {Promise<{error: object}>}
 */
async function deleteImage(imageId, storagePath) {
    // Delete from storage
    const { error: storageError } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);
    
    if (storageError) {
        console.error('Storage delete error:', storageError);
    }
    
    // Delete from database
    const { error } = await supabaseClient
        .from(TABLES.IMAGES)
        .delete()
        .eq('id', imageId);
    
    return { error };
}

/**
 * Create a draggable image element
 * @param {object} imageData - Image data object
 * @param {boolean} canDelete - Whether user can delete this image
 * @param {string} boardId - Board ID for thumbnail selection
 * @returns {HTMLElement}
 */
function createImageElement(imageData, canDelete = false, boardId = null) {
    const container = document.createElement('div');
    container.className = 'board-image';
    container.dataset.imageId = imageData.id;
    container.dataset.storagePath = imageData.storage_path;
    container.style.left = `${imageData.position_x}px`;
    container.style.top = `${imageData.position_y}px`;
    container.style.zIndex = imageData.z_index;
    
    const img = document.createElement('img');
    img.src = imageData.url;
    img.alt = 'Board image';
    img.draggable = false;
    
    // Apply saved dimensions or calculate default size
    // Only use saved dimensions if they exist and aren't the old 200x200 default
    if (imageData.width && imageData.height && !(imageData.width === 200 && imageData.height === 200)) {
        // Use saved dimensions from manual resize
        console.log('Applying saved dimensions:', imageData.width, imageData.height);
        img.style.width = `${imageData.width}px`;
        img.style.height = `${imageData.height}px`;
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        img.style.objectFit = 'cover';
    } else {
        console.log('No saved dimensions, using default for image:', imageData.id);
        // Set default size: long edge = 300px (only on initial load)
        img.onload = () => {
            const naturalW = img.naturalWidth;
            const naturalH = img.naturalHeight;
            const maxEdge = 300;
            
            if (naturalW >= naturalH) {
                img.style.width = `${maxEdge}px`;
                img.style.height = `${Math.round((naturalH / naturalW) * maxEdge)}px`;
            } else {
                img.style.height = `${maxEdge}px`;
                img.style.width = `${Math.round((naturalW / naturalH) * maxEdge)}px`;
            }
        };
    }
    
    const info = document.createElement('div');
    info.className = 'board-image__info';
    info.textContent = `Uploaded by ${escapeHtml(imageData.uploaderName)}`;
    
    container.appendChild(img);
    container.appendChild(info);
    
    console.log('createImageElement - canDelete:', canDelete, 'boardId:', boardId);
    
    if (canDelete) {
        // Thumbnail button
        if (boardId) {
            const thumbBtn = document.createElement('button');
            thumbBtn.className = 'board-image__thumbnail';
            thumbBtn.innerHTML = '★';
            thumbBtn.title = 'Set as board thumbnail';
            thumbBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const { error } = await setBoardThumbnail(boardId, imageData.id);
                if (!error) {
                    // Visual feedback
                    document.querySelectorAll('.board-image__thumbnail--active').forEach(el => {
                        el.classList.remove('board-image__thumbnail--active');
                    });
                    thumbBtn.classList.add('board-image__thumbnail--active');
                }
            });
            container.appendChild(thumbBtn);
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'board-image__delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Delete image';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Delete this image?')) {
                await deleteImage(imageData.id, imageData.storage_path);
                container.remove();
            }
        });
        container.appendChild(deleteBtn);
        
        // Add resize handle (only for users who can edit)
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'board-image__resize';
        resizeHandle.title = 'Resize image';
        container.appendChild(resizeHandle);
    }
    
    return container;
}

/**
 * Make an element draggable within the board
 * @param {HTMLElement} element - The element to make draggable
 * @param {Function} onDrop - Callback when dragging ends
 */
function makeDraggable(element, onDrop) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    const onMouseDown = (e) => {
        // Don't drag when clicking delete or resize handles
        if (e.target.classList.contains('board-image__delete') || 
            e.target.classList.contains('board-image__resize')) return;
        
        isDragging = true;
        element.classList.add('dragging');
        
        startX = e.clientX;
        startY = e.clientY;
        initialX = element.offsetLeft;
        initialY = element.offsetTop;
        
        // Bring to front
        element.style.zIndex = Date.now() % 100000;
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    
    const onMouseMove = (e) => {
        if (!isDragging) return;
        
        // Get current zoom scale from global canvasScale (default to 1)
        const scale = typeof canvasScale !== 'undefined' ? canvasScale : 1;
        
        // Divide by scale so cursor and image move at same speed
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;
        
        element.style.left = `${initialX + dx}px`;
        element.style.top = `${initialY + dy}px`;
    };
    
    const onMouseUp = (e) => {
        if (!isDragging) return;
        
        isDragging = false;
        element.classList.remove('dragging');
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // Save new position
        const newX = element.offsetLeft;
        const newY = element.offsetTop;
        const newZ = parseInt(element.style.zIndex);
        
        if (onDrop) {
            onDrop(element.dataset.imageId, newX, newY, newZ);
        }
    };
    
    element.addEventListener('mousedown', onMouseDown);
    
    // Touch support
    element.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        onMouseDown({ clientX: touch.clientX, clientY: touch.clientY, target: e.target });
    }, { passive: true });
    
    element.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        }
    }, { passive: true });
    
    element.addEventListener('touchend', onMouseUp);
}

/**
 * Make an element resizable via corner handle
 * @param {HTMLElement} element - The element to make resizable
 */
function makeResizable(element) {
    const resizeHandle = element.querySelector('.board-image__resize');
    const img = element.querySelector('img');
    
    console.log('makeResizable called, handle found:', !!resizeHandle, 'img found:', !!img);
    
    if (!resizeHandle || !img) return;
    
    let isResizing = false;
    let startX, startY, startWidth, startHeight, aspectRatio;
    let currentWidth, currentHeight;
    
    const onResizeStart = (e) => {
        console.log('Resize started');
        e.preventDefault();
        e.stopPropagation();
        
        isResizing = true;
        element.classList.add('resizing');
        
        // Bring to front
        element.style.zIndex = Date.now() % 100000;
        
        startX = e.clientX;
        startY = e.clientY;
        startWidth = img.offsetWidth;
        startHeight = img.offsetHeight;
        aspectRatio = startWidth / startHeight;
        
        // Initialize current dimensions
        currentWidth = startWidth;
        currentHeight = startHeight;
        
        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup', onResizeEnd);
    };
    
    const onResizeMove = (e) => {
        if (!isResizing) return;
        
        // Get current zoom scale from global canvasScale (default to 1)
        const scale = typeof canvasScale !== 'undefined' ? canvasScale : 1;
        
        // Divide by scale so cursor and resize handle stay in sync
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;
        
        // Free-form resize - allow any size/aspect ratio
        currentWidth = Math.max(50, startWidth + dx);
        currentHeight = Math.max(50, startHeight + dy);
        
        // Apply new size
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        img.style.width = `${currentWidth}px`;
        img.style.height = `${currentHeight}px`;
        img.style.objectFit = 'cover'; // Crop to fill, no skewing
    };
    
    const onResizeEnd = () => {
        console.log('Resize ended, isResizing:', isResizing);
        if (!isResizing) return;
        
        isResizing = false;
        element.classList.remove('resizing');
        
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeEnd);
        
        // Save new dimensions to database
        const imageId = element.dataset.imageId;
        
        console.log('About to save - imageId:', imageId, 'currentWidth:', currentWidth, 'currentHeight:', currentHeight);
        
        if (imageId && currentWidth && currentHeight) {
            console.log('Saving image size:', imageId, currentWidth, currentHeight);
            updateImageSize(imageId, currentWidth, currentHeight).then(result => {
                if (result.error) {
                    console.error('Error saving image size:', result.error);
                } else {
                    console.log('Image size saved successfully');
                }
            });
        } else {
            console.log('Not saving - missing data');
        }
    };
    
    resizeHandle.addEventListener('mousedown', onResizeStart);
    
    // Touch support for resize
    resizeHandle.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        onResizeStart({ 
            clientX: touch.clientX, 
            clientY: touch.clientY, 
            preventDefault: () => e.preventDefault(),
            stopPropagation: () => e.stopPropagation()
        });
    });
    
    resizeHandle.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        onResizeMove({ clientX: touch.clientX, clientY: touch.clientY });
    });
    
    resizeHandle.addEventListener('touchend', onResizeEnd);
}
