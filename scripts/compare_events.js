/*
  High-level: Compares event names between WooCommerce and Live Event List,
  outputs events present in one list but missing in the other.
*/

/**
 * Script to compare event names between WooCommerce and Live Event List.
 * Outputs events present in one list but missing in the other.
 */

const wooEventsRaw = [

  "Ali Sultan @ Backroom Comedy Club (Product ID: 37273)",
  "Anthony Pappaly & Nik Oka Live @ Backroom Comedy Club | Limited Run (Product ID: 37271)",
  "Chris Robinson Headlines Backroom Comedy Club | Limited Edition (Product ID: 37268)",
  "Overalls Comedy w/ Vanessa Prevost | An Improv Comedy Show (Product ID: 37294)",
  "Alvin Kuai @ Backroom Comedy Club | Limited Run (Product ID: 30897)",
  "Mike Rita - Big In Little Portugal | One Night Only! (Product ID: 37388)",
  "Robyn & Jason The Gillerans live @ Backroom Comedy Club | One Night Only (Product ID: 31907)",
  "Stef Dag @ Backroom Comedy Club | Limited Run (Product ID: 13918)",
  "Back From Sask | Variety Comedy Show Vanessa Prevost & Genevieve Robinson (Product ID: 37291)",
  "Gang's All Here Comedy: Toronto Pop-Up Show (Product ID: 35549)",
  "20-20 Perspective Comedy Show (Product ID: 6410)",
  "Free Drink (Product ID: 11192)",
  "Sunday Night at Backroom Comedy Club (Product ID: 4157)",
  "Saturday Night at Backroom Comedy Club (Product ID: 4154)",
  "Friday Night at Backroom Comedy Club (Product ID: 4061)",
  "Thursday Night at Backroom Comedy Club (Product ID: 4060)",
  "Wednesday Night at Backroom Comedy Club (Product ID: 3986)"
];

const liveEventsRaw = [
  "8PM Wednesdays - Pro Hilarious Stand-up | Humpday Comedy Delight (Series ID: 448735799857)",
  "10 PM Wednesdays - Pro Hilarious Stand-up Comedy | Late-Night laughs (Series ID: 769799319487)",
  "8PM Thursday - Pro Hilarious Stand-up Comedy Vibes  | The Laughter Fix (Series ID: 430277871697)",
  "10PM Thursday - Hilarious Stand-up Comedy Vibes |Hilarious & unexpected. (Series ID: 769805277307)",
  "20-20 Perspective Comedy Show (Series ID: 1131348316269)",
  "8PM Friday Pro & Hilarious Stand-up | Comedy Kickoff  & Laughs guaranteed (Series ID: 694505453507)",
  "10PM Friday | Pro Hilarious Late-Night Comedy Laugh | Guaranteed Hilarity (Series ID: 769813120767)",
  "8PM Saturdays - Pro & Hilarious Stand up Comedy | A true comedy experience (Series ID: 436240616427)",
  "10PM Saturdays  Pro Hilarious Stand-up Comedy | Unleash the laughter (Series ID: 769789610447)",
  "8PM Sundays  The Made Up Show | Improv standup comedy; TO most unique show (Series ID: 436368649377)",
  "10PM Industry Nights @  Hilarious comedy show for  Industry Folk in Toronto (Series ID: 623888215447)",
  "Back From Sask | Variety Comedy Show Vanessa Prevost & Genevieve Robinson (Series ID: 1363337712799)",
  "Feedback | An Open Mic Comedy Show @ Backroom Comedy Club (Series ID: 969715062857)",
  "Stef Dag @ Backroom Comedy | Limited Run (Series ID: 1302257640659)",
  "Overalls Comedy w/ Vanessa Prevost | An Improv Comedy Show (Series ID: 1363374151789)",
  "Robyn & Jason The Gillerans live @ Backroom Comedy Club | One Night Only (Series ID: 1341477809239)",
  "Mike Rita - Big In Little Portugal | One Night Only! (Series ID: 1368836570029)",
  "Comedy Open House @ Backroom Comedy Club – Ask Us Anything! (Series ID: 1364876796239)",
  "Alvin Kuai @ Backroom Comedy Club | Limited Run! (Series ID: 1260225060079)",
  "Chris Robinson Headlines Backroom Comedy Club | Limited Edition show (Series ID: 1362381833739)",
  "Comedy Enthusiast | Stand Up Comedy Watch Party (Series ID: 1068824515899)",
  "Anthony Pappaly & Nik Oka live @ Backroom Comedy Club | Limited Run (Series ID: 1362387039309)",
  "Ali Sultan live @ Backroom Comedy Club (Series ID: 1362389596959)"
];

function extractName(raw) {
  // Remove product or series ID part
  return raw.replace(/\(Product ID:.*\)/, '').replace(/\(Series ID:.*\)/, '').trim();
}

// Normalize function to lowercase and remove extra words and punctuation for comparison
function normalizeEventName(name) {
  return name
    .toLowerCase()
    .replace(/\blive\b/g, '')
    .replace(/\blimited run\b/g, '')
    .replace(/\bone night only\b/g, '')
    .replace(/\|/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const wooEvents = wooEventsRaw.map(e => normalizeEventName(extractName(e)));
const liveEvents = liveEventsRaw.map(e => normalizeEventName(extractName(e)));

const wooSet = new Set(wooEvents);
const liveSet = new Set(liveEvents);

const inWooNotLive = [...wooSet].filter(e => !liveSet.has(e));
const inLiveNotWoo = [...liveSet].filter(e => !wooSet.has(e));

console.log("Events in WooCommerce but not in Live Event List:");
console.log(inWooNotLive);

console.log("Events in Live Event List but not in WooCommerce:");
console.log(inLiveNotWoo);
