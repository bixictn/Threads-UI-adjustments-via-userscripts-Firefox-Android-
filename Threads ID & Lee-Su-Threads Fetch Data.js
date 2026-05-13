// ==UserScript==
// @name         Threads ID & Lee-Su-Threads Fetch Data
// @version      0.1.0
// @description  Threads ID & Lee-Su-Threads Fetch Data
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    const fetchMap = new Map();
    const debug = false;

    const countryFlagsMap = {
        "阿富汗": "AF", "奧蘭": "AX", "阿爾巴尼亞": "AL", "阿爾及利亞": "DZ", "美屬薩摩亞": "AS",
        "安道爾": "AD", "安哥拉": "AO", "安吉拉": "AI", "南極洲": "AQ", "安地卡及巴布達": "AG",
        "阿根廷": "AR", "亞美尼亞": "AM", "阿魯巴": "AW", "澳大利亞": "AU", "奧地利": "AT",
        "亞塞拜然": "AZ", "巴哈馬": "BS", "巴林": "BH", "孟加拉": "BD", "巴貝多": "BB",
        "白俄羅斯": "BY", "比利時": "BE", "貝里斯": "BZ", "貝南": "BJ", "百慕達": "BM",
        "不丹": "BT", "玻利維亞": "BO", "波奈": "BQ", "波赫": "BA", "波札那": "BW",
        "布韋島": "BV", "巴西": "BR", "英屬印度洋領地": "IO", "汶萊": "BN", "保加利亞": "BG",
        "布吉納法索": "BF", "蒲隆地": "BI", "維德角": "CV", "柬埔寨": "KH", "喀麥隆": "CM",
        "加拿大": "CA", "開曼群島": "KY", "中非": "CF", "查德": "TD", "智利": "CL",
        "中國": "CN", "聖誕島": "CX", "科科斯（基林）群島": "CC", "哥倫比亞": "CO", "葛摩": "KM",
        "剛果共和國": "CG", "剛果民主共和國": "CD", "庫克群島": "CK", "哥斯大黎加": "CR", "象牙海岸": "CI",
        "克羅埃西亞": "HR", "古巴": "CU", "古拉索": "CW", "賽普勒斯": "CY", "捷克": "CZ",
        "丹麥": "DK", "吉布地": "DJ", "多米尼克": "DM", "多明尼加": "DO", "厄瓜多": "EC",
        "埃及": "EG", "薩爾瓦多": "SV", "赤道幾內亞": "GQ", "厄利垂亞": "ER", "愛沙尼亞": "EE",
        "衣索比亞": "ET", "福克蘭群島": "FK", "法羅群島": "FO", "斐濟": "FJ", "芬蘭": "FI",
        "法國": "FR", "法屬圭亞那": "GF", "法屬玻里尼西亞": "PF", "法屬南部和南極領地": "TF", "加彭": "GA",
        "甘比亞": "GM", "喬治亞": "GE", "德國": "DE", "迦納": "GH", "直布羅陀": "GI",
        "希臘": "GR", "格陵蘭": "GL", "格瑞那達": "GD", "瓜地洛普": "GP", "關島": "GU",
        "瓜地馬拉": "GT", "根西": "GG", "幾內亞": "GN", "幾內亞比索": "GW", "蓋亞那": "GY",
        "海地": "HT", "赫德及麥當勞群島": "HM", "梵蒂岡": "VA", "宏都拉斯": "HN", "香港": "HK",
        "匈牙利": "HU", "冰島": "IS", "印度": "IN", "印尼": "ID", "伊朗": "IR",
        "伊拉克": "IQ", "愛爾蘭": "IE", "曼島": "IM", "以色列": "IL", "義大利": "IT",
        "牙買加": "JM", "日本": "JP", "澤西": "JE", "約旦": "JO", "哈薩克": "KZ",
        "肯亞": "KE", "吉里巴斯": "KI", "北韓": "KP", "南韓": "KR", "科威特": "KW",
        "吉爾吉斯": "KG", "寮國": "LA", "拉脫維亞": "LV", "黎巴嫩": "LB", "賴索托": "LS",
        "賴比瑞亞": "LR", "利比亞": "LY", "列支敦斯登": "LI", "立陶宛": "LT", "盧森堡": "LU",
        "澳門": "MO", "馬達加斯加": "MG", "馬拉威": "MW", "馬來西亞": "MY", "馬爾地夫": "MV",
        "馬利": "ML", "馬爾他": "MT", "馬紹爾群島": "MH", "馬丁尼克": "MQ", "茅利塔尼亞": "MR",
        "模里西斯": "MU", "馬約特": "YT", "墨西哥": "MX", "密克羅尼西亞": "FM", "摩爾多瓦": "MD",
        "摩納哥": "MC", "蒙古": "MN", "蒙特內哥羅": "ME", "蒙哲臘": "MS", "摩洛哥": "MA",
        "莫三比克": "MZ", "緬甸": "MM", "納米比亞": "NA", "諾魯": "NR", "尼泊爾": "NP",
        "荷蘭": "NL", "新喀里多尼亞": "NC", "紐西蘭": "NZ", "尼加拉瓜": "NI", "尼日": "NE",
        "奈及利亞": "NG", "紐埃": "NU", "諾福克島": "NF", "北馬其頓": "MK", "北馬里亞納群島": "MP",
        "挪威": "NO", "阿曼": "OM", "巴基斯坦": "PK", "帛琉": "PW", "巴勒斯坦": "PS",
        "巴拿馬": "PA", "巴布亞紐幾內亞": "PG", "巴拉圭": "PY", "秘魯": "PE", "菲律賓": "PH",
        "皮特肯群島": "PN", "波蘭": "PL", "葡萄牙": "PT", "波多黎各": "PR", "卡達": "QA",
        "留尼旺": "RE", "羅馬尼亞": "RO", "俄羅斯": "RU", "盧安達": "RW", "聖巴瑟米": "BL",
        "聖赫勒拿": "SH", "聖克里斯多福及尼維斯": "KN", "聖露西亞": "LC", "法屬聖馬丁": "MF", "聖皮埃與密克隆群島": "PM",
        "聖文森及格瑞那丁": "VC", "薩摩亞": "WS", "聖馬利諾": "SM", "聖多美普林西比": "ST", "沙烏地阿拉伯": "SA",
        "塞內加爾": "SN", "塞爾維亞": "RS", "塞席爾": "SC", "獅子山": "SL", "新加坡": "SG",
        "荷屬聖馬丁": "SX", "斯洛伐克": "SK", "斯洛維尼亞": "SI", "索羅門群島": "SB", "索馬利亞": "SO",
        "南非": "ZA", "南喬治亞與南三明治群島": "GS", "南蘇丹": "SS", "西班牙": "ES", "斯里蘭卡": "LK",
        "蘇丹": "SD", "蘇利南": "SR", "斯瓦巴和揚馬延": "SJ", "瑞典": "SE", "瑞士": "CH",
        "敘利亞": "SY", "台灣": "TW", "塔吉克": "TJ", "坦尚尼亞": "TZ", "泰國": "TH",
        "東帝汶": "TL", "多哥": "TG", "托克勞": "TK", "東加": "TO", "千里達及托巴哥": "TT",
        "突尼西亞": "TN", "土耳其": "TR", "土庫曼": "TM", "土克斯及開科斯群島": "TC", "吐瓦魯": "TV",
        "烏干達": "UG", "烏克蘭": "UA", "阿拉伯聯合大公國": "AE", "英國": "GB", "美國": "US",
        "美國本土外小島嶼": "UM", "烏拉圭": "UY", "烏茲別克": "UZ", "萬那杜": "VU", "委內瑞拉": "VE",
        "越南": "VN", "英屬維京群島": "VG", "美屬維京群島": "VI", "瓦利斯和富圖那": "WF", "西撒哈拉": "EH",
        "葉門": "YE", "尚比亞": "ZM", "辛巴威": "ZW"
    };

    window.THREADS_LST_FD = {
        deleteUser: (user) => {fetchMap.delete(user);console.log('移除暫存:'+user+':剩餘:'+fetchMap.size); },
        getUserData: (user) => {return fetchMap.get(user);},
        has: (user) => {return fetchMap.has(user);},
        getFlagEmoji: (country)=>{return getFlagEmoji(country);}
    }

    // 1. 建立調試面板 UI
    const debugUI = document.createElement('div');
    debugUI.id = 'threads-id-monitor';
    debugUI.style.cssText = `
        position: fixed; top: 100px; right: 10px; width: 80%; max-height: 400px;
        background: rgba(0, 0, 0, 0.85); color: #00ff00; font-family: monospace;
        font-size: 11px; z-index: 1000000; overflow-y: auto; border: 1px solid #00ff00;
        padding: 8px; border-radius: 4px; pointer-events: none;display:${debug?'flex':'none'}
    `;
    document.documentElement.appendChild(debugUI);

    function updateMonitor(data) {
        const idEntry = document.createElement('div');
        idEntry.style.borderBottom = '1px solid #333';
        idEntry.style.marginBottom = '5px';
        idEntry.innerHTML = `
            <div>👤 名稱: <span style="color:#fff">${data.username}</span></div>
            <div>🆔 數字ID: <span style="color:#ffcc00">${data.userId || '❌ 未抓到'}</span></div>
            <div>📅 註冊: ${data.joinedDate}</div>
            <div>📍 地點: ${getFlagEmoji(data.country)}${data.country}</div>
        `;
        debugUI.prepend(idEntry);
    }

    // 2. 核心解析邏輯
    const decode = (s) => s ? s.replace(/\\u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16))) : null;

    function parseProfile(rawText) {
        const decode = (s) => s ? s.replace(/\\u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16))) : null;

        // 1. 提取 UserID (數字 PK)
        const userId = rawText.match(/bk\.action\.i64\.Const\s*,\s*(\d+)/)?.[1];

        // 2. 核心：區分「無地點資料」與「未分享」
        let country = "無地點資料"; // 預設為完全沒欄位的情況

        3.
        // 檢查是否存在地點變數欄位
        if (rawText.includes("about_this_profile_country")) {
            const countryDataMatch = rawText.match(/"key"\s*:\s*"THREADS_ABOUT_THIS_PROFILE:about_this_profile_country".*?"initial"\s*:\s*"([^"]+)"/);

            if (countryDataMatch) {
                const initialValue = decode(countryDataMatch[1]);
                // 如果 initial 裡面寫的是 "未分享"，就存 "未分享"；否則存具體地點（如：台灣）
                country = initialValue;
            }
        }


        // 🎯 4. 提取 Username
        const uNameMatch = rawText.match(/"bk\.components\.TextSpan".*?"text"\s*:\s*"([^"]+)"/);
        let username = null;
        if (uNameMatch) {
            let decoded = decode(uNameMatch[1]);
            username = decoded.includes('@') ? decoded.split('@')[1].split(/[）)]/)[0].trim() : decoded;
        }

        // 🎯 5. 提取註冊日
        const dateMatch = rawText.match(/"text"\s*:\s*"(\d{4}\\u5e74\d{1,2}\\u6708[^"]*)"/);
        const joinedDate = dateMatch ? decode(dateMatch[1]).split(/\s[·•]\s/)[0].trim() : "未知日期";

        //console.log(rawText);
        fetchMap.set(username, { joined: joinedDate, location: country, usernumber: userId});
        return { userId, username, joinedDate, country };
    }


    function getFlagEmoji(country) {

        const code = countryFlagsMap[country];
        if (!code) return "";

        return code.toUpperCase().replace(/./g, char =>
                                          String.fromCodePoint(char.charCodeAt(0) + 127397)
                                         );
    }

    // 3. Fetch 攔截器
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const url = (typeof args[0] === 'string') ? args[0] : args[0].url;

        if (url && url.includes("about_this_profile_async_action")) {
            const clone = response.clone();
            clone.text().then(text => {
                const data = parseProfile(text);
                if(debug)updateMonitor(data);
            });
        }
        return response;
    };
})();
