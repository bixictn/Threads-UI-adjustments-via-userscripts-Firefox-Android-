// ==UserScript==
// @name         Threads ID Profiles Fetch Data
// @version      0.2.0
// @description  Threads ID Profiles Fetch Data
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      instagram.com
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

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

    unsafeWindow.THREADS_LST_FD = {
        getFlagEmoji: (country)=>{return getFlagEmoji(country);}
    }    

    function getFlagEmoji(country) {
        const code = countryFlagsMap[country];
        if (!code) return "";

        return code.toUpperCase().replace(/./g, char =>
                                          String.fromCodePoint(char.charCodeAt(0) + 127397)
                                         );
    }

    const decode = (s) => s ? s.replace(/\\u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16))) : null;

    window.addEventListener('REQUEST_PROFILE',(e) =>{
        const { username } = e.detail;
        const targetIgUrl = `https://www.instagram.com/${username}/`;

        GM_xmlhttpRequest({
            method: "GET",
            url: `https://www.threads.com/@${username}`,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8"
            },
            timeout: 4000,
            onload: function(response) {
                const html = response.responseText || "";
                const htmlString = response.responseText;
                let targetId;

                const userIdMatch = response.responseText.match(/"user_id":"(\d+)"/);
                if (userIdMatch) {
                    targetId = userIdMatch[1];
                }

                const dtsgRegex = /"DTSGInitialData",\[\],\{"token":"([^"]+)"\}/;
                const dtsgMatch = htmlString.match(dtsgRegex);
                const fb_dtsg = dtsgMatch ? dtsgMatch[1] : null;

                const lsdRegex = /"LSD",\[\],\{"token":"([^"]+)"\}/;
                const lsdMatch = htmlString.match(lsdRegex);
                const lsd = lsdMatch ? lsdMatch[1] : null;

                const bkvMatch = htmlString.match(/"WebBloksVersioningID",\[\],\{"versioningID":"([^"]+)"\}/);
                const __bkv = bkvMatch ? bkvMatch[1] : null;

                const eqmcRegex = /<script id="__eqmc" type="application\/json"[^>]*>(.*?)<\/script>/;
                const eqmcMatch = htmlString.match(eqmcRegex);
                let jazoest;

                if (eqmcMatch) {
                    try {
                        const eqmcData = JSON.parse(eqmcMatch[1]);

                        const fb_dtsg = eqmcData.f;

                        const uString = eqmcData.u;
                        const jazoestMatch = uString.match(/jazoest=(\d+)/);
                        jazoest = jazoestMatch ? jazoestMatch[1] : null;

                    } catch (e) {
                        console.error("解析 __eqmc JSON 失敗:", e);
                    }
                }

                if (targetId && fb_dtsg && lsd && __bkv && jazoest) {
                    getProfile(username,targetId,fb_dtsg,lsd,jazoest,__bkv);
                }

            },
            onerror: function() {
            }
        });
    });

    function getProfile(username,targetUserId, fb_dtsg, lsd, jazoest, __bkv) {
        const paramsObj = {
            "atpTriggerSessionID": crypto.randomUUID(),
            "referer_type": "TextPostAppProfileOverflow",
            "target_user_id": targetUserId
        };

        const postData = new URLSearchParams();

        postData.append("__user", "0");
        postData.append("__a", "1");
        postData.append("__req", "5c");
        postData.append("dpr", "1");

        postData.append("__comet_req", "29");
        postData.append("__spin_b", "trunk");

        postData.append("fb_dtsg", fb_dtsg);
        postData.append("jazoest", jazoest);
        postData.append("lsd", lsd);

        postData.append("params", JSON.stringify(paramsObj));
        postData.append("__d", "www");

        GM_xmlhttpRequest({
            method: "POST",
            url: `https://www.threads.com/async/wbloks/fetch/?appid=com.bloks.www.text_post_app.about_this_profile_async_action&type=app&__bkv=${__bkv}`,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                "User-Agent": navigator.userAgent,
                "X-FB-LSD": lsd
            },
            data: postData.toString(),
            onload: async function(response) {
                if (response.status === 200) {
                    let cleanResponse = response.responseText;

                    if (cleanResponse.startsWith('for (;;);')) {
                        cleanResponse = cleanResponse.replace('for (;;);', '');
                    }
                    try {
                        const jsonData = JSON.parse(cleanResponse);

                        function extractTextNodes(obj, textArray = []) {
                            if (Array.isArray(obj)) {
                                obj.forEach(item => extractTextNodes(item, textArray));
                            } else if (obj !== null && typeof obj === 'object') {
                                if (obj.text && typeof obj.text === 'string') {
                                    textArray.push(obj.text);
                                }
                                Object.values(obj).forEach(val => extractTextNodes(val, textArray));
                            }
                            return textArray;
                        }

                        const allTexts = extractTextNodes(jsonData);


                        let joinedInfo = allTexts[allTexts.indexOf("已加入") + 1];
                        joinedInfo = joinedInfo.split(" · ")[0].trim()
                        const countryRegex = /"THREADS_ABOUT_THIS_PROFILE:about_this_profile_country","mode":"[^"]+","initial":"([^"]+)"/;
                        const locationMatch = cleanResponse.match(countryRegex);
                        const locationInfo = locationMatch ? decode(locationMatch[1]) : "無地點資料";

                        const finalData = {
                            userId: username,
                            usernumber: targetUserId,
                            joined: joinedInfo,
                            location: locationInfo,
                            timestamp: Date.now()
                        };
                        await unsafeWindow.THREADS_DB_CENTER.saveProfile(finalData);

                    } catch (e) {
                        console.error("解析 JSON 失敗", e);
                    }
                } else {
                    console.error("請求依然失敗，狀態碼:", response.status);
                }
            }
        });
    }

    window.addEventListener('REQUEST_IG_VERIFY', (e) => {
        const { username } = e.detail;
        const targetIgUrl = `https://www.instagram.com/${username}/`;


        GM_xmlhttpRequest({
            method: "GET",
            url: targetIgUrl,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8"
            },
            timeout: 4000,
            onload: function(response) {
                const html = response.responseText || "";
                const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
                const pageTitle = titleMatch ? titleMatch[1].trim() : "";

                const isDeadPage = (response.status === 404) ||
                      pageTitle === "頁面找不到" ||
                      pageTitle === "Page Not Found" ||
                      pageTitle === "Instagram" ||
                      pageTitle === "";

                const isValid = !isDeadPage;

                if (isValid) {
                    console.log(`[🟢 驗證成功] 帳號 @${username} ，標題為: ${pageTitle}`);
                } else {
                    console.log(`[🚫 找不到] 帳號 @${username}`);
                }

                const resultEvent = new CustomEvent('IG_VALID_RESULT', {
                    detail: { username, isValid, targetUrl: targetIgUrl }
                });
                window.dispatchEvent(resultEvent);
            },
            onerror: function() {
                const resultEvent = new CustomEvent('IG_VALID_RESULT', {
                    detail: { username, isValid: false, targetUrl: targetIgUrl }
                });
                window.dispatchEvent(resultEvent);
            }
        });
    });
})();
