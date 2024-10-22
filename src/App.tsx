import { useEffect, useState } from "react";
import "./index.css";
import Twemoji from "react-twemoji";
import { CookieData } from "./background";

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

function App() {
  const [receivedData, setReceivedData] = useState<{
    localStorageUsage: number;
    canvasElements: number;
    cookieCount: number;
    cookies: string[];
  }>();
  const [thirdPartyDomains, setThirdPartyDomains] = useState([]);
  const [thirdPartyCookies, setThirdPartyCookies] = useState<
    Record<string, CookieData>
  >({});
  const [messagesReceived, setMessagesReceived] = useState(false);
  const [cookieDatabase, setCookieDatabase] = useState([]);
  const [commonlyBlockedDomains, setCommonlyBlockedDomains] = useState<
    string[]
  >([]);

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

      chrome.tabs.sendMessage(tabs[0].id, "localStorageCount", (response) => {
        console.log(response);
        setReceivedData(response);
        setMessagesReceived(true);
        console.log("Recv response = " + response);
      });
    });
  }, []);

  const bgColors = {
    9: "bg-green-500",
  };

  return (
    <div className="min-w-72 max-w-72">
      {messagesReceived ? (
        <>
          <div className="p-4 bg-green-500 flex flex-col items-center justify-center">
            <div className="text-5xl font-bold text-white">10</div>
            <div className="text-white text-md uppercase mt-1 font-bold">
              Xereta Score
            </div>
            <div className="text-center mt-2 text-balance text-xs text-white/90">
              O xereta score mede o quão invasivo é o site que você está. Quanto
              maior o score, mais invasivo é o site.
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
              points={(0.001 * receivedData?.localStorageUsage).toFixed(2)}
            >
              a
            </ChecklistItem>
            <ChecklistItem
              title={"Cookies de primeira parte"}
              description={
                receivedData?.cookieCount > 0
                  ? `${receivedData?.cookieCount} cookies`
                  : "Não utiliza cookies"
              }
              check={receivedData?.cookieCount > 0 ? "❌" : "✅"}
              points={1}
            >
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
              points={1}
            >
              <p>{JSON.stringify(thirdPartyCookies, null, 2)}</p>
            </ChecklistItem>
            <ChecklistItem
              title={"Canvas fingerprinting"}
              description={
                receivedData?.canvasElements > 0
                  ? `${receivedData?.canvasElements} elementos`
                  : "Não utiliza Canvas"
              }
              check={receivedData?.canvasElements > 0 ? "❌" : "✅"}
              points={1}
            >
              a
            </ChecklistItem>
            <ChecklistItem
              title={"Domínios de terceiros"}
              description={
                thirdPartyDomains.length > 0
                  ? `${thirdPartyDomains.length} domínios`
                  : "Não utiliza domínios de terceiros"
              }
              check={thirdPartyDomains.length > 0 ? "❌" : "✅"}
              points={1}
            >
              <p>
                {thirdPartyDomains.length > 0 ? (
                  <>
                    <p className="opacity-60 mb-2">
                      Domínios na lista oisd de bloqueio de anúncios e trackers
                      contam mais pontos.
                    </p>
                    <>
                      {thirdPartyDomains.map((domain) => {
                        const isBlocked =
                          commonlyBlockedDomains.includes(domain);

                        return (
                          <p key={domain}>
                            {domain}{" "}
                            <span className="text-xs text-red-500 font-bold">
                              {isBlocked ? "oisd" : ""}
                            </span>
                          </p>
                        );
                      })}
                    </>
                  </>
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
