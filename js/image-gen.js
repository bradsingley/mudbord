/**
 * Image Generation Module
 * Handles AI image generation via Azure OpenAI through Supabase Edge Function
 */

console.log('=== image-gen.js loaded ===');

// Edge function URL
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ai-image-gen`;

/**
 * Generate an AI image
 * @param {string} prompt - The image prompt
 * @param {string} boardName - The board name for context
 * @param {string} size - Image size (1024x1024, 1536x1024, 1024x1536)
 * @returns {Promise<{imageBase64: string, error?: string}>}
 */
async function generateAIImage(prompt, boardName, size = '1024x1024') {
    console.log('Generating AI image:', { prompt: prompt.substring(0, 50) + '...', boardName, size });
    
    try {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                boardName,
                size,
                quality: 'high',
                output_format: 'png',  // lowercase required by Azure
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Image generation failed:', result);
            throw new Error(result.error || 'Image generation failed');
        }

        // Azure returns { created, data: [{ b64_json }] }
        if (result.data && result.data[0] && result.data[0].b64_json) {
            return { imageBase64: result.data[0].b64_json };
        }

        throw new Error('Invalid response format from image generation API');
    } catch (error) {
        console.error('generateAIImage error:', error);
        return { error: error.message || 'Failed to generate image' };
    }
}

/**
 * Convert base64 to a File object for upload
 * @param {string} base64 - Base64 encoded image data
 * @param {string} filename - Desired filename
 * @returns {File}
 */
function base64ToFile(base64, filename) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    return new File([blob], filename, { type: 'image/png' });
}

/**
 * Setup image generation UI and handlers
 * @param {string} boardId - Current board ID
 * @param {string} boardName - Current board name
 */
function setupImageGeneration(boardId, boardName) {
    const generateBtn = document.getElementById('generateImageBtn');
    const modal = document.getElementById('generateModal');
    const overlay = document.getElementById('generateModalOverlay');
    const form = document.getElementById('generateForm');
    const promptInput = document.getElementById('promptInput');
    const aspectRatioSelect = document.getElementById('aspectRatioSelect');
    const cancelBtn = document.getElementById('cancelGenerateBtn');
    const submitBtn = document.getElementById('submitGenerateBtn');
    const errorEl = document.getElementById('generateError');
    const loadingEl = document.getElementById('generateLoading');
    const boardEl = document.getElementById('board');

    if (!generateBtn || !modal) {
        console.warn('Image generation elements not found');
        return;
    }

    // Show the generate button
    generateBtn.hidden = false;

    // Open modal
    generateBtn.addEventListener('click', () => {
        modal.hidden = false;
        promptInput.focus();
        errorEl.hidden = true;
    });

    // Close modal handlers
    const closeModal = () => {
        modal.hidden = true;
        form.reset();
        errorEl.hidden = true;
        loadingEl.hidden = true;
        form.style.display = '';
    };

    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const prompt = promptInput.value.trim();
        const size = aspectRatioSelect.value;

        if (!prompt) {
            errorEl.textContent = 'Please enter a prompt';
            errorEl.hidden = false;
            return;
        }

        // Show loading state
        errorEl.hidden = true;
        form.style.display = 'none';
        loadingEl.hidden = false;

        try {
            // Generate the image
            const { imageBase64, error } = await generateAIImage(prompt, boardName, size);

            if (error) {
                throw new Error(error);
            }

            // Convert to file and upload to storage
            const timestamp = Date.now();
            const filename = `ai-generated-${timestamp}.png`;
            const file = base64ToFile(imageBase64, filename);

            // Upload using existing upload function
            const uploadedImages = await uploadImages(boardId, [file]);

            // Add new images to the board
            uploadedImages.forEach(imageData => {
                imageData.uploaderName = currentUser?.user_metadata?.display_name || 'AI Generated';
                
                const imgEl = createImageElement(imageData, true, boardId);
                makeDraggable(imgEl, async (id, x, y, z) => {
                    await updateImagePosition(id, x, y, z);
                });
                makeResizable(imgEl);
                boardEl.appendChild(imgEl);
            });

            // Close modal on success
            closeModal();

        } catch (error) {
            console.error('Generation error:', error);
            loadingEl.hidden = true;
            form.style.display = '';
            errorEl.textContent = error.message || 'Failed to generate image. Please try again.';
            errorEl.hidden = false;
        }
    });
}
