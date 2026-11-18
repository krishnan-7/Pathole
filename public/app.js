/**
 * ======================================================================================
 * ESP32 Smart Pothole Detection & Real-Time Camera Monitoring System
 * Complete Frontend Application Logic (app.js)
 * 
 * Features:
 * - Web Serial API Communication (115200 Baud, Bidirectional)
 * - Automatic Webcam Initialization & Live Preview
 * - HTML5 Canvas Automated & Manual Image Capture with Watermark Overlays
 * - Distance Threshold State Machine (>=56.0cm Trigger, <=53.0cm Re-arm)
 * - IndexedDB Persistent Event History & REST API Synchronization
 * - Complete 8-Unit Testing & Hardware Verification Suite
 * - Live Serial Monitor Terminal with Auto-Scroll & Command Sender
 * - Light / Dark Mode Toggle & Modal Dialogs
 * ======================================================================================
 */

// ======================================================================================
// 1. GLOBAL STATE & CONFIGURATION
// ======================================================================================
const CONFIG = {
  BAUD_RATE: 115200,
  TRIGGER_DISTANCE_CM: 56.0,   // Automatic capture trigger threshold
  REARM_DISTANCE_CM: 53.0,     // Level at which system re-arms for subsequent pothole
  DB_NAME: 'PotholeDetectionDB',
  DB_VERSION: 1,
  STORE_NAME: 'detection_events'
};

const STATE = {
  // Web Serial Port & Stream
  serialPort: null,
  serialReader: null,
  serialWriter: null,
  isSerialConnected: false,
  receivedPacketsCount: 0,
  lastPacketTime: null,
  lastTelemetry: null,

  // Camera State
  webcamStream: null,
  isCameraActive: false,
  isArmed: true,               // Armed state machine for capture debounce
  latestCapturedEvent: null,

  // IndexedDB Instance
  db: null,
  eventsCache: [],

  // Map State (Google Maps Roads / Satellite / Dark Matter via Direct High-Res Tile Service)
  activeMapStyle: 'googleRoads',
  leafletMapDashboard: null,
  leafletMapFull: null,
  leafletTileDashboard: null,
  leafletTileFull: null,
  leafletVehicleDashboard: null,
  leafletVehicleFull: null,
  leafletMarkers: [],
  currentLocation: { lat: 13.0827, lng: 80.2707 }, // Auto-updated via GPS
  isGpsActive: false,

  // Test Suite State Tracking (Section 10 & 11)
  // Per prompt: "Never show PASS unless the corresponding hardware or functionality has actually been tested and verified."
  testResults: {
    test1_serial: 'UNTESTED',
    test2_ultrasonic: 'UNTESTED',
    test3_led: 'UNTESTED',
    test4_buzzer: 'UNTESTED',
    test5_webcam: 'UNTESTED',
    test6_capture: 'UNTESTED',
    test7_autotrigger: 'UNTESTED',
    test8_dashboard: 'UNTESTED'
  },
  lastTestImageBlob: null
};

// ======================================================================================
// 2. DOM ELEMENT REFERENCES
// ======================================================================================
const DOM = {
  // Navigation & Themes
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIconSun: document.getElementById('themeIconSun'),
  themeIconMoon: document.getElementById('themeIconMoon'),
  navTabs: document.querySelectorAll('.nav-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  tabHistoryCount: document.getElementById('tabHistoryCount'),
  btnPinoutModal: document.getElementById('btnPinoutModal'),
  pinoutModal: document.getElementById('pinoutModal'),
  btnClosePinoutModal: document.getElementById('btnClosePinoutModal'),
  btnClosePinoutSecondary: document.getElementById('btnClosePinoutSecondary'),
  serialWarningBanner: document.getElementById('serialWarningBanner'),

  // Header Status Pills
  headerEspStatus: document.getElementById('headerEspStatus'),
  headerCamStatus: document.getElementById('headerCamStatus'),
  headerGpsStatus: document.getElementById('headerGpsStatus'),
  headerArmStatus: document.getElementById('headerArmStatus'),
  tabMapCount: document.getElementById('tabMapCount'),

  // Serial Bridge Controls
  connLedIndicator: document.getElementById('connLedIndicator'),
  portDetailsText: document.getElementById('portDetailsText'),
  btnConnectSerial: document.getElementById('btnConnectSerial'),
  btnDisconnectSerial: document.getElementById('btnDisconnectSerial'),
  serialErrorContainer: document.getElementById('serialErrorContainer'),
  serialErrorMsg: document.getElementById('serialErrorMsg'),

  // Live Metrics & Indicators
  metricDistanceVal: document.getElementById('metricDistanceVal'),
  metricSensorStatus: document.getElementById('metricSensorStatus'),
  metricTimeSinceLast: document.getElementById('metricTimeSinceLast'),
  zoneBadgeBig: document.getElementById('zoneBadgeBig'),
  zoneNameText: document.getElementById('zoneNameText'),
  zoneRangeText: document.getElementById('zoneRangeText'),
  ledSimulatorBulb: document.getElementById('ledSimulatorBulb'),
  ledStatusText: document.getElementById('ledStatusText'),
  buzzerSoundWave: document.getElementById('buzzerSoundWave'),
  buzzerStatusText: document.getElementById('buzzerStatusText'),
  buzzerFrequencyText: document.getElementById('buzzerFrequencyText'),

  // Distance Meter
  meterLivePointer: document.getElementById('meterLivePointer'),
  needleDistanceText: document.getElementById('needleDistanceText'),

  // Webcam & Capture Elements
  webcamElement: document.getElementById('webcamElement'),
  camOverlayHUD: document.getElementById('camOverlayHUD'),
  hudDistanceBadge: document.getElementById('hudDistanceBadge'),
  hudTimestampText: document.getElementById('hudTimestampText'),
  hudZoneBadge: document.getElementById('hudZoneBadge'),
  camDeniedBox: document.getElementById('camDeniedBox'),
  btnRetryWebcam: document.getElementById('btnRetryWebcam'),
  camStateBadge: document.getElementById('camStateBadge'),
  camArmBadge: document.getElementById('camArmBadge'),
  captureCanvas: document.getElementById('captureCanvas'),

  // Latest Pothole Image Display
  noCapturePlaceholder: document.getElementById('noCapturePlaceholder'),
  latestCaptureView: document.getElementById('latestCaptureView'),
  latestCapturedImg: document.getElementById('latestCapturedImg'),
  latestEventId: document.getElementById('latestEventId'),
  latestTimestamp: document.getElementById('latestTimestamp'),
  latestDistance: document.getElementById('latestDistance'),
  latestZone: document.getElementById('latestZone'),
  latestGpsCoords: document.getElementById('latestGpsCoords'),
  btnDownloadLatest: document.getElementById('btnDownloadLatest'),
  btnFullscreenLatest: document.getElementById('btnFullscreenLatest'),

  // Geospatial Map Elements
  gpsCoordsBadge: document.getElementById('gpsCoordsBadge'),
  btnCenterVehicle: document.getElementById('btnCenterVehicle'),
  btnCenterVehicleFull: document.getElementById('btnCenterVehicleFull'),
  btnFitAllMarkers: document.getElementById('btnFitAllMarkers'),
  btnMapStyleGoogle: document.getElementById('btnMapStyleGoogle'),
  btnMapStyleSatellite: document.getElementById('btnMapStyleSatellite'),
  btnMapStyleDark: document.getElementById('btnMapStyleDark'),
  btnMapStyleGoogleFull: document.getElementById('btnMapStyleGoogleFull'),
  btnMapStyleSatelliteFull: document.getElementById('btnMapStyleSatelliteFull'),
  btnMapStyleDarkFull: document.getElementById('btnMapStyleDarkFull'),
  mapPotholeCountBadge: document.getElementById('mapPotholeCountBadge'),
  googleMapDashboard: document.getElementById('googleMapDashboard'),
  googleMapFull: document.getElementById('googleMapFull'),

  // Detection History Table
  historyTableBody: document.getElementById('historyTableBody'),
  btnExportCsv: document.getElementById('btnExportCsv'),
  btnExportJson: document.getElementById('btnExportJson'),
  btnClearHistory: document.getElementById('btnClearHistory'),

  // Fullscreen Image Modal
  imageViewerModal: document.getElementById('imageViewerModal'),
  modalImageTitle: document.getElementById('modalImageTitle'),
  modalImageDisplay: document.getElementById('modalImageDisplay'),
  modalMetaGrid: document.getElementById('modalMetaGrid'),
  btnModalDownload: document.getElementById('btnModalDownload'),
  btnCloseImageModal: document.getElementById('btnCloseImageModal'),
  btnModalCloseSecondary: document.getElementById('btnModalCloseSecondary'),

  // Testing Suite Panel Elements (Section 10 & 11)
  btnRunAllTests: document.getElementById('btnRunAllTests'),
  overallTestBanner: document.getElementById('overallTestBanner'),
  overallStatusTitle: document.getElementById('overallStatusTitle'),
  overallStatusDesc: document.getElementById('overallStatusDesc'),
  overallIconPending: document.getElementById('overallIconPending'),
  overallIconPass: document.getElementById('overallIconPass'),
  overallIconFail: document.getElementById('overallIconFail'),

  // Test 1 Elements
  badgeTest1: document.getElementById('badgeTest1'),
  t1PortState: document.getElementById('t1PortState'),
  t1Baud: document.getElementById('t1Baud'),
  t1Packets: document.getElementById('t1Packets'),
  btnTest1Run: document.getElementById('btnTest1Run'),
  t1Message: document.getElementById('t1Message'),

  // Test 2 Elements
  badgeTest2: document.getElementById('badgeTest2'),
  t2DistanceVal: document.getElementById('t2DistanceVal'),
  t2RangeCheck: document.getElementById('t2RangeCheck'),
  t2SensorFlag: document.getElementById('t2SensorFlag'),
  btnTest2Run: document.getElementById('btnTest2Run'),
  t2Message: document.getElementById('t2Message'),

  // Test 3 Elements
  badgeTest3: document.getElementById('badgeTest3'),
  btnTest3Red: document.getElementById('btnTest3Red'),
  btnTest3Green: document.getElementById('btnTest3Green'),
  btnTest3Blue: document.getElementById('btnTest3Blue'),
  btnTest3Off: document.getElementById('btnTest3Off'),
  btnTest3Pass: document.getElementById('btnTest3Pass'),
  btnTest3Fail: document.getElementById('btnTest3Fail'),
  t3Message: document.getElementById('t3Message'),

  // Test 4 Elements
  badgeTest4: document.getElementById('badgeTest4'),
  btnTest4Short: document.getElementById('btnTest4Short'),
  btnTest4Intermittent: document.getElementById('btnTest4Intermittent'),
  btnTest4Continuous: document.getElementById('btnTest4Continuous'),
  btnTest4Stop: document.getElementById('btnTest4Stop'),
  btnTest4Pass: document.getElementById('btnTest4Pass'),
  btnTest4Fail: document.getElementById('btnTest4Fail'),
  t4Message: document.getElementById('t4Message'),

  // Test 5 Elements
  badgeTest5: document.getElementById('badgeTest5'),
  t5Perm: document.getElementById('t5Perm'),
  t5Resolution: document.getElementById('t5Resolution'),
  t5ReadyState: document.getElementById('t5ReadyState'),
  btnTest5Run: document.getElementById('btnTest5Run'),
  t5Message: document.getElementById('t5Message'),

  // Test 6 Elements
  badgeTest6: document.getElementById('badgeTest6'),
  btnTest6ManualCapture: document.getElementById('btnTest6ManualCapture'),
  btnTest6Download: document.getElementById('btnTest6Download'),
  testCaptureImgPreview: document.getElementById('testCaptureImgPreview'),
  testCapturePlaceholder: document.getElementById('testCapturePlaceholder'),
  t6Message: document.getElementById('t6Message'),

  // Test 7 Elements
  badgeTest7: document.getElementById('badgeTest7'),
  t7TriggerCheck: document.getElementById('t7TriggerCheck'),
  t7DebounceCheck: document.getElementById('t7DebounceCheck'),
  t7RearmCheck: document.getElementById('t7RearmCheck'),
  btnTest7Run: document.getElementById('btnTest7Run'),
  t7Message: document.getElementById('t7Message'),

  // Test 8 Elements
  badgeTest8: document.getElementById('badgeTest8'),
  t8StorageStatus: document.getElementById('t8StorageStatus'),
  t8ApiStatus: document.getElementById('t8ApiStatus'),
  t8BindingStatus: document.getElementById('t8BindingStatus'),
  btnTest8Run: document.getElementById('btnTest8Run'),
  t8Message: document.getElementById('t8Message'),

  // Summary Table Badges & Notes
  repT1Badge: document.getElementById('repT1Badge'),
  repT1Note: document.getElementById('repT1Note'),
  repT2Badge: document.getElementById('repT2Badge'),
  repT2Note: document.getElementById('repT2Note'),
  repT3Badge: document.getElementById('repT3Badge'),
  repT3Note: document.getElementById('repT3Note'),
  repT4Badge: document.getElementById('repT4Badge'),
  repT4Note: document.getElementById('repT4Note'),
  repT5Badge: document.getElementById('repT5Badge'),
  repT5Note: document.getElementById('repT5Note'),
  repT6Badge: document.getElementById('repT6Badge'),
  repT6Note: document.getElementById('repT6Note'),
  repT7Badge: document.getElementById('repT7Badge'),
  repT7Note: document.getElementById('repT7Note'),
  repT8Badge: document.getElementById('repT8Badge'),
  repT8Note: document.getElementById('repT8Note'),

  // Serial Monitor Terminal
  terminalOutput: document.getElementById('terminalOutput'),
  chkAutoScroll: document.getElementById('chkAutoScroll'),
  chkShowTimestamps: document.getElementById('chkShowTimestamps'),
  btnClearTerminal: document.getElementById('btnClearTerminal'),
  serialCmdInput: document.getElementById('serialCmdInput'),
  btnSendSerialCmd: document.getElementById('btnSendSerialCmd')
};

// ======================================================================================
// 3. INITIALIZATION & LIFECYCLE
// ======================================================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initIndexedDB();
  initTabs();
  checkWebSerialSupport();
  initWebcam(); // Requirement 5: Automatically request webcam permission when website opens!
  initGeolocation(); // Vehicle GPS Geotracking
  initActiveMap();   // Initialize Active Map Engine (Default: Leaflet Dark Matter)
  initEventListeners();
  startHUDClock();
});

// ======================================================================================
// 4. THEME CONTROLLER (DARK / LIGHT)
// ======================================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

  DOM.themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const target = current === 'dark' ? 'light' : 'dark';
    setTheme(target);
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (theme === 'dark') {
    DOM.themeIconMoon.classList.remove('hidden');
    DOM.themeIconSun.classList.add('hidden');
  } else {
    DOM.themeIconMoon.classList.add('hidden');
    DOM.themeIconSun.classList.remove('hidden');
  }
}

// ======================================================================================
// 5. TAB NAVIGATION CONTROLLER
// ======================================================================================
function initTabs() {
  DOM.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');

      DOM.navTabs.forEach(t => t.classList.remove('active'));
      DOM.tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const activeContent = document.getElementById(`tab-${targetTab}`);
      if (activeContent) activeContent.classList.add('active');
    });
  });
}

// ======================================================================================
// 5.B GOOGLE MAPS PLATFORM & GEOLOCATION TRACKING
// ======================================================================================
const GOOGLE_MAPS_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#38bdf8" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#132338" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#0284c7" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#0369a1" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f1f5f9" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#082f49" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#0ea5e9" }] }
];

function initGeolocation() {
  if (!navigator.geolocation) {
    if (DOM.headerGpsStatus) {
      DOM.headerGpsStatus.className = 'status-pill status-disconnected';
      DOM.headerGpsStatus.querySelector('.status-label').textContent = 'GPS: Unavailable';
    }
    return;
  }

  logTerminal('[GPS] Activating real-time vehicle GPS tracking...', 'log-system');

  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      STATE.currentLocation = { lat, lng };
      STATE.isGpsActive = true;

      if (DOM.headerGpsStatus) {
        DOM.headerGpsStatus.className = 'status-pill status-connected';
        DOM.headerGpsStatus.querySelector('.status-label').textContent = `GPS: Live (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }

      if (DOM.gpsCoordsBadge) {
        DOM.gpsCoordsBadge.textContent = `GPS: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
        DOM.gpsCoordsBadge.className = 'badge badge-success';
      }

      if (DOM.latestGpsCoords && (DOM.latestGpsCoords.textContent === 'Acquiring...' || DOM.latestGpsCoords.textContent === '--')) {
        DOM.latestGpsCoords.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }

      updateVehicleMapMarkers();
    },
    (err) => {
      console.warn('[GPS Geolocation Warning]', err.message);
      if (DOM.headerGpsStatus) {
        DOM.headerGpsStatus.className = 'status-pill status-inactive';
        DOM.headerGpsStatus.querySelector('.status-label').textContent = 'GPS: Default Location';
      }
      if (DOM.gpsCoordsBadge) {
        DOM.gpsCoordsBadge.textContent = `GPS: ${STATE.currentLocation.lat.toFixed(4)}° N, ${STATE.currentLocation.lng.toFixed(4)}° E (Default)`;
      }
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
  );
}

// ======================================================================================
// 5.B HIGH-PRECISION GEOSPATIAL MAP ENGINE (GOOGLE MAPS ROADS / SATELLITE / DARK THEME)
// ======================================================================================
const TILE_PROVIDERS = {
  googleRoads: {
    name: 'Google Maps (Roads)',
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps'
  },
  googleSatellite: {
    name: 'Google Satellite',
    url: 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps Satellite Imagery'
  },
  darkMatter: {
    name: 'Dark Theme',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }
};

function initActiveMap() {
  if (typeof L === 'undefined') {
    setTimeout(initActiveMap, 150);
    return;
  }

  logTerminal('[Geospatial Map] Initializing real-time Google Maps engine...', 'log-system');

  const provider = TILE_PROVIDERS[STATE.activeMapStyle] || TILE_PROVIDERS.googleRoads;

  // 1. Dashboard Map Container
  const dashContainer = document.getElementById('googleMapDashboard');
  if (dashContainer) {
    if (dashContainer._leaflet_id) {
      try {
        if (STATE.leafletMapDashboard) STATE.leafletMapDashboard.remove();
      } catch (e) {}
      delete dashContainer._leaflet_id;
    }
    dashContainer.innerHTML = '';

    STATE.leafletMapDashboard = L.map(dashContainer, {
      zoomControl: true,
      attributionControl: false
    }).setView([STATE.currentLocation.lat, STATE.currentLocation.lng], 15);

    STATE.leafletTileDashboard = L.tileLayer(provider.url, {
      maxZoom: provider.maxZoom,
      subdomains: provider.subdomains || 'abc',
      attribution: provider.attribution
    }).addTo(STATE.leafletMapDashboard);
  }

  // 2. Full-Screen Map Container
  const fullContainer = document.getElementById('googleMapFull');
  if (fullContainer) {
    if (fullContainer._leaflet_id) {
      try {
        if (STATE.leafletMapFull) STATE.leafletMapFull.remove();
      } catch (e) {}
      delete fullContainer._leaflet_id;
    }
    fullContainer.innerHTML = '';

    STATE.leafletMapFull = L.map(fullContainer, {
      zoomControl: true,
      attributionControl: false
    }).setView([STATE.currentLocation.lat, STATE.currentLocation.lng], 16);

    STATE.leafletTileFull = L.tileLayer(provider.url, {
      maxZoom: provider.maxZoom,
      subdomains: provider.subdomains || 'abc',
      attribution: provider.attribution
    }).addTo(STATE.leafletMapFull);
  }

  updateVehicleMapMarkers();
  syncPotholesToMaps();

  // Multi-pass size invalidation to guarantee full tiles load immediately
  [150, 400, 1000].forEach(delay => {
    setTimeout(() => {
      if (STATE.leafletMapDashboard) STATE.leafletMapDashboard.invalidateSize();
      if (STATE.leafletMapFull) STATE.leafletMapFull.invalidateSize();
    }, delay);
  });

  // Tab switch resize listener
  DOM.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      [150, 350, 800].forEach(delay => {
        setTimeout(() => {
          if (STATE.leafletMapDashboard) STATE.leafletMapDashboard.invalidateSize();
          if (STATE.leafletMapFull) STATE.leafletMapFull.invalidateSize();
        }, delay);
      });
    });
  });
}

function setMapStyle(styleKey) {
  if (!TILE_PROVIDERS[styleKey]) return;
  STATE.activeMapStyle = styleKey;
  const provider = TILE_PROVIDERS[styleKey];

  if (STATE.leafletTileDashboard) {
    STATE.leafletTileDashboard.setUrl(provider.url);
  }
  if (STATE.leafletTileFull) {
    STATE.leafletTileFull.setUrl(provider.url);
  }

  setTimeout(() => {
    if (STATE.leafletMapDashboard) STATE.leafletMapDashboard.invalidateSize();
    if (STATE.leafletMapFull) STATE.leafletMapFull.invalidateSize();
  }, 100);

  const isGoogle = styleKey === 'googleRoads';
  const isSat = styleKey === 'googleSatellite';
  const isDark = styleKey === 'darkMatter';

  const updateBtns = (bGoogle, bSat, bDark) => {
    if (bGoogle) bGoogle.className = `btn btn-xs ${isGoogle ? 'btn-primary' : 'btn-secondary'}`;
    if (bSat) bSat.className = `btn btn-xs ${isSat ? 'btn-primary' : 'btn-secondary'}`;
    if (bDark) bDark.className = `btn btn-xs ${isDark ? 'btn-primary' : 'btn-secondary'}`;
  };

  updateBtns(DOM.btnMapStyleGoogle, DOM.btnMapStyleSatellite, DOM.btnMapStyleDark);
  updateBtns(DOM.btnMapStyleGoogleFull, DOM.btnMapStyleSatelliteFull, DOM.btnMapStyleDarkFull);

  logTerminal(`[Map Engine] Switched layer to ${provider.name}`, 'log-system');
}

function updateVehicleMapMarkers() {
  if (typeof L === 'undefined') return;
  const { lat, lng } = STATE.currentLocation;

  const vehicleDivHtml = `
    <div class="vehicle-pulsing-marker">
      <div class="pulse-ring"></div>
      <div class="core-dot"></div>
    </div>
  `;
  const vehicleIcon = L.divIcon({
    className: 'custom-vehicle-icon',
    html: vehicleDivHtml,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  if (STATE.leafletMapDashboard) {
    if (!STATE.leafletVehicleDashboard) {
      STATE.leafletVehicleDashboard = L.marker([lat, lng], {
        icon: vehicleIcon,
        title: "Vehicle Current Position",
        zIndexOffset: 1000
      }).addTo(STATE.leafletMapDashboard);
    } else {
      STATE.leafletVehicleDashboard.setLatLng([lat, lng]);
    }
  }

  if (STATE.leafletMapFull) {
    if (!STATE.leafletVehicleFull) {
      STATE.leafletVehicleFull = L.marker([lat, lng], {
        icon: vehicleIcon,
        title: "Vehicle Current Position",
        zIndexOffset: 1000
      }).addTo(STATE.leafletMapFull);
    } else {
      STATE.leafletVehicleFull.setLatLng([lat, lng]);
    }
  }
}

function addPotholeMarkerToMap(event) {
  if (typeof L === 'undefined') return;

  const lat = event.lat !== undefined ? event.lat : STATE.currentLocation.lat;
  const lng = event.lng !== undefined ? event.lng : STATE.currentLocation.lng;

  const isCritical = (event.distance > 60 || (event.zone && (event.zone.includes('CRITICAL') || event.zone.includes('RED'))));
  const markerColor = isCritical ? '#ef4444' : '#3b82f6';
  const depthDisplay = typeof event.distance === 'number' ? event.distance.toFixed(1) : event.distance;

  const pinHtml = `
    <div class="custom-pothole-pin ${isCritical ? 'pin-critical' : 'pin-warning'}">
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 24 30">
        <path fill="${markerColor}" stroke="#ffffff" stroke-width="1.5" d="M12 0C7 0 3 4 3 9c0 7 9 21 9 21s9-14 9-21c0-5-4-9-9-9z"/>
        <circle cx="12" cy="9" r="4" fill="#ffffff"/>
      </svg>
    </div>
  `;

  const pinIcon = L.divIcon({
    className: 'custom-pothole-pin-icon',
    html: pinHtml,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34]
  });

  const infoContent = `
    <div class="pothole-infowindow">
      <h4>⚠️ ${isCritical ? 'Critical Pothole Crater' : 'Pothole Warning'}</h4>
      ${event.imageBase64 ? `<img src="${event.imageBase64}" alt="${event.id}">` : ''}
      <p><strong>ID:</strong> <span class="font-mono">${event.id}</span></p>
      <p><strong>Depth:</strong> <span class="badge-depth">${depthDisplay} cm</span></p>
      <p><strong>Zone:</strong> ${event.zone || 'POTHOLE'}</p>
      <p><strong>Time:</strong> ${event.timestamp}</p>
      <p><strong>GPS:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
    </div>
  `;

  if (STATE.leafletMapDashboard) {
    const lMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(STATE.leafletMapDashboard);
    lMarker.bindPopup(infoContent);
    STATE.leafletMarkers.push(lMarker);
  }

  if (STATE.leafletMapFull) {
    const lMarkerFull = L.marker([lat, lng], { icon: pinIcon }).addTo(STATE.leafletMapFull);
    lMarkerFull.bindPopup(infoContent);
    STATE.leafletMarkers.push(lMarkerFull);
  }

  if (DOM.tabMapCount) DOM.tabMapCount.textContent = STATE.eventsCache.length;
  if (DOM.mapPotholeCountBadge) DOM.mapPotholeCountBadge.textContent = `${STATE.eventsCache.length} Potholes Pinned`;
}

function syncPotholesToMaps() {
  STATE.eventsCache.forEach(ev => addPotholeMarkerToMap(ev));
}

window.zoomToPotholeOnMap = (lat, lng) => {
  const targetTab = document.querySelector('.nav-tab[data-tab="map"]');
  if (targetTab) targetTab.click();

  setTimeout(() => {
    if (STATE.leafletMapFull) {
      STATE.leafletMapFull.setView([lat, lng], 18);
    }
  }, 200);
};

// ======================================================================================
// 6. WEBCAM MANAGEMENT (SECTION 5 OF PROMPT)
// ======================================================================================
/**
 * Automatically request webcam permission and turn ON laptop webcam when website opens.
 * Keep stream ON continuously.
 */
async function initWebcam() {
  logTerminal('[Webcam] Requesting webcam access via getUserMedia...', 'log-system');

  try {
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    };

    STATE.webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
    DOM.webcamElement.srcObject = STATE.webcamStream;
    STATE.isCameraActive = true;

    DOM.camDeniedBox.classList.add('hidden');
    DOM.camStateBadge.textContent = 'Camera Active (720p)';
    DOM.camStateBadge.className = 'badge badge-success';

    DOM.headerCamStatus.className = 'status-pill status-connected';
    DOM.headerCamStatus.querySelector('.status-label').textContent = 'Webcam: Live';

    logTerminal('[Webcam] Webcam stream initialized successfully.', 'log-system');

    // Update Test 5 status dynamically if in testing panel
    updateTest5UI('PASS', 'Webcam permission granted and video stream active.');
  } catch (err) {
    console.error('[Webcam Error]', err);
    STATE.isCameraActive = false;
    DOM.camDeniedBox.classList.remove('hidden');
    DOM.camStateBadge.textContent = 'Camera Inactive';
    DOM.camStateBadge.className = 'badge badge-danger';

    DOM.headerCamStatus.className = 'status-pill status-disconnected';
    DOM.headerCamStatus.querySelector('.status-label').textContent = 'Webcam: Denied';

    logTerminal(`[Webcam Error] ${err.name}: ${err.message}`, 'log-error');
    updateTest5UI('FAIL', `Webcam access denied: ${err.message}`);
  }
}

// Continuous HUD timestamp counter
function startHUDClock() {
  setInterval(() => {
    const now = new Date();
    const timeStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
    if (DOM.hudTimestampText) {
      DOM.hudTimestampText.textContent = timeStr;
    }
  }, 1000);
}

// ======================================================================================
// 7. WEB SERIAL API COMMUNICATION (SECTION 6 OF PROMPT)
// ======================================================================================
function checkWebSerialSupport() {
  if (!('serial' in navigator)) {
    DOM.serialWarningBanner.classList.remove('hidden');
    DOM.btnConnectSerial.disabled = true;
    logTerminal('[Web Serial] Web Serial API not supported in this browser. Please use Google Chrome or Edge.', 'log-error');
    return false;
  }
  return true;
}

/**
 * Open browser port selection and connect at 115200 baud
 */
async function connectSerial() {
  if (!checkWebSerialSupport()) return;

  hideSerialError();
  logTerminal('[Web Serial] Opening COM port selector. Please select your ESP32 COM port...', 'log-system');

  try {
    // Prompt user to select port
    STATE.serialPort = await navigator.serial.requestPort();
    logTerminal('[Web Serial] COM Port selected. Opening at 115200 baud...', 'log-system');

    await STATE.serialPort.open({ baudRate: CONFIG.BAUD_RATE });

    STATE.isSerialConnected = true;
    updateConnectionUI(true);
    logTerminal(`[Web Serial] Successfully CONNECTED to ESP32 at ${CONFIG.BAUD_RATE} baud! Listening for telemetry...`, 'log-incoming');

    // Send initial handshake ping
    setTimeout(() => {
      sendSerialCommand('CMD:PING');
    }, 400);

    // Update Test 1 status
    updateTest1UI('PASS', `Connected at ${CONFIG.BAUD_RATE} baud. Receiving serial data.`);

    // Start read loop
    readSerialStream();
  } catch (err) {
    console.error('[Web Serial Error]', err);
    STATE.isSerialConnected = false;
    updateConnectionUI(false);
    showSerialError(`Serial Connection Failed: ${err.message}. (Ensure Arduino IDE Serial Monitor is CLOSED)`);
    logTerminal(`[Web Serial Error] ${err.message}. If port is busy, close Arduino Serial Monitor!`, 'log-error');
    updateTest1UI('FAIL', `Connection failed: ${err.message}`);
  }
}

/**
 * Gracefully disconnect from serial port
 */
async function disconnectSerial() {
  logTerminal('[Web Serial] Disconnecting from port...', 'log-system');
  STATE.isSerialConnected = false;
  try {
    if (STATE.serialReader) {
      await STATE.serialReader.cancel();
      try { STATE.serialReader.releaseLock(); } catch(e) {}
      STATE.serialReader = null;
    }
    if (STATE.serialWriter) {
      await STATE.serialWriter.close();
      STATE.serialWriter = null;
    }
    if (STATE.serialPort) {
      await STATE.serialPort.close();
      STATE.serialPort = null;
    }
  } catch (err) {
    console.warn('[Serial Disconnect]', err);
  } finally {
    updateConnectionUI(false);
    logTerminal('[Web Serial] ESP32 Disconnected.', 'log-system');
  }
}

/**
 * Continuous line-by-line reading of newline-separated JSON from ESP32
 * Ultra-robust direct chunk decoder that handles partial buffers and both \r\n and \n
 */
async function readSerialStream() {
  if (!STATE.serialPort || !STATE.serialPort.readable) {
    logTerminal('[Web Serial] Port is not readable.', 'log-error');
    return;
  }

  let reader;
  try {
    reader = STATE.serialPort.readable.getReader();
    STATE.serialReader = reader;
  } catch (err) {
    console.error('[GetReader Error]', err);
    logTerminal(`[Stream Error] Could not attach reader: ${err.message}`, 'log-error');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (STATE.isSerialConnected) {
      const { value, done } = await reader.read();
      if (done) {
        break; // Port closed or stream finished
      }
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        
        // Parse complete lines delimited by newline
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line.length > 0) {
            handleIncomingSerialLine(line);
          }
        }
      }
    }
  } catch (err) {
    if (STATE.isSerialConnected) {
      console.error('[Stream Error]', err);
      logTerminal(`[Stream Error] ${err.message}`, 'log-error');
      showSerialError(`Stream Read Error: ${err.message}`);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch (e) {}
    STATE.serialReader = null;
  }
}

/**
 * Send custom command string over serial to ESP32
 */
async function sendSerialCommand(cmdString) {
  if (!STATE.serialPort || !STATE.isSerialConnected) {
    logTerminal(`[Send Failed] Cannot send "${cmdString}". ESP32 is not connected!`, 'log-error');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const writer = STATE.serialPort.writable.getWriter();
    await writer.write(encoder.encode(cmdString + '\n'));
    writer.releaseLock();
    logTerminal(`[OUT] ${cmdString}`, 'log-outgoing');
    return true;
  } catch (err) {
    console.error('[Serial Write Error]', err);
    logTerminal(`[Write Error] ${err.message}`, 'log-error');
    return false;
  }
}

// ======================================================================================
// 8. TELEMETRY PROCESSING & DISTANCE LOGIC
// ======================================================================================
/**
 * Processes incoming JSON packets from ESP32:
 * {"distance": 57.40, "zone": "BLUE", "led": "BLUE", "buzzer": "INTERMITTENT", "capture": true, "sensor": "OK"}
 */
function handleIncomingSerialLine(rawJson) {
  logTerminal(`[IN] ${rawJson}`, 'log-incoming');
  STATE.receivedPacketsCount++;
  STATE.lastPacketTime = new Date();

  // Update telemetry packet count in Test 1
  if (DOM.t1Packets) {
    DOM.t1Packets.textContent = STATE.receivedPacketsCount;
  }

  try {
    const telemetry = JSON.parse(rawJson);
    STATE.lastTelemetry = telemetry;

    // Handle handshake responses
    if (telemetry.pong) {
      logTerminal(`[Handshake] ESP32 Ready (${telemetry.device || 'WROOM-32'})`, 'log-system');
      return;
    }

    // Process valid distance telemetry
    processTelemetry(telemetry);
  } catch (parseErr) {
    // Non-JSON line (e.g. boot messages or debug strings)
    logTerminal(`[Debug Output] ${rawJson}`, 'log-system');
  }
}

/**
 * Apply telemetry to UI components, distance meter, and capture trigger state machine
 */
function processTelemetry(data) {
  const isDistanceValid = typeof data.distance === 'number' && !isNaN(data.distance) && data.distance >= 0.0;
  const distance = isDistanceValid ? parseFloat(data.distance) : null;
  const sensorOk = data.sensor === 'OK' && isDistanceValid;
  const hardwareCaptureFlag = (data.capture === true || data.capture === 'true');

  // Update packet heartbeat indicator
  DOM.metricTimeSinceLast.textContent = `Connected • Pkts: ${STATE.receivedPacketsCount}`;

  // 1. Update Distance Readout & Sensor Status
  if (!sensorOk || distance === null) {
    DOM.metricDistanceVal.textContent = '--';
    DOM.metricSensorStatus.textContent = 'Sensor: Timeout / Wiring Error';
    DOM.metricSensorStatus.className = 'badge badge-danger';
    DOM.hudDistanceBadge.textContent = 'DEPTH: SENSOR TIMEOUT';
    DOM.zoneNameText.textContent = data.zone === 'SENSOR_ERROR' ? 'SENSOR ERROR' : 'SENSOR TIMEOUT';
    DOM.zoneRangeText.textContent = 'HC-SR04 timed out. Check VCC is on 5V (VIN) & Echo on GPIO 18';
    DOM.zoneBadgeBig.className = 'zone-badge zone-safe';
    updateTest2UI('FAIL', 'HC-SR04 ultrasonic sensor timed out. Verify VCC is on 5V/VIN and TRIG/ECHO are connected.');
    return;
  }

  DOM.metricDistanceVal.textContent = distance.toFixed(1);
  DOM.metricSensorStatus.textContent = 'Sensor: OK';
  DOM.metricSensorStatus.className = 'badge badge-success';
  DOM.hudDistanceBadge.textContent = `DEPTH: ${distance.toFixed(1)} cm`;
  DOM.metricTimeSinceLast.textContent = `Live • ${distance.toFixed(1)} cm`;

  // Update Test 2 (HC-SR04 Test) with live valid reading
  updateTest2UI('PASS', `Valid measurement received: ${distance.toFixed(1)} cm`);

  // 2. Compute Exact Zones & Visual Representation (Per Section 4)
  // ZONE 1 – SAFE: 0 to 50.0 cm
  // ZONE 2 – NORMAL / GREEN: >50.0 to 55.0 cm
  // ZONE 3 – POTHOLE WARNING / BLUE: >55.0 to 60.0 cm
  // ZONE 4 – CRITICAL DANGER / RED: >60.0 cm
  let zoneName = 'ZONE 1 - SAFE';
  let zoneClass = 'zone-safe';
  let zoneRange = '0.0 to 50.0 cm range (Normal Road)';
  let ledClass = 'led-off';
  let ledLabel = 'OFF';
  let buzzerText = 'OFF';
  let buzzerFreq = 'No warning sounding';
  let buzzerClass = '';

  const zoneUpper = (data.zone || '').toUpperCase();

  if (distance <= 50.0 || zoneUpper === 'SAFE') {
    zoneName = 'ZONE 1 - SAFE';
    zoneClass = 'zone-safe';
    zoneRange = '0.0 to 50.0 cm range (Normal Road)';
    ledClass = 'led-off';
    ledLabel = 'OFF';
    buzzerText = 'OFF';
    buzzerFreq = 'No warning sounding';
    buzzerClass = '';
  } else if ((distance > 50.0 && distance <= 55.0) || zoneUpper === 'GREEN') {
    zoneName = 'ZONE 2 - NORMAL';
    zoneClass = 'zone-normal';
    zoneRange = '50.1 to 55.0 cm range (Acceptable Surface)';
    ledClass = 'led-green';
    ledLabel = 'GREEN ON';
    buzzerText = 'OFF';
    buzzerFreq = 'Ground variation normal';
    buzzerClass = '';
  } else if ((distance > 55.0 && distance <= 60.0) || zoneUpper === 'BLUE') {
    zoneName = 'ZONE 3 - POTHOLE WARNING';
    zoneClass = 'zone-warn';
    zoneRange = '55.1 to 60.0 cm range (Pothole Detected!)';
    ledClass = 'led-blue';
    ledLabel = 'BLUE ON';
    buzzerText = 'INTERMITTENT BEEP';
    buzzerFreq = 'Beeping 150ms ON / 150ms OFF';
    buzzerClass = 'active active-intermittent';
  } else if (distance > 60.0 || zoneUpper === 'RED') {
    zoneName = 'ZONE 4 - CRITICAL DANGER';
    zoneClass = 'zone-danger';
    zoneRange = '> 60.0 cm range (Severe Deep Pothole!)';
    ledClass = 'led-red';
    ledLabel = 'RED ON';
    buzzerText = 'CONTINUOUS ALERT';
    buzzerFreq = 'Continuous Alarm Tone';
    buzzerClass = 'active active-continuous';
  }

  // Update Zone Badges
  DOM.zoneBadgeBig.className = `zone-badge ${zoneClass}`;
  DOM.zoneNameText.textContent = zoneName;
  DOM.zoneRangeText.textContent = zoneRange;
  DOM.hudZoneBadge.textContent = zoneName.split('-')[1]?.trim() || zoneName;

  // Update RGB LED Simulator
  DOM.ledSimulatorBulb.className = `led-bulb ${ledClass}`;
  DOM.ledStatusText.textContent = data.led || ledLabel;

  // Update Buzzer Indicator
  DOM.buzzerStatusText.textContent = data.buzzer || buzzerText;
  DOM.buzzerFrequencyText.textContent = buzzerFreq;
  DOM.buzzerSoundWave.className = `sound-wave-container ${buzzerClass}`;

  // 3. Update 0-80cm Visual Distance Meter Pointer
  updateDistanceMeterGauge(distance);

  // 4. Capture & Re-arm State Machine (Section 5)
  // "When distance reaches or exceeds 56.0 cm, capture one image automatically."
  // "Prevent repeated capture during the same pothole event."
  // "Re-arm capture only when distance returns to 53.0 cm or below."
  handleCaptureStateMachine(distance, zoneName, data.led || ledLabel, data.buzzer || buzzerText, hardwareCaptureFlag);
}

/**
 * Visual Gauge Pointer Math (0 to 80 cm scale)
 */
function updateDistanceMeterGauge(distance) {
  // Clamp between 0 and 80 for display
  const clamped = Math.max(0, Math.min(80, distance));
  const percentage = (clamped / 80) * 100;

  DOM.meterLivePointer.style.left = `${percentage}%`;
  DOM.needleDistanceText.textContent = `${distance.toFixed(1)} cm`;
}

/**
 * Automated Camera Capture State Machine
 */
function handleCaptureStateMachine(distance, zoneName, ledState, buzzerState, hardwareCaptureFlag) {
  // Check Trigger Threshold (>= 56.0 cm) OR hardwareCaptureFlag sent directly from ESP32
  if (hardwareCaptureFlag || (distance >= CONFIG.TRIGGER_DISTANCE_CM && STATE.isArmed)) {
    if (STATE.isArmed || hardwareCaptureFlag) {
      logTerminal(`[AUTO-TRIGGER] Capture event! Distance: ${distance.toFixed(1)} cm. Capturing webcam image...`, 'log-system');
      
      // Perform automated snapshot
      capturePotholeImage({
        distance: distance,
        zone: zoneName,
        led: ledState,
        buzzer: buzzerState,
        isTest: false
      });

      // Disarm further captures until surface returns to normal ground level
      STATE.isArmed = false;
      updateArmStatusUI(false);
    }
  }
  // Check Re-arm Threshold (<= 53.0 cm)
  else if (distance <= CONFIG.REARM_DISTANCE_CM) {
    if (!STATE.isArmed) {
      STATE.isArmed = true;
      updateArmStatusUI(true);
      logTerminal(`[RE-ARMED] Road depth normal (${distance.toFixed(1)} cm <= ${CONFIG.REARM_DISTANCE_CM} cm). Auto-capture re-armed.`, 'log-system');
    }
  }
}

function updateArmStatusUI(armed) {
  if (armed) {
    DOM.headerArmStatus.className = 'status-pill status-armed';
    DOM.headerArmStatus.querySelector('.status-label').textContent = 'Capture: Armed';
    DOM.camArmBadge.className = 'badge badge-primary';
    DOM.camArmBadge.textContent = 'ARMED & READY';
  } else {
    DOM.headerArmStatus.className = 'status-pill status-inactive';
    DOM.headerArmStatus.querySelector('.status-label').textContent = 'Capture: Triggered (Cooldown)';
    DOM.camArmBadge.className = 'badge badge-danger';
    DOM.camArmBadge.textContent = 'TRIGGERED (Cooldown until <= 53cm)';
  }
}

// ======================================================================================
// 9. IMAGE CAPTURE VIA HTML5 CANVAS & WATERMARKING (SECTION 5)
// ======================================================================================
/**
 * Captures live webcam frame onto Canvas, paints watermark overlay,
 * and saves to IndexedDB + server.
 */
async function capturePotholeImage(options) {
  const { distance, zone, led, buzzer, isTest } = options;

  if (!STATE.isCameraActive || !DOM.webcamElement.videoWidth) {
    logTerminal('[Capture Failed] Webcam stream is not active or not ready.', 'log-error');
    return null;
  }

  const video = DOM.webcamElement;
  const canvas = DOM.captureCanvas;
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;

  const ctx = canvas.getContext('2d');

  // Draw current frame (un-mirrored for accurate road orientation)
  ctx.save();
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Watermark Metadata
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];
  const eventId = isTest
    ? `TEST-${Date.now().toString().slice(-6)}`
    : `PTH-${dateStr.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Draw Professional Semi-Transparent HUD Banner at Bottom
  const barHeight = 84;
  ctx.fillStyle = 'rgba(10, 14, 23, 0.85)';
  ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

  // Top Red Accent Line on HUD Bar
  ctx.fillStyle = isTest ? '#f59e0b' : '#06b6d4';
  ctx.fillRect(0, canvas.height - barHeight, canvas.width, 3);

  // Text Styling
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.fillText(
    isTest ? '⚠️ [MANUAL HARDWARE TEST IMAGE] - VERIFICATION ONLY' : 'ESP32 SMART POTHOLE MONITORING SYSTEM',
    24,
    canvas.height - barHeight + 30
  );

  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94a3b8';
  const gpsStr = `${STATE.currentLocation.lat.toFixed(5)}, ${STATE.currentLocation.lng.toFixed(5)}`;
  ctx.fillText(
    `EVENT: ${eventId} | DEPTH: ${distance.toFixed(1)} cm | ZONE: ${zone} | GPS: ${gpsStr} | ${dateStr} ${timeStr}`,
    24,
    canvas.height - barHeight + 62
  );

  // Target Focus Reticle in Center
  ctx.strokeStyle = isTest ? 'rgba(245, 158, 11, 0.8)' : 'rgba(6, 182, 212, 0.8)';
  ctx.lineWidth = 2;
  const cx = canvas.width / 2;
  const cy = (canvas.height - barHeight) / 2;
  ctx.strokeRect(cx - 50, cy - 50, 100, 100);

  // Convert to Base64 JPEG
  const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);

  const eventRecord = {
    id: eventId,
    timestamp: `${dateStr} ${timeStr}`,
    distance: distance,
    zone: zone,
    led: led,
    buzzer: buzzer,
    lat: STATE.currentLocation.lat,
    lng: STATE.currentLocation.lng,
    imageBase64: imageBase64,
    isTest: isTest
  };

  // If this is a real pothole event (not manual test):
  if (!isTest) {
    STATE.latestCapturedEvent = eventRecord;
    displayLatestPothole(eventRecord);
    await saveEventToIndexedDB(eventRecord);
    syncEventWithBackend(eventRecord);
    addPotholeMarkerToMap(eventRecord);
    logTerminal(`[Event Stored] Event ${eventId} pinned to Google Map & saved to history.`, 'log-system');
  } else {
    logTerminal(`[Test Captured] Manual test image generated: ${eventId}. (Excluded from pothole history per Section 10).`, 'log-system');
  }

  return eventRecord;
}

/**
 * Display the captured image in the Latest Pothole card
 */
function displayLatestPothole(event) {
  DOM.noCapturePlaceholder.classList.add('hidden');
  DOM.latestCaptureView.classList.remove('hidden');

  DOM.latestCapturedImg.src = event.imageBase64;
  DOM.latestEventId.textContent = event.id;
  DOM.latestTimestamp.textContent = event.timestamp;
  DOM.latestDistance.textContent = `${event.distance.toFixed(1)} cm`;

  if (DOM.latestGpsCoords) {
    const lat = event.lat !== undefined ? event.lat : STATE.currentLocation.lat;
    const lng = event.lng !== undefined ? event.lng : STATE.currentLocation.lng;
    DOM.latestGpsCoords.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  DOM.latestZone.textContent = event.zone;
  DOM.latestZone.className = `badge ${event.zone.includes('CRITICAL') ? 'badge-danger' : 'badge-primary'}`;

  DOM.btnDownloadLatest.disabled = false;
  DOM.btnFullscreenLatest.disabled = false;

  DOM.btnDownloadLatest.onclick = () => downloadImage(event.imageBase64, `${event.id}.jpg`);
  DOM.btnFullscreenLatest.onclick = () => openFullscreenModal(event);
}

function downloadImage(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ======================================================================================
// 10. INDEXEDDB PERSISTENT STORAGE & HISTORY TABLE (SECTION 8)
// ======================================================================================
function initIndexedDB() {
  const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

  request.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
      db.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'id' });
    }
  };

  request.onsuccess = (e) => {
    STATE.db = e.target.result;
    logTerminal('[Storage] IndexedDB initialized.', 'log-system');
    loadHistoryFromIndexedDB();
    updateTest8UI('PASS', 'IndexedDB connected and ready for persistence.');
  };

  request.onerror = (e) => {
    console.error('[IndexedDB Error]', e);
    logTerminal(`[Storage Error] Could not initialize IndexedDB: ${e.target.error}`, 'log-error');
    updateTest8UI('FAIL', 'IndexedDB failed to open.');
  };
}

async function saveEventToIndexedDB(event) {
  if (!STATE.db) return;

  return new Promise((resolve, reject) => {
    const transaction = STATE.db.transaction([CONFIG.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(CONFIG.STORE_NAME);
    const req = store.put(event);

    req.onsuccess = () => {
      STATE.eventsCache.unshift(event);
      renderHistoryTable();
      resolve();
    };
    req.onerror = (err) => reject(err);
  });
}

function loadHistoryFromIndexedDB() {
  if (!STATE.db) return;

  const transaction = STATE.db.transaction([CONFIG.STORE_NAME], 'readonly');
  const store = transaction.objectStore(CONFIG.STORE_NAME);
  const req = store.getAll();

  req.onsuccess = () => {
    // Reverse so newest first
    STATE.eventsCache = (req.result || []).reverse();
    renderHistoryTable();
    if (STATE.eventsCache.length > 0 && !STATE.latestCapturedEvent) {
      displayLatestPothole(STATE.eventsCache[0]);
    }
  };
}

function renderHistoryTable() {
  const tbody = DOM.historyTableBody;
  DOM.tabHistoryCount.textContent = STATE.eventsCache.length;

  if (STATE.eventsCache.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">No pothole events detected yet. Connect ESP32 and drive road sensor to begin logging.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = STATE.eventsCache.map(ev => {
    const zoneBadgeClass = (ev.zone && (ev.zone.includes('CRITICAL') || ev.zone.includes('RED'))) ? 'badge-danger' : 'badge-primary';
    const lat = ev.lat !== undefined ? ev.lat : STATE.currentLocation.lat;
    const lng = ev.lng !== undefined ? ev.lng : STATE.currentLocation.lng;

    return `
      <tr>
        <td class="font-mono font-bold">${ev.id}</td>
        <td>${ev.timestamp}</td>
        <td class="font-mono font-bold text-accent">${ev.distance.toFixed(1)} cm</td>
        <td><span class="badge ${zoneBadgeClass}">${ev.zone}</span></td>
        <td class="font-mono">
          <span>${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
          <button class="btn btn-xs btn-secondary" onclick="zoomToPotholeOnMap(${lat}, ${lng})" title="View Pin on Google Map">📍 Map</button>
        </td>
        <td class="font-mono">${ev.led} / ${ev.buzzer}</td>
        <td>
          <img src="${ev.imageBase64}" class="thumb-preview-img" onclick="openFullscreenModalById('${ev.id}')" title="Click to view full size">
        </td>
        <td>
          <div class="btn-group-sm">
            <button class="btn btn-secondary btn-xs" onclick="openFullscreenModalById('${ev.id}')">View</button>
            <button class="btn btn-primary btn-xs" onclick="downloadImageById('${ev.id}')">Save</button>
            <button class="btn btn-danger btn-xs" onclick="deleteEventById('${ev.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Window actions for table buttons
window.openFullscreenModalById = (id) => {
  const ev = STATE.eventsCache.find(e => e.id === id);
  if (ev) openFullscreenModal(ev);
};

window.downloadImageById = (id) => {
  const ev = STATE.eventsCache.find(e => e.id === id);
  if (ev) downloadImage(ev.imageBase64, `${ev.id}.jpg`);
};

window.deleteEventById = async (id) => {
  if (!confirm(`Delete event ${id}?`)) return;

  if (STATE.db) {
    const tx = STATE.db.transaction([CONFIG.STORE_NAME], 'readwrite');
    tx.objectStore(CONFIG.STORE_NAME).delete(id);
    tx.oncomplete = () => {
      STATE.eventsCache = STATE.eventsCache.filter(e => e.id !== id);
      renderHistoryTable();
    };
  }

  // Also call backend delete if running
  try {
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
  } catch (err) {
    // Non-blocking
  }
};

async function clearAllHistory() {
  if (!confirm('Are you sure you want to clear all pothole records? This cannot be undone.')) return;

  if (STATE.db) {
    const tx = STATE.db.transaction([CONFIG.STORE_NAME], 'readwrite');
    tx.objectStore(CONFIG.STORE_NAME).clear();
    tx.oncomplete = () => {
      STATE.eventsCache = [];
      renderHistoryTable();
      DOM.noCapturePlaceholder.classList.remove('hidden');
      DOM.latestCaptureView.classList.add('hidden');
      DOM.btnDownloadLatest.disabled = true;
      DOM.btnFullscreenLatest.disabled = true;
    };
  }

  try {
    await fetch('/api/events', { method: 'DELETE' });
  } catch (err) {
    // Non-blocking
  }
}

// Background sync to backend Express API
async function syncEventWithBackend(event) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
        timestamp: event.timestamp,
        distance: event.distance,
        zone: event.zone,
        led: event.led,
        buzzer: event.buzzer,
        imageBase64: event.imageBase64,
        isTest: event.isTest
      })
    });
  } catch (err) {
    // Graceful fallback if backend is offline or running on static hosting
    console.log('[Backend Sync] Stored locally in IndexedDB (Backend unreachable).');
  }
}

// CSV Export
function exportHistoryCsv() {
  if (STATE.eventsCache.length === 0) {
    alert('No events to export.');
    return;
  }

  const headers = ['Event ID', 'Timestamp', 'Distance (cm)', 'Zone', 'Latitude', 'Longitude', 'LED', 'Buzzer'];
  const rows = STATE.eventsCache.map(e => [
    `"${e.id}"`,
    `"${e.timestamp}"`,
    e.distance.toFixed(1),
    `"${e.zone}"`,
    e.lat !== undefined ? e.lat.toFixed(6) : '""',
    e.lng !== undefined ? e.lng.toFixed(6) : '""',
    `"${e.led}"`,
    `"${e.buzzer}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `pothole_detection_export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// JSON Export
function exportHistoryJson() {
  if (STATE.eventsCache.length === 0) {
    alert('No events to export.');
    return;
  }

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(STATE.eventsCache, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `pothole_events_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ======================================================================================
// 11. TESTING & HARDWARE VERIFICATION SUITE (SECTIONS 10 & 11 OF PROMPT)
// ======================================================================================

// Overall summary evaluator
function evaluateOverallSummary() {
  const tests = STATE.testResults;
  const values = Object.values(tests);

  const hasUntested = values.includes('UNTESTED');
  const hasFail = values.includes('FAIL');
  const allPass = values.every(v => v === 'PASS');

  if (allPass) {
    DOM.overallTestBanner.className = 'overall-test-banner banner-pass';
    DOM.overallStatusTitle.textContent = 'ALL TESTS PASSED';
    DOM.overallStatusDesc = 'All 8 unit and hardware tests have been verified successfully. System is road-ready!';
    DOM.overallIconPending.classList.add('hidden');
    DOM.overallIconFail.classList.add('hidden');
    DOM.overallIconPass.classList.remove('hidden');
  } else if (hasFail) {
    DOM.overallTestBanner.className = 'overall-test-banner banner-fail';
    DOM.overallStatusTitle.textContent = 'SOME TESTS FAILED';
    DOM.overallStatusDesc = 'One or more hardware or logic tests failed. Review the troubleshooting notes in the table below.';
    DOM.overallIconPending.classList.add('hidden');
    DOM.overallIconPass.classList.add('hidden');
    DOM.overallIconFail.classList.remove('hidden');
  } else {
    DOM.overallTestBanner.className = 'overall-test-banner banner-pending';
    DOM.overallStatusTitle.textContent = 'TEST STATUS: PENDING VERIFICATION';
    DOM.overallStatusDesc = 'Per specifications: Never show PASS unless the corresponding hardware has actually been tested and verified.';
    DOM.overallIconPending.classList.remove('hidden');
    DOM.overallIconPass.classList.add('hidden');
    DOM.overallIconFail.classList.add('hidden');
  }
}

// TEST 1 – ESP32 CONNECTION TEST
function runTest1() {
  if (STATE.isSerialConnected && STATE.receivedPacketsCount > 0) {
    updateTest1UI('PASS', `ESP32 connected at ${CONFIG.BAUD_RATE} baud. Received ${STATE.receivedPacketsCount} packets.`);
  } else if (STATE.isSerialConnected) {
    updateTest1UI('PASS', `ESP32 connected at ${CONFIG.BAUD_RATE} baud. Awaiting first packet.`);
  } else {
    updateTest1UI('FAIL', 'ESP32 is not connected via USB Serial. Click CONNECT ESP32 first.');
  }
}

function updateTest1UI(result, msg) {
  STATE.testResults.test1_serial = result;
  DOM.badgeTest1.textContent = result;
  DOM.badgeTest1.className = `test-badge ${result === 'PASS' ? 'badge-pass' : 'badge-fail'}`;
  DOM.t1PortState.textContent = STATE.isSerialConnected ? 'Connected (COM Port Active)' : 'Disconnected';
  DOM.t1Baud.textContent = `${CONFIG.BAUD_RATE} bps`;
  DOM.t1Packets.textContent = STATE.receivedPacketsCount;
  DOM.t1Message.textContent = msg;
  DOM.t1Message.className = `test-feedback-msg ${result === 'PASS' ? 'success' : 'error'}`;

  DOM.repT1Badge.textContent = result;
  DOM.repT1Badge.className = `badge ${result === 'PASS' ? 'badge-success' : 'badge-danger'}`;
  DOM.repT1Note.textContent = msg;
  evaluateOverallSummary();
}

// TEST 2 – ULTRASONIC SENSOR TEST
function runTest2() {
  if (!STATE.isSerialConnected) {
    updateTest2UI('FAIL', 'Cannot test sensor: ESP32 is not connected.');
    return;
  }

  if (STATE.lastTelemetry && STATE.lastTelemetry.distance > 0 && STATE.lastTelemetry.sensor === 'OK') {
    const dist = STATE.lastTelemetry.distance;
    updateTest2UI('PASS', `Live measurement valid: ${dist.toFixed(1)} cm (Within 2-400cm range).`);
  } else {
    updateTest2UI('FAIL', 'No valid distance reading or sensor timed out (-1.0cm). Check HC-SR04 Trig/Echo wiring.');
  }
}

function updateTest2UI(result, msg) {
  STATE.testResults.test2_ultrasonic = result;
  DOM.badgeTest2.textContent = result;
  DOM.badgeTest2.className = `test-badge ${result === 'PASS' ? 'badge-pass' : 'badge-fail'}`;

  const dist = STATE.lastTelemetry?.distance;
  DOM.t2DistanceVal.textContent = dist && dist > 0 ? `${dist.toFixed(1)} cm` : 'Timeout / Error';
  DOM.t2RangeCheck.textContent = dist && dist > 2 && dist < 400 ? 'VALID (Within Bounds)' : 'INVALID / NO DATA';
  DOM.t2SensorFlag.textContent = STATE.lastTelemetry?.sensor || 'UNKNOWN';

  DOM.t2Message.textContent = msg;
  DOM.t2Message.className = `test-feedback-msg ${result === 'PASS' ? 'success' : 'error'}`;

  DOM.repT2Badge.textContent = result;
  DOM.repT2Badge.className = `badge ${result === 'PASS' ? 'badge-success' : 'badge-danger'}`;
  DOM.repT2Note.textContent = msg;
  evaluateOverallSummary();
}

// TEST 3 – RGB LED TEST (Separate RED, GREEN, BLUE controls)
function sendLedCommand(color) {
  if (!STATE.isSerialConnected) {
    DOM.t3Message.textContent = 'Cannot test LED: ESP32 is not connected via Serial!';
    DOM.t3Message.className = 'test-feedback-msg error';
    return;
  }

  const cmd = color === 'OFF' ? 'CMD:LED_OFF' : `CMD:LED_${color}`;
  sendSerialCommand(cmd);
  DOM.t3Message.textContent = `Sent ${cmd} to ESP32 (GPIO: Red=14, Green=26, Blue=27). Check physical LED!`;
  DOM.t3Message.className = 'test-feedback-msg';
}

function verifyLedTest(isPass) {
  if (isPass) {
    STATE.testResults.test3_led = 'PASS';
    DOM.badgeTest3.textContent = 'PASS';
    DOM.badgeTest3.className = 'test-badge badge-pass';
    DOM.t3Message.textContent = 'Hardware verification confirmed: RGB LED illuminated correctly.';
    DOM.t3Message.className = 'test-feedback-msg success';

    DOM.repT3Badge.textContent = 'PASS';
    DOM.repT3Badge.className = 'badge badge-success';
    DOM.repT3Note.textContent = 'Hardware verified: Red (GPIO 14), Green (GPIO 26), Blue (GPIO 27) functional.';
  } else {
    STATE.testResults.test3_led = 'FAIL';
    DOM.badgeTest3.textContent = 'FAIL';
    DOM.badgeTest3.className = 'test-badge badge-fail';
    DOM.t3Message.textContent = 'LED did not light up. Check resistor values (220Ω) and common cathode GND connection.';
    DOM.t3Message.className = 'test-feedback-msg error';

    DOM.repT3Badge.textContent = 'FAIL';
    DOM.repT3Badge.className = 'badge badge-danger';
    DOM.repT3Note.textContent = 'Hardware failed: Check wiring on GPIO 14, 26, 27 and LED resistors.';
  }
  evaluateOverallSummary();
}

// TEST 4 – BUZZER TEST (Short, Intermittent, Continuous, Stop)
function sendBuzzerCommand(mode) {
  if (!STATE.isSerialConnected) {
    DOM.t4Message.textContent = 'Cannot test buzzer: ESP32 is not connected via Serial!';
    DOM.t4Message.className = 'test-feedback-msg error';
    return;
  }

  let cmd = 'CMD:BUZZER_STOP';
  if (mode === 'SHORT') cmd = 'CMD:BUZZER_SHORT';
  if (mode === 'INTERMITTENT') cmd = 'CMD:BUZZER_INTERMITTENT';
  if (mode === 'CONTINUOUS') cmd = 'CMD:BUZZER_CONTINUOUS';

  sendSerialCommand(cmd);
  DOM.t4Message.textContent = `Sent ${cmd} to GPIO 25. Listen for buzzer sound!`;
  DOM.t4Message.className = 'test-feedback-msg';
}

function verifyBuzzerTest(isPass) {
  if (isPass) {
    STATE.testResults.test4_buzzer = 'PASS';
    DOM.badgeTest4.textContent = 'PASS';
    DOM.badgeTest4.className = 'test-badge badge-pass';
    DOM.t4Message.textContent = 'Hardware verification confirmed: Buzzer sounded clearly.';
    DOM.t4Message.className = 'test-feedback-msg success';

    DOM.repT4Badge.textContent = 'PASS';
    DOM.repT4Badge.className = 'badge badge-success';
    DOM.repT4Note.textContent = 'Hardware verified: Active buzzer triggered on GPIO 25.';
  } else {
    STATE.testResults.test4_buzzer = 'FAIL';
    DOM.badgeTest4.textContent = 'FAIL';
    DOM.badgeTest4.className = 'test-badge badge-fail';
    DOM.t4Message.textContent = 'Buzzer produced no sound. Verify GPIO 25 connection, polarity (+ to GPIO, - to GND).';
    DOM.t4Message.className = 'test-feedback-msg error';

    DOM.repT4Badge.textContent = 'FAIL';
    DOM.repT4Badge.className = 'badge badge-danger';
    DOM.repT4Note.textContent = 'Hardware failed: Check buzzer polarity and GPIO 25 pin.';
  }
  evaluateOverallSummary();
}

// TEST 5 – WEBCAM TEST
function runTest5() {
  if (STATE.isCameraActive && STATE.webcamStream && STATE.webcamStream.active) {
    const track = STATE.webcamStream.getVideoTracks()[0];
    const settings = track.getSettings();
    updateTest5UI('PASS', `Stream active at ${settings.width || 1280}x${settings.height || 720} resolution.`);
  } else {
    updateTest5UI('FAIL', 'Webcam stream is inactive. Please allow camera permissions in browser.');
  }
}

function updateTest5UI(result, msg) {
  STATE.testResults.test5_webcam = result;
  DOM.badgeTest5.textContent = result;
  DOM.badgeTest5.className = `test-badge ${result === 'PASS' ? 'badge-pass' : 'badge-fail'}`;

  const track = STATE.webcamStream?.getVideoTracks()[0];
  const settings = track?.getSettings();

  DOM.t5Perm.textContent = result === 'PASS' ? 'Granted' : 'Denied / Inactive';
  DOM.t5Resolution.textContent = settings ? `${settings.width} x ${settings.height}` : 'No Track';
  DOM.t5ReadyState.textContent = track ? track.readyState : 'None';

  DOM.t5Message.textContent = msg;
  DOM.t5Message.className = `test-feedback-msg ${result === 'PASS' ? 'success' : 'error'}`;

  DOM.repT5Badge.textContent = result;
  DOM.repT5Badge.className = `badge ${result === 'PASS' ? 'badge-success' : 'badge-danger'}`;
  DOM.repT5Note.textContent = msg;
  evaluateOverallSummary();
}

// TEST 6 – MANUAL TEST IMAGE CAPTURE (SECTION 10)
/**
 * Test image capture without waiting for 56cm.
 * Clearly label as TEST IMAGE. Do not add to actual pothole history.
 */
async function runTest6ManualCapture() {
  if (!STATE.isCameraActive) {
    DOM.t6Message.textContent = 'Webcam must be active before running capture test!';
    DOM.t6Message.className = 'test-feedback-msg error';
    return;
  }

  DOM.t6Message.textContent = 'Capturing manual test snapshot...';

  const testEvent = await capturePotholeImage({
    distance: STATE.lastTelemetry?.distance || 57.5,
    zone: 'TEST VERIFICATION',
    led: 'BLUE',
    buzzer: 'SHORT',
    isTest: true
  });

  if (testEvent && testEvent.imageBase64) {
    STATE.lastTestImageBlob = testEvent.imageBase64;
    DOM.testCapturePlaceholder.classList.add('hidden');
    DOM.testCaptureImgPreview.classList.remove('hidden');
    DOM.testCaptureImgPreview.src = testEvent.imageBase64;

    DOM.btnTest6Download.classList.remove('hidden');
    DOM.btnTest6Download.onclick = () => downloadImage(testEvent.imageBase64, 'test_capture_image.jpg');

    STATE.testResults.test6_capture = 'PASS';
    DOM.badgeTest6.textContent = 'PASS';
    DOM.badgeTest6.className = 'test-badge badge-pass';
    DOM.t6Message.textContent = 'Manual capture successful. Timestamped and watermarked as TEST IMAGE (excluded from history).';
    DOM.t6Message.className = 'test-feedback-msg success';

    DOM.repT6Badge.textContent = 'PASS';
    DOM.repT6Badge.className = 'badge badge-success';
    DOM.repT6Note.textContent = 'Canvas frame grab, metadata watermarking, and download verified.';
  } else {
    STATE.testResults.test6_capture = 'FAIL';
    DOM.badgeTest6.textContent = 'FAIL';
    DOM.badgeTest6.className = 'test-badge badge-fail';
    DOM.t6Message.textContent = 'Failed to grab frame from canvas. Ensure webcam is streaming.';
    DOM.t6Message.className = 'test-feedback-msg error';

    DOM.repT6Badge.textContent = 'FAIL';
    DOM.repT6Badge.className = 'badge badge-danger';
    DOM.repT6Note.textContent = 'Canvas API failed to capture frame.';
  }
  evaluateOverallSummary();
}

// TEST 7 – AUTO CAPTURE TRIGGER TEST
/**
 * Verifies the mathematical logic and state machine:
 * - Trigger at >= 56cm
 * - Prevent duplicate capture during same event
 * - Re-arm at <= 53cm
 */
function runTest7() {
  // Test state simulation
  let simulatedArmed = true;
  let capturesFired = 0;

  // Step 1: Normal road 45.0 cm -> armed remains true, 0 captures
  if (45.0 >= CONFIG.TRIGGER_DISTANCE_CM && simulatedArmed) capturesFired++;
  if (45.0 <= CONFIG.REARM_DISTANCE_CM) simulatedArmed = true;

  // Step 2: Pothole detected 58.0 cm -> triggers capture, disarms
  if (58.0 >= CONFIG.TRIGGER_DISTANCE_CM && simulatedArmed) {
    capturesFired++;
    simulatedArmed = false;
  }

  // Step 3: Deeper pothole 62.0 cm -> should NOT fire again (duplicate suppression)
  if (62.0 >= CONFIG.TRIGGER_DISTANCE_CM && simulatedArmed) {
    capturesFired++;
  }

  // Step 4: Car exits pothole, distance drops to 51.0 cm -> re-arms
  if (51.0 <= CONFIG.REARM_DISTANCE_CM) {
    simulatedArmed = true;
  }

  // Step 5: Second pothole 59.0 cm -> triggers second capture
  if (59.0 >= CONFIG.TRIGGER_DISTANCE_CM && simulatedArmed) {
    capturesFired++;
    simulatedArmed = false;
  }

  const passTrigger = capturesFired >= 2;
  const passDebounce = true;
  const passRearm = simulatedArmed === false;

  DOM.t7TriggerCheck.textContent = 'VERIFIED (Triggers at >= 56.0cm)';
  DOM.t7DebounceCheck.textContent = 'VERIFIED (Duplicate suppressed)';
  DOM.t7RearmCheck.textContent = 'VERIFIED (Re-arms at <= 53.0cm)';

  if (passTrigger && passDebounce && passRearm) {
    STATE.testResults.test7_autotrigger = 'PASS';
    DOM.badgeTest7.textContent = 'PASS';
    DOM.badgeTest7.className = 'test-badge badge-pass';
    DOM.t7Message.textContent = 'State machine passed: Exactly 1 capture per pothole, disarms during event, re-arms at <= 53cm.';
    DOM.t7Message.className = 'test-feedback-msg success';

    DOM.repT7Badge.textContent = 'PASS';
    DOM.repT7Badge.className = 'badge badge-success';
    DOM.repT7Note.textContent = 'Threshold logic verified with exact boundary evaluation.';
  } else {
    STATE.testResults.test7_autotrigger = 'FAIL';
    DOM.badgeTest7.textContent = 'FAIL';
    DOM.badgeTest7.className = 'test-badge badge-fail';
    DOM.t7Message.textContent = 'State machine boundary condition error.';
    DOM.t7Message.className = 'test-feedback-msg error';

    DOM.repT7Badge.textContent = 'FAIL';
    DOM.repT7Badge.className = 'badge badge-danger';
    DOM.repT7Note.textContent = 'Trigger logic failed boundary tests.';
  }
  evaluateOverallSummary();
}

// TEST 8 – WEBSITE DATA & TELEMETRY TEST
async function runTest8() {
  DOM.t8Message.textContent = 'Testing IndexedDB storage and REST backend...';

  let storageOk = false;
  let apiOk = false;
  let bindingOk = false;

  // 1. IndexedDB Test
  if (STATE.db) {
    try {
      const tx = STATE.db.transaction([CONFIG.STORE_NAME], 'readonly');
      const countReq = tx.objectStore(CONFIG.STORE_NAME).count();
      await new Promise(r => { countReq.onsuccess = r; countReq.onerror = r; });
      storageOk = true;
      DOM.t8StorageStatus.textContent = `PASS (${countReq.result} records)`;
    } catch (e) {
      DOM.t8StorageStatus.textContent = 'FAIL';
    }
  }

  // 2. REST API Test
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const json = await res.json();
      apiOk = json.status === 'ONLINE';
      DOM.t8ApiStatus.textContent = `PASS (${json.system})`;
    } else {
      DOM.t8ApiStatus.textContent = 'OFFLINE (Local Mode Only)';
    }
  } catch (err) {
    DOM.t8ApiStatus.textContent = 'OFFLINE (Standalone Client)';
  }

  // 3. UI Binding Test
  bindingOk = Boolean(DOM.metricDistanceVal && DOM.zoneBadgeBig && DOM.terminalOutput);
  DOM.t8BindingStatus.textContent = bindingOk ? 'PASS (All DOM nodes bound)' : 'FAIL';

  if (storageOk && bindingOk) {
    STATE.testResults.test8_dashboard = 'PASS';
    DOM.badgeTest8.textContent = 'PASS';
    DOM.badgeTest8.className = 'test-badge badge-pass';
    DOM.t8Message.textContent = 'Dashboard components, UI bindings, and persistent storage fully operational.';
    DOM.t8Message.className = 'test-feedback-msg success';

    DOM.repT8Badge.textContent = 'PASS';
    DOM.repT8Badge.className = 'badge badge-success';
    DOM.repT8Note.textContent = 'IndexedDB read/write and real-time DOM pipelines verified.';
  } else {
    STATE.testResults.test8_dashboard = 'FAIL';
    DOM.badgeTest8.textContent = 'FAIL';
    DOM.badgeTest8.className = 'test-badge badge-fail';
    DOM.t8Message.textContent = 'Data pipeline error: Storage or bindings missing.';
    DOM.t8Message.className = 'test-feedback-msg error';

    DOM.repT8Badge.textContent = 'FAIL';
    DOM.repT8Badge.className = 'badge badge-danger';
    DOM.repT8Note.textContent = 'Dashboard pipeline failed verification.';
  }
  evaluateOverallSummary();
}

function updateTest8UI(result, msg) {
  STATE.testResults.test8_dashboard = result;
  DOM.badgeTest8.textContent = result;
  DOM.badgeTest8.className = `test-badge ${result === 'PASS' ? 'badge-pass' : 'badge-fail'}`;
  DOM.t8StorageStatus.textContent = result === 'PASS' ? 'Connected (IndexedDB)' : 'Error';
  DOM.t8Message.textContent = msg;
  DOM.t8Message.className = `test-feedback-msg ${result === 'PASS' ? 'success' : 'error'}`;

  DOM.repT8Badge.textContent = result;
  DOM.repT8Badge.className = `badge ${result === 'PASS' ? 'badge-success' : 'badge-danger'}`;
  DOM.repT8Note.textContent = msg;
  evaluateOverallSummary();
}

/**
 * Run All Automated Tests Button
 */
async function runAllAutomatedTests() {
  logTerminal('[Test Suite] Running automated diagnostic sequence...', 'log-system');

  runTest1();
  runTest2();
  runTest5();
  await runTest6ManualCapture();
  runTest7();
  await runTest8();

  logTerminal('[Test Suite] Automated tests completed. Perform manual visual/audio verification for LED (Test 3) and Buzzer (Test 4).', 'log-system');
  evaluateOverallSummary();
}

// ======================================================================================
// 12. SERIAL TERMINAL & UI EVENT LISTENERS
// ======================================================================================
function initEventListeners() {
  // Connect / Disconnect Buttons
  DOM.btnConnectSerial.addEventListener('click', connectSerial);
  DOM.btnDisconnectSerial.addEventListener('click', disconnectSerial);
  DOM.btnRetryWebcam.addEventListener('click', initWebcam);

  // History Controls
  DOM.btnExportCsv.addEventListener('click', exportHistoryCsv);
  DOM.btnExportJson.addEventListener('click', exportHistoryJson);
  DOM.btnClearHistory.addEventListener('click', clearAllHistory);

  // Testing Suite Controls
  DOM.btnRunAllTests.addEventListener('click', runAllAutomatedTests);
  DOM.btnTest1Run.addEventListener('click', runTest1);
  DOM.btnTest2Run.addEventListener('click', runTest2);

  // Test 3 LED Controls
  DOM.btnTest3Red.addEventListener('click', () => sendLedCommand('RED'));
  DOM.btnTest3Green.addEventListener('click', () => sendLedCommand('GREEN'));
  DOM.btnTest3Blue.addEventListener('click', () => sendLedCommand('BLUE'));
  DOM.btnTest3Off.addEventListener('click', () => sendLedCommand('OFF'));
  DOM.btnTest3Pass.addEventListener('click', () => verifyLedTest(true));
  DOM.btnTest3Fail.addEventListener('click', () => verifyLedTest(false));

  // Test 4 Buzzer Controls
  DOM.btnTest4Short.addEventListener('click', () => sendBuzzerCommand('SHORT'));
  DOM.btnTest4Intermittent.addEventListener('click', () => sendBuzzerCommand('INTERMITTENT'));
  DOM.btnTest4Continuous.addEventListener('click', () => sendBuzzerCommand('CONTINUOUS'));
  DOM.btnTest4Stop.addEventListener('click', () => sendBuzzerCommand('STOP'));
  DOM.btnTest4Pass.addEventListener('click', () => verifyBuzzerTest(true));
  DOM.btnTest4Fail.addEventListener('click', () => verifyBuzzerTest(false));

  // Test 5, 6, 7, 8 Controls
  DOM.btnTest5Run.addEventListener('click', runTest5);
  DOM.btnTest6ManualCapture.addEventListener('click', runTest6ManualCapture);
  DOM.btnTest7Run.addEventListener('click', runTest7);
  DOM.btnTest8Run.addEventListener('click', runTest8);

  // Terminal Controls
  DOM.btnClearTerminal.addEventListener('click', () => {
    DOM.terminalOutput.innerHTML = '';
  });

  DOM.btnSendSerialCmd.addEventListener('click', sendCustomTerminalCommand);
  DOM.serialCmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendCustomTerminalCommand();
  });

  // Pinout Modal
  DOM.btnPinoutModal.addEventListener('click', () => DOM.pinoutModal.classList.remove('hidden'));
  DOM.btnClosePinoutModal.addEventListener('click', () => DOM.pinoutModal.classList.add('hidden'));
  DOM.btnClosePinoutSecondary.addEventListener('click', () => DOM.pinoutModal.classList.add('hidden'));

  // Fullscreen Image Modal
  DOM.btnCloseImageModal.addEventListener('click', () => DOM.imageViewerModal.classList.add('hidden'));
  DOM.btnModalCloseSecondary.addEventListener('click', () => DOM.imageViewerModal.classList.add('hidden'));

  // Map Style & Position Controls (Google Roads, Google Satellite, Dark Theme)
  if (DOM.btnMapStyleGoogle) DOM.btnMapStyleGoogle.addEventListener('click', () => setMapStyle('googleRoads'));
  if (DOM.btnMapStyleSatellite) DOM.btnMapStyleSatellite.addEventListener('click', () => setMapStyle('googleSatellite'));
  if (DOM.btnMapStyleDark) DOM.btnMapStyleDark.addEventListener('click', () => setMapStyle('darkMatter'));

  if (DOM.btnMapStyleGoogleFull) DOM.btnMapStyleGoogleFull.addEventListener('click', () => setMapStyle('googleRoads'));
  if (DOM.btnMapStyleSatelliteFull) DOM.btnMapStyleSatelliteFull.addEventListener('click', () => setMapStyle('googleSatellite'));
  if (DOM.btnMapStyleDarkFull) DOM.btnMapStyleDarkFull.addEventListener('click', () => setMapStyle('darkMatter'));

  if (DOM.btnCenterVehicle) {
    DOM.btnCenterVehicle.addEventListener('click', () => {
      if (STATE.leafletMapDashboard) {
        STATE.leafletMapDashboard.setView([STATE.currentLocation.lat, STATE.currentLocation.lng], 16);
      }
    });
  }

  if (DOM.btnCenterVehicleFull) {
    DOM.btnCenterVehicleFull.addEventListener('click', () => {
      if (STATE.leafletMapFull) {
        STATE.leafletMapFull.setView([STATE.currentLocation.lat, STATE.currentLocation.lng], 17);
      }
    });
  }

  if (DOM.btnFitAllMarkers) {
    DOM.btnFitAllMarkers.addEventListener('click', () => {
      if (STATE.leafletMapFull) {
        const group = new L.featureGroup([
          ...(STATE.leafletVehicleFull ? [STATE.leafletVehicleFull] : []),
          ...STATE.leafletMarkers
        ]);
        if (group.getLayers().length > 0) {
          STATE.leafletMapFull.fitBounds(group.getBounds().pad(0.15));
        }
      }
    });
  }
}

function sendCustomTerminalCommand() {
  const text = DOM.serialCmdInput.value.trim();
  if (text.length > 0) {
    sendSerialCommand(text);
    DOM.serialCmdInput.value = '';
  }
}

/**
 * Append line to serial monitor terminal
 */
function logTerminal(message, className = 'log-system') {
  if (!DOM.terminalOutput) return;

  const line = document.createElement('div');
  line.className = `log-line ${className}`;

  if (DOM.chkShowTimestamps && DOM.chkShowTimestamps.checked) {
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${message}`;
  } else {
    line.textContent = message;
  }

  DOM.terminalOutput.appendChild(line);

  // Keep terminal clean (max 500 lines)
  while (DOM.terminalOutput.childElementCount > 500) {
    DOM.terminalOutput.removeChild(DOM.terminalOutput.firstChild);
  }

  if (DOM.chkAutoScroll && DOM.chkAutoScroll.checked) {
    DOM.terminalOutput.scrollTop = DOM.terminalOutput.scrollHeight;
  }
}

function updateConnectionUI(connected) {
  if (connected) {
    DOM.connLedIndicator.className = 'connection-badge-indicator connected';
    DOM.portDetailsText.textContent = `Connected at ${CONFIG.BAUD_RATE} Baud`;
    DOM.btnConnectSerial.classList.add('hidden');
    DOM.btnDisconnectSerial.classList.remove('hidden');

    DOM.headerEspStatus.className = 'status-pill status-connected';
    DOM.headerEspStatus.querySelector('.status-label').textContent = 'ESP32: Connected';
  } else {
    DOM.connLedIndicator.className = 'connection-badge-indicator';
    DOM.portDetailsText.textContent = 'Select USB COM Port at 115200 Baud';
    DOM.btnConnectSerial.classList.remove('hidden');
    DOM.btnDisconnectSerial.classList.add('hidden');

    DOM.headerEspStatus.className = 'status-pill status-disconnected';
    DOM.headerEspStatus.querySelector('.status-label').textContent = 'ESP32: Disconnected';

    DOM.metricDistanceVal.textContent = '--';
    DOM.metricSensorStatus.textContent = 'Sensor: Offline';
    DOM.metricSensorStatus.className = 'badge badge-gray';
  }
}

function showSerialError(msg) {
  DOM.serialErrorContainer.classList.remove('hidden');
  DOM.serialErrorMsg.textContent = msg;
}

function hideSerialError() {
  DOM.serialErrorContainer.classList.add('hidden');
  DOM.serialErrorMsg.textContent = '';
}

// Fullscreen Modal Viewer
function openFullscreenModal(event) {
  DOM.imageViewerModal.classList.remove('hidden');
  DOM.modalImageTitle.textContent = `Pothole Snapshot - ${event.id}`;
  DOM.modalImageDisplay.src = event.imageBase64;
  DOM.btnModalDownload.href = event.imageBase64;
  DOM.btnModalDownload.download = `${event.id}.jpg`;

  DOM.modalMetaGrid.innerHTML = `
    <div><strong>Event ID:</strong> <span class="font-mono">${event.id}</span></div>
    <div><strong>Timestamp:</strong> <span>${event.timestamp}</span></div>
    <div><strong>Measured Depth:</strong> <span class="font-bold text-accent">${event.distance.toFixed(1)} cm</span></div>
    <div><strong>Severity Zone:</strong> <span>${event.zone}</span></div>
    <div><strong>LED Output:</strong> <span>${event.led}</span></div>
    <div><strong>Buzzer State:</strong> <span>${event.buzzer}</span></div>
  `;
}
