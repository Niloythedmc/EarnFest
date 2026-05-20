/**
 * Frontend Device Fingerprinting Utility
 * Generates a device fingerprint based on browser/device characteristics
 * Used for anti-autoclicker and multi-account detection
 */

/**
 * Generate a device fingerprint
 * Combines multiple browser/device characteristics into a hash-like string
 * @returns {string} Device fingerprint identifier
 */
export function generateDeviceFingerprint() {
  const components = [];

  // User Agent
  components.push(navigator.userAgent);

  // Language
  components.push(navigator.language);

  // Timezone offset
  components.push(new Date().getTimezoneOffset().toString());

  // Screen resolution
  components.push(`${window.screen.width}x${window.screen.height}`);

  // Color depth
  components.push(window.screen.colorDepth.toString());

  // Hardware concurrency (CPU cores)
  components.push((navigator.hardwareConcurrency || 'unknown').toString());

  // Device memory if available
  components.push((navigator.deviceMemory || 'unknown').toString());

  // Platform
  components.push(navigator.platform);

  // Local storage available
  components.push((isLocalStorageAvailable() ? '1' : '0'));

  // Session storage available
  components.push((isSessionStorageAvailable() ? '1' : '0'));

  // WebGL info
  components.push(getWebGLInfo());

  // Combine all components
  const fingerprintString = components.join('::');

  // Simple hash function (not cryptographic, just for consistency)
  return simpleHash(fingerprintString);
}

/**
 * Check if local storage is available
 */
function isLocalStorageAvailable() {
  try {
    const test = '__test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if session storage is available
 */
function isSessionStorageAvailable() {
  try {
    const test = '__test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get WebGL fingerprint
 */
function getWebGLInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return 'none';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'webgl';

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

    return `${vendor}::${renderer}`.substring(0, 50);
  } catch (e) {
    return 'error';
  }
}

/**
 * Simple hash function for fingerprinting
 * Creates a shortened identifier from a string
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Get device information for sending to backend
 */
export function getDeviceInfo() {
  return {
    deviceFingerprint: generateDeviceFingerprint(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: navigator.platform,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
  };
}

/**
 * Store device fingerprint in session storage
 */
export function storeDeviceFingerprint() {
  try {
    const fingerprint = generateDeviceFingerprint();
    sessionStorage.setItem('deviceFingerprint', fingerprint);
    return fingerprint;
  } catch (e) {
    console.warn('[DeviceFingerprint] Failed to store fingerprint:', e);
    return generateDeviceFingerprint();
  }
}

/**
 * Get stored device fingerprint or generate new one
 */
export function getStoredDeviceFingerprint() {
  try {
    let fingerprint = sessionStorage.getItem('deviceFingerprint');
    if (!fingerprint) {
      fingerprint = storeDeviceFingerprint();
    }
    return fingerprint;
  } catch (e) {
    return generateDeviceFingerprint();
  }
}
