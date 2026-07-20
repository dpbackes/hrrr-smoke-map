// Map Initialization
const map = L.map('map', {
    zoomControl: false // Move zoom control if needed
}).setView([38.5, -96], 5); // Center on CONUS

// Add base map (OpenStreetMap with custom dark mode filter in CSS)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors | Data: NOAA HRRR'
}).addTo(map);

L.control.zoom({
    position: 'topright'
}).addTo(map);

// App State
let forecasts = [];
let bounds = [];
let currentStep = 0;
let isPlaying = false;
let playInterval;
let layers = [];

// DOM Elements
const timeSlider = document.getElementById('time-slider');
const playBtn = document.getElementById('play-btn');
const playIcon = document.querySelector('.play-icon');
const pauseIcon = document.querySelector('.pause-icon');
const currentTimeEl = document.getElementById('current-time');
const forecastHourEl = document.getElementById('forecast-hour');
const modelRunEl = document.getElementById('model-run');

// Fetch Metadata
async function loadData() {
    try {
        const response = await fetch('data/metadata.json');
        if (!response.ok) throw new Error('Data not found');
        const data = await response.json();
        
        forecasts = data.forecasts;
        bounds = data.bounds;
        modelRunEl.textContent = data.run_time;
        
        // Setup slider max
        timeSlider.max = forecasts.length - 1;
        
        // Load layers
        setupLayers();
        
        // Init UI
        updateUI(0);
        
    } catch (error) {
        console.error("Error loading data:", error);
        currentTimeEl.textContent = "Data not available. Run fetch script first.";
    }
}

function setupLayers() {
    // Create an ImageOverlay for each forecast
    forecasts.forEach((f, index) => {
        // We use Leaflet's imageOverlay. Bounds from metadata.
        const layer = L.imageOverlay(f.image, bounds, {
            opacity: index === 0 ? 0.7 : 0, // Only show first layer initially
            interactive: false
        }).addTo(map);
        layers.push(layer);
    });
}

function updateUI(stepIndex) {
    currentStep = stepIndex;
    
    // Update Slider
    timeSlider.value = currentStep;
    
    // Update Text
    if (forecasts[currentStep]) {
        const f = forecasts[currentStep];
        currentTimeEl.textContent = f.valid_time;
        forecastHourEl.textContent = `F${f.fxx.toString().padStart(2, '0')}`;
    }
    
    // Update Layers
    layers.forEach((layer, index) => {
        if (index === currentStep) {
            layer.setOpacity(0.7); // Active layer
        } else {
            layer.setOpacity(0); // Hide others
        }
    });
}

function togglePlay() {
    if (isPlaying) {
        pauseAnimation();
    } else {
        playAnimation();
    }
}

function playAnimation() {
    isPlaying = true;
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    
    // If at end, restart
    if (currentStep >= forecasts.length - 1) {
        updateUI(0);
    }
    
    playInterval = setInterval(() => {
        if (currentStep >= forecasts.length - 1) {
            pauseAnimation();
        } else {
            updateUI(currentStep + 1);
        }
    }, 1000); // 1 second per frame
}

function pauseAnimation() {
    isPlaying = false;
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    clearInterval(playInterval);
}

// Event Listeners
timeSlider.addEventListener('input', (e) => {
    if (isPlaying) pauseAnimation();
    updateUI(parseInt(e.target.value));
});

playBtn.addEventListener('click', togglePlay);

// Initialize
loadData();
