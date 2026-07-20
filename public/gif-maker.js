// gif-maker.js - Handles drawing a selection and generating a GIF using html2canvas and gifshot

let isGifMode = false;
let startX = 0, startY = 0;
let selBox = { left: 0, top: 0, width: 0, height: 0 };
let isDrawing = false;

// Inject GIF UI into the body
const gifUiHtml = `
<div id="gif-overlay" style="display: none;">
    <div id="gif-instruction" class="glass-panel">Click and drag to select an area for the GIF</div>
    <div id="gif-selection"></div>
    <button id="gif-save-btn" class="glass-panel">Save GIF</button>
</div>
<div id="gif-loading" class="glass-panel" style="display: none;">
    <h3>Generating GIF...</h3>
    <p>Please wait, this might take a minute.</p>
    <div class="progress-bar"><div id="gif-progress"></div></div>
</div>
`;
document.body.insertAdjacentHTML('beforeend', gifUiHtml);

const gifBtn = document.getElementById('btn-gif');
const gifOverlay = document.getElementById('gif-overlay');
const gifSelection = document.getElementById('gif-selection');
const gifSaveBtn = document.getElementById('gif-save-btn');
const gifLoading = document.getElementById('gif-loading');
const gifProgress = document.getElementById('gif-progress');
const mapEl = document.getElementById('map');

// Toggle GIF Mode function
function toggleGifMode() {
    isGifMode = !isGifMode;
    if (isGifMode) {
        gifOverlay.style.display = 'block';
        gifSelection.style.display = 'none';
        gifSaveBtn.style.display = 'none';
        gifBtn.style.background = 'var(--accent-color)';
    } else {
        gifOverlay.style.display = 'none';
        gifBtn.style.background = '';
    }
}

// Toggle on button click
gifBtn.addEventListener('click', toggleGifMode);

// Exit on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isGifMode) {
        toggleGifMode();
    }
});

// Drawing logic
gifOverlay.addEventListener('mousedown', (e) => {
    if (e.target === gifSaveBtn) return;
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    gifSelection.style.display = 'block';
    gifSelection.style.left = startX + 'px';
    gifSelection.style.top = startY + 'px';
    gifSelection.style.width = '0px';
    gifSelection.style.height = '0px';
    gifSaveBtn.style.display = 'none';
});

gifOverlay.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    selBox.left = Math.min(startX, currentX);
    selBox.top = Math.min(startY, currentY);
    selBox.width = Math.abs(currentX - startX);
    selBox.height = Math.abs(currentY - startY);
    
    gifSelection.style.left = selBox.left + 'px';
    gifSelection.style.top = selBox.top + 'px';
    gifSelection.style.width = selBox.width + 'px';
    gifSelection.style.height = selBox.height + 'px';
});

gifOverlay.addEventListener('mouseup', () => {
    if (!isDrawing) return;
    isDrawing = false;
    
    if (selBox.width > 50 && selBox.height > 50) {
        gifSaveBtn.style.display = 'block';
        gifSaveBtn.style.left = selBox.left + 'px';
        gifSaveBtn.style.top = (selBox.top + selBox.height + 10) + 'px';
    } else {
        gifSelection.style.display = 'none';
    }
});

// Utility to pause execution
const delay = ms => new Promise(res => setTimeout(res, ms));

// Generate GIF
gifSaveBtn.addEventListener('click', async () => {
    gifOverlay.style.display = 'none';
    gifLoading.style.display = 'flex';
    gifProgress.style.width = '0%';
    isGifMode = false;
    gifBtn.style.background = '';
    
    // Remember current step to restore later
    const originalStep = currentStep;
    
    // Pause animation if playing
    if (isPlaying) pauseAnimation();
    
    const frames = [];
    const totalFrames = forecasts.length;
    
    // Capture every other frame (2-hour jumps) to halve the file size
    for (let i = 0; i < totalFrames; i += 2) {
        updateUI(i);
        // Wait for Leaflet to update opacities and load tiles if necessary
        await delay(150); 
        
        // Capture map element
        const canvas = await html2canvas(mapEl, { 
            useCORS: true,
            scale: 1, // Force scale to 1 to prevent Retina/high-DPI display mismatch with client coordinates
            ignoreElements: (element) => element.id === 'gif-loading'
        });
        
        // Create cropped canvas
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = selBox.width;
        cropCanvas.height = selBox.height;
        const ctx = cropCanvas.getContext('2d');
        
        // Draw the cropped portion
        ctx.drawImage(canvas, selBox.left, selBox.top, selBox.width, selBox.height, 0, 0, selBox.width, selBox.height);
        
        // Add Madison Time text overlay
        const timeText = formatToMadisonTime(forecasts[i].valid_time);
        
        // Background for text
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(5, 5, 230, 30);
        ctx.borderRadius = 4;
        
        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "Outfit", sans-serif';
        ctx.fillText(timeText, 15, 25);
        
        frames.push(cropCanvas.toDataURL('image/png'));
        
        // Update progress bar
        gifProgress.style.width = Math.round(((i + 1) / totalFrames) * 50) + '%';
    }
    
    // Restore UI
    updateUI(originalStep);
    
    // Compile GIF using gifshot
    gifshot.createGIF({
        images: frames,
        interval: 0.3, // 300ms per frame (slower, easier to read)
        gifWidth: selBox.width,
        gifHeight: selBox.height,
        progressCallback: function(captureProgress) {
            gifProgress.style.width = (50 + Math.round(captureProgress * 50)) + '%';
        }
    }, function(obj) {
        if(!obj.error) {
            const image = obj.image;
            // Trigger download
            const a = document.createElement('a');
            a.href = image;
            a.download = 'hrrr-smoke-forecast.gif';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert('Error generating GIF.');
            console.error(obj.error);
        }
        gifLoading.style.display = 'none';
    });
});
