/**
 * This script reads event data from FooEvents and Eventbrite markdown files,
 * normalizes and compares event titles, dates, and times, and outputs a JSON
 * mapping of matched events.
 */
const fs = require('fs');



// --- Configuration ---
const FOOEVENTS_FILE_PATH = 'woocommerce_fooevents_full_list.md';
const EVENTBRITE_FILE_PATH = 'docs_and_reference/live_event_list.md';
const OUTPUT_FILE_PATH = 'event_mapping.json';

const commonWordsToRemove = new Set([
    "at", "show", "comedy", "club", "pro", "hilarious", "guaranteed", "experience",
    "delight", "vibes", "kickoff", "laughter", "limited", "run", "one", "night", "only",
    "the", "a", "an", "is", "are", "on", "in", "for", "with", "and", "or", "to", "of",
    "presents", "featuring", "live", "special", "edition", "event", "tickets", "admission",
    "stand-up", "standup", "pm", "am", "true", "standup", "event", "events",
    "ticket", "tickets", "admission", "general", "vip", "early", "bird", "late",
    "door", "online", "purchase", "buy", "get", "your", "now", "book", "reserve",
    "spot", "join", "us", "come", "see", "enjoy", "laugh", "fun", "funny", "best",
    "top", "rated", "award", "winning", "showcase", "mic", "open", "headliner",
    "host", "hosted", "by", "from", "as", "seen"
    // Months are removed by suffix logic if at the end, avoid removing from middle of title
]);

// --- Helper Functions ---

function normalizeFooEventsDate(dateStr) {
    // console.log(`DEBUG: normalizeFooEventsDate - Input: '${dateStr}'`);
    if (!dateStr || dateStr.toLowerCase() === 'n/a') {
        // console.log(`DEBUG: normalizeFooEventsDate - Output: 'N/A' (due to empty or N/A input)`);
        return 'N/A';
    }
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
             const parts = dateStr.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})/);
             if (parts) {
                 const monthStr = parts[1];
                 const dayNum = parseInt(parts[2], 10);
                 const yearNum = parseInt(parts[3], 10);
                 const monthIdx = new Date(Date.parse(monthStr +" 1, 2000")).getMonth();
                 if (monthIdx >=0 && dayNum > 0 && dayNum <=31 && yearNum > 1900) {
                    const d = new Date(yearNum, monthIdx, dayNum);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const result = `${year}-${month}-${day}`;
                    // console.log(`DEBUG: normalizeFooEventsDate - Output (from parts): '${result}'`);
                    return result;
                 }
             }
            // console.log(`DEBUG: normalizeFooEventsDate - Output: 'N/A' (parsing failed, no valid parts)`);
            return 'N/A';
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const result = `${year}-${month}-${day}`;
        // console.log(`DEBUG: normalizeFooEventsDate - Output (from new Date()): '${result}'`);
        return result;
    } catch (e) {
        // console.log(`DEBUG: normalizeFooEventsDate - Output: 'N/A' (exception: ${e.message})`);
        return 'N/A';
    }
}

function normalizeFooEventsTime(timeStr) {
    // console.log(`DEBUG: normalizeFooEventsTime - Input: '${timeStr}'`);
    if (!timeStr || timeStr.toLowerCase() === 'n/a') {
        // console.log(`DEBUG: normalizeFooEventsTime - Output: 'N/A' (due to empty or N/A input)`);
        return 'N/A';
    }

    const cleanedTimeStr = timeStr.replace(/\./g, '').toLowerCase();
    let match = cleanedTimeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);

    if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3];

        if (period === 'pm' && hours < 12) {
            hours += 12;
        } else if (period === 'am' && hours === 12) {
            hours = 0;
        }
        
        const result = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        // console.log(`DEBUG: normalizeFooEventsTime - Output: '${result}'`);
        return result;
    }
    // console.log(`DEBUG: normalizeFooEventsTime - Output: 'N/A' (no match)`);
    return 'N/A';
}

function normalizeTitleForComparison(title) {
    // console.log(`DEBUG: normalizeTitleForComparison - Input: '${title}'`);
    if (!title) {
        // console.log("DEBUG: normalizeTitleForComparison - Output: '' (empty input)");
        return "";
    }
    let normalized = title.toLowerCase();
    // console.log(`DEBUG: normalizeTitleForComparison - Lowercased: '${normalized}'`);

    const originalNormalized = normalized;
    normalized = normalized.replace(/\s+-\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s+\d{4})?$/i, '');
    // if (originalNormalized !== normalized) console.log(`DEBUG: normalizeTitleForComparison - After date suffix removal: '${normalized}'`);
    
    const originalNormalized2 = normalized;
    normalized = normalized.replace(/\s+-\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?$/i, '');
    // if (originalNormalized2 !== normalized) console.log(`DEBUG: normalizeTitleForComparison - After day suffix removal: '${normalized}'`);

    const words = normalized.replace(/[^\w\s-]/gi, '').split(/\s+/);
    // console.log(`DEBUG: normalizeTitleForComparison - Words after punctuation removal & split: [${words.join(', ')}]`);
    
    const filteredWords = words.filter(word => {
        const cleanWord = word.replace(/[^\w]/gi, '');
        return cleanWord.length > 0 && !commonWordsToRemove.has(cleanWord);
    });
    // console.log(`DEBUG: normalizeTitleForComparison - Filtered words (common words removed): [${filteredWords.join(', ')}]`);
    
    const result = filteredWords.join(' ').trim();
    // console.log(`DEBUG: normalizeTitleForComparison - Output: '${result}'`);
    return result;
}


function parseFooEvents(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fooEventsEntries = [];
    const productSections = content.split(/^##\s+/m).slice(1);

    for (const productSection of productSections) {
        const productHeaderMatch = productSection.match(/^(.*?)\s*\(Product ID:\s*(\d+)\)/);
        if (!productHeaderMatch) continue;
        const currentProductTitle = productHeaderMatch[1].trim();

        const dateSections = productSection.split(/^####\s*Date:/m).slice(1);
        for (const dateSection of dateSections) {
            const dateHeaderMatch = dateSection.match(/^(.*?)\s*\(Internal Date ID:\s*([a-z0-9]+)\)/);
            if (!dateHeaderMatch) continue;

            const fooevents_date_str = dateHeaderMatch[1].trim();
            const fooevents_internal_date_id = dateHeaderMatch[2].trim();
            
            let fooevents_slot_time_str = 'N/A'; // From `- **Time:**`
            let slot_label_derived_time_str = null; // From `- **Slot Label:**`

            const timeMatch = dateSection.match(/^- \*\*Time:\*\*\s*(.*)/m);
            if (timeMatch) {
                fooevents_slot_time_str = timeMatch[1].trim();
            }

            const slotLabelMatch = dateSection.match(/^- \*\*Slot Label:\*\*\s*(.*?)(?:\s+-\s+.*|\s*\(.*\)|$)/m);
            if (slotLabelMatch) {
                const slotLabelContent = slotLabelMatch[1].trim();
                // Try to extract time like "8:00 p.m." from "8:00 p.m. - 9:30 p.m." or "8:00 p.m. (Main Slot)"
                const timeFromLabelMatch = slotLabelContent.match(/^(\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|am|pm))/i);
                if (timeFromLabelMatch) {
                    slot_label_derived_time_str = timeFromLabelMatch[1];
                }
            }
            
            let normalized_time_for_matching = normalizeFooEventsTime(fooevents_slot_time_str);
            if (normalized_time_for_matching === 'N/A' && slot_label_derived_time_str) {
                normalized_time_for_matching = normalizeFooEventsTime(slot_label_derived_time_str);
            }

            fooEventsEntries.push({
                fooevents_title: currentProductTitle,
                fooevents_date_str: fooevents_date_str,
                fooevents_internal_date_id: fooevents_internal_date_id,
                fooevents_slot_time_str: fooevents_slot_time_str,
                normalized_date: normalizeFooEventsDate(fooevents_date_str),
                normalized_time: normalized_time_for_matching,
                normalized_title: normalizeTitleForComparison(currentProductTitle)
            });
        }
    }
    return fooEventsEntries;
}

function parseEventbrite(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const events = [];
    const eventSections = content.split(/^###\s+/m).slice(1);

    const occurrenceIdRegex = /^- \*\*Occurrence ID:\*\*\s*(\S+)/m;
    const startDateRegex = /^- \*\*Start Date:\*\*\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/m;

    for (const section of eventSections) {
        const lines = section.split('\n');
        const eventbrite_title_full = lines[0].trim();

        const occurrenceMatch = section.match(occurrenceIdRegex);
        const startDateMatch = section.match(startDateRegex);

        if (occurrenceMatch && startDateMatch) {
            const eventbrite_occurrence_id = occurrenceMatch[1];
            const eventbrite_start_datetime_str = startDateMatch[1];

            const normalized_date = eventbrite_start_datetime_str.substring(0, 10);
            const normalized_time = eventbrite_start_datetime_str.substring(11, 16);

            events.push({
                eventbrite_title_full: eventbrite_title_full,
                eventbrite_occurrence_id: eventbrite_occurrence_id,
                eventbrite_start_datetime_str: eventbrite_start_datetime_str,
                normalized_date: normalized_date,
                normalized_time: normalized_time,
                normalized_title: normalizeTitleForComparison(eventbrite_title_full)
            });
        }
    }
    return events;
}

// --- Main Logic ---
function main() {
    try {
        const fooEventsData = parseFooEvents(FOOEVENTS_FILE_PATH);
        const eventbriteData = parseEventbrite(EVENTBRITE_FILE_PATH);

        console.log(`Parsed ${fooEventsData.length} FooEvents entries from ${FOOEVENTS_FILE_PATH}.`);
        console.log(`Parsed ${eventbriteData.length} Eventbrite entries from ${EVENTBRITE_FILE_PATH}.`);

        const mappedEvents = [];
        let fooEventCounter = 0;
        const specificFooEventTitle = "Friday Night at Backroom Comedy Club";
        const specificFooEventDateStr = "June 06, 2025"; // Normalized: 2025-06-06

        for (const fooEvent of fooEventsData) {
            fooEventCounter++;
            const isSpecificEvent = fooEvent.fooevents_title === specificFooEventTitle && fooEvent.fooevents_date_str === specificFooEventDateStr;
            const shouldLogDetails = fooEventCounter <= 5 || isSpecificEvent;

            if (shouldLogDetails) {
                console.log(`\n--- Processing FooEvent #${fooEventCounter} (Log limit: 5 or specific event) ---`);
                console.log(`  FooEvent Original Title: "${fooEvent.fooevents_title}"`);
                console.log(`  FooEvent Original Date: "${fooEvent.fooevents_date_str}" -> Normalized: "${fooEvent.normalized_date}"`);
                console.log(`  FooEvent Original Time: "${fooEvent.fooevents_slot_time_str}" -> Normalized: "${fooEvent.normalized_time}"`);
                console.log(`  FooEvent Normalized Title for Match: "${fooEvent.normalized_title}"`);
            }

            if (fooEvent.normalized_date === 'N/A') {
                if (shouldLogDetails) console.log("  Skipping FooEvent: Normalized date is N/A.");
                continue;
            }

            for (const ebEvent of eventbriteData) {
                if (ebEvent.normalized_date === 'N/A' && shouldLogDetails) {
                     console.log("    Skipping EB Event: Normalized date is N/A.");
                     continue;
                }

                let dateMatch = false;
                let timeMatch = false;
                let titleMatch = false;

                // 1. Date match
                dateMatch = fooEvent.normalized_date === ebEvent.normalized_date;
                if (shouldLogDetails) {
                    console.log(`  Attempting Match with Eventbrite Event: "${ebEvent.eventbrite_title_full}"`);
                    console.log(`    EB Original Date/Time: "${ebEvent.eventbrite_start_datetime_str}"`);
                    console.log(`    EB Normalized Date: "${ebEvent.normalized_date}"`);
                    console.log(`    EB Normalized Time: "${ebEvent.normalized_time}"`);
                    console.log(`    EB Normalized Title for Match: "${ebEvent.normalized_title}"`);
                    console.log(`    Date Comparison: FooEvents ("${fooEvent.normalized_date}") vs Eventbrite ("${ebEvent.normalized_date}") -> ${dateMatch}`);
                }
                if (!dateMatch) {
                    continue;
                }

                // 2. Time match
                let timeCriteriaMet = false;
                if (fooEvent.normalized_time === 'N/A') {
                    timeCriteriaMet = true; // Consider it a pass for time if FooEvent time is N/A
                    if (shouldLogDetails) console.log(`    Time Comparison: FooEvent time is N/A, time criteria considered met.`);
                } else if (fooEvent.normalized_time === ebEvent.normalized_time) {
                    timeCriteriaMet = true;
                }

                if (shouldLogDetails && fooEvent.normalized_time !== 'N/A') {
                    console.log(`    Time Comparison: FooEvents ("${fooEvent.normalized_time}") vs Eventbrite ("${ebEvent.normalized_time}") -> ${timeCriteriaMet}`);
                }
                
                if (!timeCriteriaMet) {
                    if (shouldLogDetails) console.log("    Time match failed. Skipping to next Eventbrite event.");
                    continue; // Skip to the next Eventbrite event if times don't match and FooEvent time wasn't N/A
                }
                
                // 3. Title match
                const fooTitleNorm = fooEvent.normalized_title;
                const ebTitleNorm = ebEvent.normalized_title;

                if (shouldLogDetails) {
                    console.log(`    Title Pre-Check: FooNorm: "${fooTitleNorm}", EBNorm: "${ebTitleNorm}"`);
                }

                if (fooTitleNorm && ebTitleNorm && fooTitleNorm.length > 0 && ebTitleNorm.length > 0) {
                    const fooWords = fooTitleNorm.split(' ').filter(w => w.length > 1);
                    const ebWords = ebTitleNorm.split(' ').filter(w => w.length > 1);

                    if (shouldLogDetails) {
                        console.log(`      FooWords for Title Match: [${fooWords.join(', ')}] (Count: ${fooWords.length})`);
                        console.log(`      EBWords for Title Match: [${ebWords.join(', ')}] (Count: ${ebWords.length})`);
                    }

                    if (fooWords.length === 0 || ebWords.length === 0) {
                        if (shouldLogDetails) console.log("      Title Match: Skipped (one or both normalized titles resulted in zero significant words).");
                        continue;
                    }

                    let commonWordCount = 0;
                    const ebWordsSet = new Set(ebWords);
                    for (const word of fooWords) {
                        if (ebWordsSet.has(word)) {
                            commonWordCount++;
                        }
                    }
                    
                    const minWordLengthForThreshold = Math.min(fooWords.length, ebWords.length);
                    let threshold;
                    if (minWordLengthForThreshold === 0) {
                        titleMatch = false;
                        if (shouldLogDetails) console.log("      Title Match: Skipped (minWordLengthForThreshold is 0).");
                    } else if (minWordLengthForThreshold === 1) {
                        threshold = 1;
                    } else if (minWordLengthForThreshold <= 3) {
                        threshold = Math.max(1, Math.floor(minWordLengthForThreshold * 0.5));
                    } else {
                        threshold = Math.max(1, Math.floor(minWordLengthForThreshold * 0.6));
                    }
                    
                    if (minWordLengthForThreshold > 0) { // Only proceed if threshold was set
                        titleMatch = commonWordCount >= threshold;
                    }
                    if (shouldLogDetails) {
                        console.log(`      Title Word Comparison: Common words: ${commonWordCount}, Threshold: ${threshold} -> ${titleMatch}`);
                    }

                    if (titleMatch) {
                        if (shouldLogDetails) console.log("      >>> MATCH FOUND! <<<");
                        mappedEvents.push({
                            fooevents_internal_date_id: fooEvent.fooevents_internal_date_id,
                            eventbrite_occurrence_id: ebEvent.eventbrite_occurrence_id,
                            fooevents_title: fooEvent.fooevents_title,
                            eventbrite_title: ebEvent.eventbrite_title_full,
                            fooevents_date_str: fooEvent.fooevents_date_str,
                            eventbrite_date_str: ebEvent.eventbrite_start_datetime_str,
                            fooevents_time_str: fooEvent.fooevents_slot_time_str,
                            eventbrite_time_str: ebEvent.normalized_time // Using normalized as it's HH:MM
                        });
                        break;
                    }
                } else if (shouldLogDetails) {
                    console.log("      Title Match: Skipped (one or both normalized titles are empty).");
                }
            }
        }

        fs.writeFileSync(OUTPUT_FILE_PATH, JSON.stringify(mappedEvents, null, 2));
        console.log(`Successfully mapped ${mappedEvents.length} events to ${OUTPUT_FILE_PATH}`);

    } catch (error) {
        console.error("Error during script execution:", error.message);
        console.error(error.stack);
    }
}

main();
