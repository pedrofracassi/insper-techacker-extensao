export interface CookieData {
  name: string;
  value: string;
  attributes: Record<string, string | boolean>;
  source: "request" | "response";
  firstSeen: number;
  lastSeen: number;
  requestCount?: number;
}

export interface TabData {
  domains: Set<string>;
  cookies: Map<string, Map<string, CookieData>>; // domain -> cookieName -> cookieData
}

export interface ThirdPartyData {
  domains: string[];
  cookies: Record<string, Record<string, CookieData>>;
}

export interface GetThirdPartyDataMessage {
  action: "getThirdPartyData";
  tabId: number;
}

class ThirdPartyDetector {
  private tabsData: Map<number, TabData> = new Map();

  constructor() {
    this.initializeListeners();
  }

  private initializeListeners(): void {
    chrome.webRequest.onBeforeRequest.addListener(
      this.handleRequest.bind(this),
      { urls: ["<all_urls>"] }
    );

    chrome.webRequest.onBeforeSendHeaders.addListener(
      this.handleRequestHeaders.bind(this),
      { urls: ["<all_urls>"] },
      ["requestHeaders"]
    );

    chrome.webRequest.onHeadersReceived.addListener(
      this.handleResponseHeaders.bind(this),
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );

    chrome.tabs.onRemoved.addListener(this.handleTabRemoval.bind(this));
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  private getDomain(url: string): string | null {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  private isThirdParty(
    requestDomain: string | null,
    tabDomain: string | null
  ): boolean {
    if (!requestDomain || !tabDomain) return false;

    console.log(chrome.runtime.id);

    if (chrome.runtime.id === requestDomain) return false;

    const getBaseDomain = (domain: string): string => {
      const parts = domain.split(".");
      return parts.slice(parts.length > 2 ? parts.length - 2 : 0).join(".");
    };

    return getBaseDomain(requestDomain) !== getBaseDomain(tabDomain);
  }

  private getTabData(tabId: number): TabData {
    if (!this.tabsData.has(tabId)) {
      this.tabsData.set(tabId, {
        domains: new Set<string>(),
        cookies: new Map(),
      });
    }
    return this.tabsData.get(tabId)!;
  }

  private getDomainCookies(
    tabData: TabData,
    domain: string
  ): Map<string, CookieData> {
    if (!tabData.cookies.has(domain)) {
      tabData.cookies.set(domain, new Map());
    }
    return tabData.cookies.get(domain)!;
  }

  private handleRequest(details: chrome.webRequest.WebRequestDetails): void {
    if (details.type === "main_frame") return;

    const tabDomain = this.getDomain(details.initiator || "");
    const requestDomain = this.getDomain(details.url);

    if (this.isThirdParty(requestDomain, tabDomain) && requestDomain) {
      const tabData = this.getTabData(details.tabId);
      tabData.domains.add(requestDomain);
    }
  }

  private parseRequestCookies(cookieHeader: string): Array<[string, string]> {
    return cookieHeader.split(";").map((cookie) => {
      const [name, value] = cookie
        .trim()
        .split("=")
        .map((s) => s.trim());
      return [name, value];
    });
  }

  private handleRequestHeaders(
    details: chrome.webRequest.WebRequestHeadersDetails
  ): void {
    const tabDomain = this.getDomain(details.initiator || "");
    const requestDomain = this.getDomain(details.url);

    if (
      this.isThirdParty(requestDomain, tabDomain) &&
      requestDomain &&
      details.requestHeaders
    ) {
      const cookieHeaders = details.requestHeaders.filter(
        (header) => header.name.toLowerCase() === "cookie"
      );

      if (cookieHeaders.length) {
        const tabData = this.getTabData(details.tabId);
        const domainCookies = this.getDomainCookies(tabData, requestDomain);

        cookieHeaders.forEach((header) => {
          if (header.value) {
            const cookies = this.parseRequestCookies(header.value);
            cookies.forEach(([name, value]) => {
              const existing = domainCookies.get(name);
              if (existing) {
                existing.lastSeen = Date.now();
                existing.requestCount = (existing.requestCount || 0) + 1;
                domainCookies.set(name, existing);
              } else {
                domainCookies.set(name, {
                  name,
                  value,
                  attributes: {},
                  source: "request",
                  firstSeen: Date.now(),
                  lastSeen: Date.now(),
                  requestCount: 1,
                });
              }
            });
          }
        });
      }
    }
  }

  private parseCookie(cookieStr: string): CookieData | null {
    try {
      const parts = cookieStr.split(";");
      const [nameValue, ...attributes] = parts;
      const [name, value] = nameValue.split("=").map((s) => s.trim());

      const cookie: CookieData = {
        name,
        value,
        attributes: {},
        source: "response",
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      };

      attributes.forEach((attr) => {
        const [key, val] = attr
          .trim()
          .split("=")
          .map((s) => s.trim());
        cookie.attributes[key.toLowerCase()] = val || true;
      });

      return cookie;
    } catch {
      return null;
    }
  }

  private handleResponseHeaders(
    details: chrome.webRequest.WebResponseHeadersDetails
  ): void {
    const tabDomain = this.getDomain(details.initiator || "");
    const requestDomain = this.getDomain(details.url);

    if (
      this.isThirdParty(requestDomain, tabDomain) &&
      requestDomain &&
      details.responseHeaders
    ) {
      const setCookieHeaders = details.responseHeaders.filter(
        (header) => header.name.toLowerCase() === "set-cookie"
      );

      if (setCookieHeaders.length) {
        const tabData = this.getTabData(details.tabId);
        const domainCookies = this.getDomainCookies(tabData, requestDomain);

        setCookieHeaders.forEach((header) => {
          if (header.value) {
            const cookieData = this.parseCookie(header.value);
            if (cookieData) {
              const existing = domainCookies.get(cookieData.name);
              if (existing) {
                cookieData.firstSeen = existing.firstSeen;
                cookieData.requestCount = existing.requestCount;
              }
              domainCookies.set(cookieData.name, cookieData);
            }
          }
        });
      }
    }
  }

  private handleTabRemoval(tabId: number): void {
    this.tabsData.delete(tabId);
  }

  private handleMessage(
    message: GetThirdPartyDataMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ThirdPartyData) => void
  ): boolean {
    if (message.action === "getThirdPartyData") {
      const tabData = this.tabsData.get(message.tabId) || {
        domains: new Set<string>(),
        cookies: new Map(),
      };

      const cookiesObj: Record<string, Record<string, CookieData>> = {};
      tabData.cookies.forEach((cookies, domain) => {
        cookiesObj[domain] = Object.fromEntries(cookies);
      });

      sendResponse({
        domains: Array.from(tabData.domains),
        cookies: cookiesObj,
      });
    }
    return true;
  }
}

new ThirdPartyDetector();
