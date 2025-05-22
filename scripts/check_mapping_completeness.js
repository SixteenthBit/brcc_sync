/*
  High-level: Checks completeness of event mappings between FooEvents and Eventbrite by reading event data from markdown files and mapping JSON, then reports unmapped events.
*/

/**
 * Script to check completeness of event mappings between FooEvents and Eventbrite.
 * Reads event data from markdown files and mapping JSON, then reports unmapped events.
 */


const fs = require('fs');



// --- Configuration ---
const FOOEVENTS_MD_FILE_PATH = 'woocommerce_fooevents_full_list.md';
const EVENTBRITE_MD_FILE_PATH = 'docs_and_reference/live_event_list.md';
const MAPPING_JSON_FILE_PATH = 'event_mapping.json';

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
]);

// --- Helper Functions (adapted from map_event_ids.js) ---

function normalizeFooEventsDate(dateStr) {
    if (!dateStr || dateStr.toLowerCase() === 'n/a') {
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
                    return `${year}-${month}-${day}`;
                 }
             }
            return 'N/A';
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        return 'N/A';
    }
}

function normalizeFooEventsTime(timeStr) {
    if (!timeStr || timeStr.toLowerCase() === 'n/a') {
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
        } else if (period === 'am' && hours === 12) { // Midnight case
            hours = 0;
        }
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    return 'N/A';
}

function normalizeTitleForComparison(title) {
    if (!title) return "";
    let normalized = title.toLowerCase();
    normalized = normalized.replace(/\s+-\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s+\d{4})?$/i, '');
    normalized = normalized.replace(/\s+-\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?$/i, '');
    const words = normalized.replace(/[^\w\s-]/gi, '').split(/\s+/);
    const filteredWords = words.filter(word => {
        const cleanWord = word.replace(/[^\w]/gi, '');
        return cleanWord.length > 0 && !commonWordsToRemove.has(cleanWord);
    });
    return filteredWords.join(' ').trim();
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
            
            let fooevents_slot_time_str = 'N/A';
            let slot_label_derived_time_str = null;

            const timeMatch = dateSection.match(/^- \*\*Time:\*\*\s*(.*)/m);
            if (timeMatch) {
                fooevents_slot_time_str = timeMatch[1].trim();
            }

            const slotLabelMatch = dateSection.match(/^- \*\*Slot Label:\*\*\s*(.*?)(?:\s+-\s+.*|\s*\(.*\)|$)/m);
            if (slotLabelMatch) {
                const slotLabelContent = slotLabelMatch[1].trim();
                const timeFromLabelMatch = slotLabelContent.match(/^(\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|am|pm))/i);
                if (timeFromLabelMatch) {
                    slot_label_derived_time_str = timeFromLabelMatch[1];
                }
            }
            
            // For completeness check, we primarily need the raw strings and IDs
            fooEventsEntries.push({
                fooevents_title: currentProductTitle,
                fooevents_date_str: fooevents_date_str,
                fooevents_internal_date_id: fooevents_internal_date_id,
                fooevents_slot_time_str: fooevents_slot_time_str, // Keep original for reporting
                // Include normalized versions if needed by other parts, but not strictly for this script's core logic
                // normalized_date: normalizeFooEventsDate(fooevents_date_str),
                // normalized_time: normalizeFooEventsTime(fooevents_slot_time_str !== 'N/A' ? fooevents_slot_time_str : slot_label_derived_time_str),
                // normalized_title: normalizeTitleForComparison(currentProductTitle)
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
    const startDateRegex = /^- \*\*Start Date:\*\*\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)?)/m; // Adjusted regex for timezone

    for (const section of eventSections) {
        const lines = section.split('\n');
        const eventbrite_title_full = lines[0].trim();

        const occurrenceMatch = section.match(occurrenceIdRegex);
        const startDateMatch = section.match(startDateRegex);

        if (occurrenceMatch && startDateMatch) {
            const eventbrite_occurrence_id = occurrenceMatch[1];
            const eventbrite_start_datetime_str = startDateMatch[1];

            events.push({
                eventbrite_title: eventbrite_title_full, // Renamed for clarity as per instructions
                eventbrite_occurrence_id: eventbrite_occurrence_id,
                eventbrite_start_datetime_str: eventbrite_start_datetime_str,
                // normalized_date: eventbrite_start_datetime_str.substring(0, 10),
                // normalized_time: eventbrite_start_datetime_str.substring(11, 16),
                // normalized_title: normalizeTitleForComparison(eventbrite_title_full)
            });
        }
    }
    return events;
}

// --- Main Logic ---
function main() {
    try {
        // 1. File Reading
        const fooEventsData = parseFooEvents(FOOEVENTS_MD_FILE_PATH);
        const eventbriteData = parseEventbrite(EVENTBRITE_MD_FILE_PATH);
        
        let mappedEventEntries = [];
        try {
            const mappingFileContent = fs.readFileSync(MAPPING_JSON_FILE_PATH, 'utf-8');
            mappedEventEntries = JSON.parse(mappingFileContent);
        } catch (error) {
            console.error(`Error reading or parsing ${MAPPING_JSON_FILE_PATH}: ${error.message}`);
            // Depending on desired behavior, you might want to exit or proceed with empty mappings
            // For this script, proceeding with empty mappings makes sense to show all as unmapped.
        }

        // 3. Identifying Mapped IDs
        const mappedFooEventsIds = new Set();
        const mappedEventbriteIds = new Set();

        for (const mapping of mappedEventEntries) {
            if (mapping.fooevents_internal_date_id) {
                mappedFooEventsIds.add(mapping.fooevents_internal_date_id);
            }
            if (mapping.eventbrite_occurrence_id) {
                mappedEventbriteIds.add(mapping.eventbrite_occurrence_id);
            }
        }

        // 4. Finding Unmapped FooEvents Instances
        const unmappedFooEvents = [];
        for (const fooEvent of fooEventsData) {
            if (!mappedFooEventsIds.has(fooEvent.fooevents_internal_date_id)) {
                unmappedFooEvents.push({
                    fooevents_internal_date_id: fooEvent.fooevents_internal_date_id,
                    fooevents_title: fooEvent.fooevents_title,
                    fooevents_date_str: fooEvent.fooevents_date_str,
                    fooevents_slot_time_str: fooEvent.fooevents_slot_time_str
                });
            }
        }

        // 5. Finding Unmapped Eventbrite Occurrences
        const unmappedEventbriteOccurrences = [];
        for (const ebEvent of eventbriteData) {
            if (!mappedEventbriteIds.has(ebEvent.eventbrite_occurrence_id)) {
                unmappedEventbriteOccurrences.push({
                    eventbrite_occurrence_id: ebEvent.eventbrite_occurrence_id,
                    eventbrite_title: ebEvent.eventbrite_title,
                    eventbrite_start_datetime_str: ebEvent.eventbrite_start_datetime_str
                });
            }
        }

        // 6. Console Output Report
        console.log("--- Mapping Completeness Check Summary ---");
        console.log(`Total FooEvents instances parsed from markdown: ${fooEventsData.length}`);
        console.log(`Total Eventbrite occurrences parsed from markdown: ${eventbriteData.length}`);
        console.log(`Number of mappings found in ${MAPPING_JSON_FILE_PATH}: ${mappedEventEntries.length}`);
        console.log(`Number of unmapped FooEvents instances: ${unmappedFooEvents.length}`);
        console.log(`Number of unmapped Eventbrite occurrences: ${unmappedEventbriteOccurrences.length}`);
        console.log("---");

        if (unmappedFooEvents.length > 0) {
            console.log("\n--- Unmapped FooEvents Instances (Not found in event_mapping.json) ---");
            unmappedFooEvents.forEach((event, index) => {
                console.log(`[${index + 1}]. Internal Date ID: ${event.fooevents_internal_date_id}`);
                console.log(`     Title: ${event.fooevents_title}`);
                console.log(`     Date: ${event.fooevents_date_str}`);
                console.log(`     Time: ${event.fooevents_slot_time_str}`);
                console.log(`     Reason: No corresponding match found in Eventbrite data based on current criteria in ${MAPPING_JSON_FILE_PATH}.`);
            });
            console.log("---");
        } else {
            console.log("\nAll FooEvents instances were successfully mapped.");
        }

        if (unmappedEventbriteOccurrences.length > 0) {
            console.log("\n--- Unmapped Eventbrite Occurrences (Not found in event_mapping.json) ---");
            unmappedEventbriteOccurrences.forEach((event, index) => {
                console.log(`[${index + 1}]. Occurrence ID: ${event.eventbrite_occurrence_id}`);
                console.log(`     Title: ${event.eventbrite_title}`);
                console.log(`     Start Date/Time: ${event.eventbrite_start_datetime_str}`);
                console.log(`     Reason: No corresponding match found in FooEvents data based on current criteria in ${MAPPING_JSON_FILE_PATH}.`);
            });
            console.log("---");
        } else {
            console.log("\nAll Eventbrite occurrences were successfully mapped.");
        }

    } catch (error) {
        console.error("\nError during script execution:", error.message);
        console.error(error.stack);
    }
}

main();
