// Detect how much localStorage the website is using
// and log it to the console.
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

//byteValueNumberFormatter.format(),

const canvasElements = document.getElementsByTagName("canvas");

// CANVAS FINGERPRINTING
// https://github.com/freethenation/DFPM

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  sendResponse({
    localStorageUsage: size,
    canvasElements: canvasElements.length,
    cookieCount,
    cookies: cookies,
  });
  return true;
});

/*
const root = document.createElement("div");
root.id = "crx-root";
document.body.append(root);

createRoot(document.getElementById("crx-root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
*/
