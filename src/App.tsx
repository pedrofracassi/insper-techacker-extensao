import { useEffect, useState } from "react";
import "./index.css";
import Twemoji from "react-twemoji";
import { CookieData } from "./background";

interface CanvasOperations {
  text: boolean;
  gradient: boolean;
  imageData: boolean;
  readback: boolean;
}

interface CanvasSize {
  width: number;
  height: number;
}

interface CanvasAttributes {
  willReadFrequently: boolean;
}

interface CanvasDetails {
  id: string;
  size: CanvasSize;
  operations: CanvasOperations;
  hidden: boolean;
  attributes: CanvasAttributes;
}

interface CanvasFingerprintingInfo {
  details: CanvasDetails[];
  suspiciousScore: number;
  potentialFingerprinting: boolean;
}

interface DetectionResponse {
  localStorageUsage: number;
  canvasElements: number;
  cookieCount: number;
  cookies: string[];
  canvasFingerprinting: CanvasFingerprintingInfo;
}

// Type for the message listener callback
type SendResponseCallback = (response: DetectionResponse) => void;

const byteValueNumberFormatter = Intl.NumberFormat("en", {
  notation: "compact",
  style: "unit",
  unit: "byte",
  unitDisplay: "narrow",
});

const cookieCategoryMappings = {
  Advertising: "Anúncios",
  Analytics: "Analytics",
  Essential: "Essencial",
  Functional: "Funcional",
  Marketing: "Marketing",
  Performance: "Performance",
  Personalization: "Personalização",
  Statistics: "Estatísticas",
  Unclassified: "Não classificado",
  Other: "Outros",
};

function calculatePrivacyScore(
  data: DetectionResponse,
  thirdPartyDomains: string[],
  thirdPartyCookies: Record<string, CookieData>,
  commonlyBlockedDomains: string[],
  cookieDatabase: any[]
) {
  let score = 0;
  const details: Record<string, number> = {};

  const localStorageScore = Math.min(
    10,
    (data?.localStorageUsage / 1024) * 0.5
  );
  details.localStorage = localStorageScore;

  let firstPartyCookieScore = 0;
  data?.cookies.forEach((cookie) => {
    const cookieName = cookie.split("=")[0];
    const cookieData = cookieDatabase.find((c) => c.name === cookieName);

    let cookieScore = 1;

    if (cookieData) {
      switch (cookieData.category) {
        case "Marketing":
        case "Advertising":
          cookieScore = 3;
          break;
        case "Analytics":
        case "Statistics":
          cookieScore = 2;
          break;
      }
    }
    firstPartyCookieScore += cookieScore;
  });
  details.firstPartyCookies = Math.min(15, firstPartyCookieScore);

  let thirdPartyCookieScore = 0;
  Object.entries(thirdPartyCookies).forEach(([domain, cookieData]) => {
    const cookieInfo = cookieDatabase.find((c) => c.name === cookieData.name);

    let cookieScore = 2;

    if (cookieInfo) {
      switch (cookieInfo.category) {
        case "Marketing":
        case "Advertising":
          cookieScore = 5;
          break;
        case "Analytics":
        case "Statistics":
          cookieScore = 4;
          break;
      }
    }
    thirdPartyCookieScore += cookieScore;
  });
  details.thirdPartyCookies = Math.min(20, thirdPartyCookieScore);

  // Canvas Fingerprinting Score (15 points if detected)
  const canvasFingerprintingScore = data?.canvasFingerprinting
    .potentialFingerprinting
    ? 15
    : 0;
  details.canvasFingerprinting = canvasFingerprintingScore;

  // Third-party Domains Score (1 point per domain, 3 points if in blocklist, max 40 points)
  let thirdPartyDomainScore = 0;
  thirdPartyDomains.forEach((domain) => {
    thirdPartyDomainScore += commonlyBlockedDomains.includes(domain) ? 3 : 1;
  });
  details.thirdPartyDomains = Math.min(40, thirdPartyDomainScore);

  score = Object.values(details).reduce((a, b) => a + b, 0);
  return {
    total: Math.round(score),
    details,
    cookieBreakdown: {
      marketing: data?.cookies.filter((c) => {
        const cookieName = c.split("=")[0];
        const cookieData = cookieDatabase.find((cd) => cd.name === cookieName);
        return (
          cookieData?.category === "Marketing" ||
          cookieData?.category === "Advertising"
        );
      }).length,
      analytics: data?.cookies.filter((c) => {
        const cookieName = c.split("=")[0];
        const cookieData = cookieDatabase.find((cd) => cd.name === cookieName);
        return (
          cookieData?.category === "Analytics" ||
          cookieData?.category === "Statistics"
        );
      }).length,
      other: data?.cookies.filter((c) => {
        const cookieName = c.split("=")[0];
        const cookieData = cookieDatabase.find((cd) => cd.name === cookieName);
        return (
          !cookieData ||
          (cookieData.category !== "Marketing" &&
            cookieData.category !== "Advertising" &&
            cookieData.category !== "Analytics" &&
            cookieData.category !== "Statistics")
        );
      }).length,
    },
  };
}

function getScoreColor(score: number): string {
  if (score <= 20) return "bg-green-500";
  if (score <= 40) return "bg-yellow-500";
  if (score <= 60) return "bg-orange-500";
  return "bg-red-500";
}

function getScoreDescription(score: number): string {
  if (score <= 20) return "Boa privacidade";
  if (score <= 40) return "Privacidade moderada";
  if (score <= 60) return "Privacidade baixa";
  return "Privacidade muito baixa";
}

function App() {
  const [receivedData, setReceivedData] = useState<DetectionResponse>();
  const [thirdPartyDomains, setThirdPartyDomains] = useState([]);
  const [thirdPartyCookies, setThirdPartyCookies] = useState<
    Record<string, CookieData>
  >({});
  const [messagesReceived, setMessagesReceived] = useState(false);
  const [cookieDatabase, setCookieDatabase] = useState([]);
  const [commonlyBlockedDomains, setCommonlyBlockedDomains] = useState<
    string[]
  >([]);
  const [privacyScore, setPrivacyScore] = useState({ total: 0, details: {} });

  useEffect(() => {
    if (receivedData && messagesReceived) {
      const score = calculatePrivacyScore(
        receivedData,
        thirdPartyDomains,
        thirdPartyCookies,
        commonlyBlockedDomains,
        cookieDatabase
      );
      setPrivacyScore(score);
    }
  }, [
    receivedData,
    thirdPartyDomains,
    thirdPartyCookies,
    commonlyBlockedDomains,
    messagesReceived,
    cookieDatabase,
  ]);

  useEffect(() => {
    fetch("https://big.oisd.nl/")
      .then((response) => response.text())
      .then((text) => {
        // Parse the text file, it's ABP format
        /*
        ||0265331.com^
        ||027dir.com^
        ||027f8ac71a.5b4ed922fe.com^
        ||0281.jp^
        ||029mxhs.cn^
        ||02aa19117f396e9.com^
        ||02asdf.com^
        ||02b7485.netsolhost.com^
        ||02ce917efd.com^
        ||02coverlab.com^
        ||02f.info^
        */
        const lines = text.split("\n");
        const domains = lines
          .filter((line) => !line.startsWith("!"))
          .map((line) => line.trim())
          .map((line) => line.replace("||", "").replace("^", ""));
        setCommonlyBlockedDomains(domains);
      });
  }, []);

  useEffect(() => {
    // https://cdn.jsdelivr.net/gh/jkwakman/Open-Cookie-Database/open-cookie-database.csv
    // ID,Platform,Category,Cookie / Data Key name,Domain,Description,Retention period,Data Controller,User Privacy & GDPR Rights Portals,Wildcard match

    const headerMappings = {
      "Cookie / Data Key name": "name",
      Domain: "domain",
      Platform: "platform",
      Category: "category",
      Description: "description",
      "Retention period": "retention",
      "Data Controller": "controller",
      "User Privacy & GDPR Rights Portals": "privacy",
      "Wildcard match": "wildcard",
    };

    fetch(
      "https://cdn.jsdelivr.net/gh/jkwakman/Open-Cookie-Database/open-cookie-database.csv"
    )
      .then((response) => response.text())
      .then((text) => {
        const lines = text.split("\n");
        const headers = lines[0].split(",");
        const data = lines.slice(1).map((line) => {
          const values = line.split(",");
          const obj = {};
          headers.forEach((header, index) => {
            obj[headerMappings[header]] = values[index];
          });
          return obj;
        });
        setCookieDatabase(data);
      });
  }, []);

  useEffect(() => {
    // Get third party domains
    console.log("getThirdPartyData");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.runtime.sendMessage(
        {
          action: "getThirdPartyData",
          tabId: tabs[0].id,
        },
        (response) => {
          console.log("third party domains", response);
          setThirdPartyDomains(response.domains);
          setThirdPartyCookies(response.cookies);
        }
      );

      chrome.tabs.sendMessage(
        tabs[0].id,
        "localStorageCount",
        (response: SendResponseCallback) => {
          console.log(response);
          setReceivedData(response);
          setMessagesReceived(true);
          console.log("Recv response = " + response);
        }
      );
    });
  }, []);

  const bgColors = {
    9: "bg-green-500",
  };

  return (
    <div className="min-w-72 max-w-72">
      {messagesReceived ? (
        <>
          <div
            className={`p-4 ${getScoreColor(
              privacyScore.total
            )} flex flex-col items-center justify-center`}
          >
            <div className="text-5xl font-bold text-white">
              {privacyScore.total}
            </div>
            <div className="text-white text-md uppercase mt-1 font-bold">
              Xereta Score
            </div>
            <div className="text-center mt-2 text-balance text-xs text-white/90">
              {getScoreDescription(privacyScore.total)}. O xereta score mede o
              quão invasivo é o site que você está. Quanto maior o score, mais
              invasivo é o site.
            </div>
          </div>
          <div className="border-t-[1px] divide-y-[1px]">
            <ChecklistItem
              title={"Uso de Local Storage"}
              description={
                receivedData?.localStorageUsage > 0
                  ? `${byteValueNumberFormatter.format(
                      receivedData?.localStorageUsage
                    )} em uso`
                  : "Não utiliza Local Storage"
              }
              check={
                receivedData?.localStorageUsage > 0
                  ? receivedData?.localStorageUsage > 500
                    ? "❌"
                    : "⚠️"
                  : "✅"
              }
              points={privacyScore.details.localStorage?.toFixed(1)}
            >
              <p>0.5 pontos por KB utilizado (máx. 10 pontos)</p>
            </ChecklistItem>
            <ChecklistItem
              title={"Cookies de primeira parte"}
              description={
                receivedData?.cookieCount > 0
                  ? `${receivedData?.cookieCount} cookies`
                  : "Não utiliza cookies"
              }
              check={receivedData?.cookieCount > 0 ? "❌" : "✅"}
              points={privacyScore.details.firstPartyCookies?.toFixed(1)}
            >
              <p>
                1 ponto por cookie, 2 se for de analytics, 3 se for de
                marketing. (máx. 15 pontos)
              </p>
              <p>
                {receivedData?.cookies.map((cookie) => {
                  const cookieName = cookie.split("=")[0];
                  const cookieData = cookieDatabase.find(
                    (c) => c.name === cookieName
                  );

                  return (
                    <p key={cookie} className="mb-1">
                      <span className="font-semibold">{cookieName}</span>
                      <br />
                      {cookieData ? (
                        <span className="text-gray-600">
                          {cookieCategoryMappings[cookieData.category] ||
                            cookieData.category}{" "}
                          - {cookieData.platform}
                        </span>
                      ) : (
                        <span className="text-gray-600">Não classificado</span>
                      )}
                    </p>
                  );
                })}
              </p>
            </ChecklistItem>
            <ChecklistItem
              title={"Cookies de terceiros"}
              description={
                Object.keys(thirdPartyCookies).length > 0
                  ? `${Object.keys(thirdPartyCookies).length} cookies`
                  : "Não utiliza cookies de terceiros"
              }
              check={Object.keys(thirdPartyCookies).length > 0 ? "❌" : "✅"}
              points={privacyScore.details.thirdPartyCookies?.toFixed(1)}
            >
              <p>
                2 pontos por cookie, 4 se for de analytics, 5 se for de
                marketing. (máx. 20 pontos)
              </p>
            </ChecklistItem>
            <ChecklistItem
              title={"Canvas fingerprinting"}
              description={
                receivedData?.canvasFingerprinting.potentialFingerprinting
                  ? "Detectado"
                  : "Não detectado"
              }
              check={
                receivedData?.canvasFingerprinting.potentialFingerprinting
                  ? "❌"
                  : "✅"
              }
              points={privacyScore.details.canvasFingerprinting?.toFixed(1)}
            >
              <p>15 pontos se detectado</p>
            </ChecklistItem>
            <ChecklistItem
              title={"Domínios de terceiros"}
              description={
                thirdPartyDomains.length > 0
                  ? `${thirdPartyDomains.length} domínios`
                  : "Não utiliza domínios de terceiros"
              }
              check={thirdPartyDomains.length > 0 ? "❌" : "✅"}
              points={privacyScore.details.thirdPartyDomains?.toFixed(1)}
            >
              <p>
                <p className="opacity-60 mb-2">
                  1 ponto por domínio, 3 pontos se estiver na lista oisd (máx.
                  40 pontos)
                </p>
                {thirdPartyDomains.length > 0 ? (
                  thirdPartyDomains.map((domain) => (
                    <p key={domain}>
                      {domain}{" "}
                      <span className="text-xs text-red-500 font-bold">
                        {commonlyBlockedDomains.includes(domain) ? "oisd" : ""}
                      </span>
                    </p>
                  ))
                ) : (
                  <b>Não solicitou domínios de terceiros</b>
                )}
              </p>
            </ChecklistItem>
          </div>
        </>
      ) : (
        <>Recarregue a página para ver a análise</>
      )}
    </div>
  );
}

function ChecklistItem({ title, description, points, check, children }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white hover:bg-gray-100">
      <div
        className="h-12 flex flex-row cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-center w-10">
          <Twemoji
            options={{
              className: "w-6 h-6",
            }}
          >
            {check}
          </Twemoji>
        </div>
        <div className="h-full text-slate-800 flex flex-col justify-center flex-1">
          <p
            className="text-sm font-bold"
            style={{
              lineHeight: "0.7",
            }}
          >
            {title}
          </p>
          <p>{description}</p>
        </div>
        <div className="h-full flex items-center justify-end pr-3">
          +{points}
        </div>
      </div>
      {isExpanded && <div className="px-4 py-2 bg-gray-50">{children}</div>}
    </div>
  );
}

export default App;
