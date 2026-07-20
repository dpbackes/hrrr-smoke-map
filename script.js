// Map Initialization
const map = L.map('map', {
    zoomControl: false // Move zoom control if needed
}).setView([43.0731, -89.4012], 6); // Center on Madison, WI

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
let camsData = null;

// DOM Elements
const timeSlider = document.getElementById('time-slider');
const playBtn = document.getElementById('play-btn');
const playIcon = document.querySelector('.play-icon');
const pauseIcon = document.querySelector('.pause-icon');
const currentTimeEl = document.getElementById('current-time');
const forecastHourEl = document.getElementById('forecast-hour');
const modelRunEl = document.getElementById('model-run');
const camsAqiEl = document.getElementById('cams-aqi');
const camsPm25El = document.getElementById('cams-pm25');
const camsOzoneEl = document.getElementById('cams-ozone');

// Fetch CAMS data for Madison
async function loadCamsData() {
    try {
        const response = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=43.07&longitude=-89.40&hourly=pm2_5,ozone,us_aqi&timezone=GMT&past_days=1&forecast_days=3');
        camsData = await response.json();
    } catch (e) {
        console.error("Failed to load CAMS data", e);
    }
}

// Helper to format UTC string to Madison, WI time (Central Time)
function formatToMadisonTime(utcString) {
    const d = new Date(utcString);
    return d.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

// Fetch Metadata
async function loadData() {
    try {
        await loadCamsData();
        const response = await fetch('data/metadata.json');
        if (!response.ok) throw new Error('Data not found');
        const data = await response.json();
        
        forecasts = data.forecasts;
        bounds = data.bounds;
        modelRunEl.textContent = formatToMadisonTime(data.run_time);
        
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
    
    // Update Text and CAMS data
    if (forecasts[currentStep]) {
        const f = forecasts[currentStep];
        currentTimeEl.textContent = formatToMadisonTime(f.valid_time);
        forecastHourEl.textContent = `F${f.fxx.toString().padStart(2, '0')}`;
        
        // Sync CAMS data
        if (camsData) {
            // f.valid_time is like "2026-07-20 00:00:00 UTC"
            // we parse it as Date object
            const validTime = new Date(f.valid_time.replace(" UTC", "Z"));
            
            let closestIdx = -1;
            let minDiff = Infinity;
            
            camsData.hourly.time.forEach((t, i) => {
                const camTime = new Date(t + "Z"); // OpenMeteo GMT times don't have Z
                const diff = Math.abs(camTime - validTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = i;
                }
            });
            
            if (closestIdx !== -1) {
                const aqi = camsData.hourly.us_aqi[closestIdx];
                const pm = camsData.hourly.pm2_5[closestIdx];
                const ozone = camsData.hourly.ozone[closestIdx];
                
                camsAqiEl.textContent = aqi !== null ? aqi : '--';
                camsPm25El.textContent = pm !== null ? Math.round(pm) : '--';
                camsOzoneEl.textContent = ozone !== null ? Math.round(ozone) : '--';
                
                // Color code the AQI text
                if (aqi <= 50) camsAqiEl.style.color = '#00e400';
                else if (aqi <= 100) camsAqiEl.style.color = '#ffff00';
                else if (aqi <= 150) camsAqiEl.style.color = '#ff7e00';
                else if (aqi <= 200) camsAqiEl.style.color = '#ff0000';
                else if (aqi <= 300) camsAqiEl.style.color = '#8f3f97';
                else camsAqiEl.style.color = '#7e0023';
            }
        }
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
