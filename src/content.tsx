// Utility function to detect common canvas fingerprinting patterns
function detectCanvasFingerprinting(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  // Track canvas operations that are commonly used in fingerprinting
  let operations = {
    text: false,
    gradient: false,
    imageData: false,
    readback: false,
  };

  // Wrap canvas methods to detect fingerprinting patterns
  const originalFillText = ctx.fillText;
  const originalGetImageData = ctx.getImageData;
  const originalToDataURL = canvas.toDataURL;
  const originalCreateLinearGradient = ctx.createLinearGradient;

  ctx.fillText = function (...args) {
    operations.text = true;
    return originalFillText.apply(this, args);
  };

  ctx.getImageData = function (...args) {
    operations.imageData = true;
    return originalGetImageData.apply(this, args);
  };

  canvas.toDataURL = function (...args) {
    operations.readback = true;
    return originalToDataURL.apply(this, args);
  };

  ctx.createLinearGradient = function (...args) {
    operations.gradient = true;
    return originalCreateLinearGradient.apply(this, args);
  };

  return operations;
}

// Main script
const storage = window.localStorage;
const size = new TextEncoder().encode(JSON.stringify(storage)).length - 2;

const byteValueNumberFormatter = Intl.NumberFormat("en", {
  notation: "compact",
  style: "unit",
  unit: "byte",
  unitDisplay: "narrow",
});

const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
const cookieCount = cookies.length;

// Track canvas elements and their behavior
const canvasElements = document.getElementsByTagName("canvas");
const canvasFingerprinting = Array.from(canvasElements).map((canvas, index) => {
  return {
    id: canvas.id || `canvas-${index}`,
    size: {
      width: canvas.width,
      height: canvas.height,
    },
    operations: detectCanvasFingerprinting(canvas),
    hidden:
      !canvas.offsetParent || // Check if canvas is hidden
      window.getComputedStyle(canvas).visibility === "hidden" ||
      window.getComputedStyle(canvas).display === "none",
    attributes: {
      willReadFrequently:
        canvas.getContext("2d", { willReadFrequently: true }) !== null,
    },
  };
});

// Monitor new canvas elements being added
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.tagName === "CANVAS") {
        const index = canvasFingerprinting.length;
        canvasFingerprinting.push({
          id: node.id || `canvas-${index}`,
          size: {
            width: node.width,
            height: node.height,
          },
          operations: detectCanvasFingerprinting(node),
          hidden:
            !node.offsetParent ||
            window.getComputedStyle(node).visibility === "hidden" ||
            window.getComputedStyle(node).display === "none",
          attributes: {
            willReadFrequently:
              node.getContext("2d", { willReadFrequently: true }) !== null,
          },
        });
      }
    });
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const fingerprintingScore = canvasFingerprinting.reduce((score, canvas) => {
    const ops = canvas.operations;
    return (
      score +
      ((ops.text ? 1 : 0) +
        (ops.gradient ? 1 : 0) +
        (ops.imageData ? 1 : 0) +
        (ops.readback ? 1 : 0) +
        (canvas.hidden ? 2 : 0)) // Hidden canvas is suspicious
    );
  }, 0);

  sendResponse({
    localStorageUsage: size,
    canvasElements: canvasElements.length,
    cookieCount,
    cookies: cookies,
    canvasFingerprinting: {
      details: canvasFingerprinting,
      suspiciousScore: fingerprintingScore,
      potentialFingerprinting: fingerprintingScore > 3,
    },
  });
  return true;
});
