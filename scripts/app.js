/*
  High-level: Fetches live events from Eventbrite API for a specific organization,
  processes and groups them by series, and outputs a detailed markdown file listing event details.
*/

// Script to fetch live events from Eventbrite API, process and group them, and output a markdown file listing event details.

// Load environment variables from .env file
require('dotenv').config();




// Import necessary modules
const https = require('https');
const fs = require('fs'); // To write to the markdown file
const path = require('path'); // To handle directory creation

// Eventbrite API endpoint and access token
const eventbriteToken = process.env.private_token;
const organizationId = '698566935713'; // Replace with your Organization ID
const outputFilePath = 'docs_and_reference/live_event_list.md';

// Helper function to format date to "Month Day" (e.g., "May 10")
function formatFriendlyDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  } catch (e) {
    return dateString; // Fallback to original string if parsing fails
  }
}

// Function to fetch a single page of events
function fetchEventPage(continuationToken = null) {
  return new Promise((resolve, reject) => {
    // Added 'series_id' to potential fields, though it's not explicitly in basic event object docs.
    // The API might return it if an event is part of a series.
    // Also expanding 'ticket_classes' here to see if it helps, though typically fetched separately.
    let apiUrl = `https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/?status=live&expand=category,subcategory,event_sales_status,ticket_availability,series_parent`;
    if (continuationToken) {
      apiUrl += `&continuation=${continuationToken}`;
    }

    const options = {
      headers: {
        'Authorization': `Bearer ${eventbriteToken}`,
      },
    };

    https.get(apiUrl, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(`API Error: ${response.error_description || response.error} (Status: ${response.status_code})`));
          } else {
            resolve(response);
          }
        } catch (error) {
          reject(new Error(`Error parsing JSON: ${error.message}. Received data: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`HTTPS Request Error: ${error.message}`));
    });
  });
}

// Function to fetch ticket classes for an event (ensuring name is included)
function fetchTicketClasses(eventId) {
  return new Promise((resolve, reject) => {
    const apiUrl = `https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/`;
    const options = {
      headers: {
        'Authorization': `Bearer ${eventbriteToken}`,
      },
    };

    https.get(apiUrl, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(`API Error fetching ticket classes for event ${eventId}: ${response.error_description || response.error}`));
          } else {
            // Ensure we return an array of objects with id and name
            const ticketClasses = (response.ticket_classes || []).map(tc => ({
              id: tc.id,
              name: tc.name ? tc.name.text || tc.name : 'Unnamed Ticket Class' // Handle multipart-text for name
            }));
            resolve(ticketClasses);
          }
        } catch (error) {
          reject(new Error(`Error parsing JSON for ticket classes (event ${eventId}): ${error.message}. Received data: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`HTTPS Request Error (ticket classes for event ${eventId}): ${error.message}`));
    });
  });
}

// Function to fetch all pages of live events
async function fetchAllLiveEvents() {
  let allEvents = [];
  let continuation = null;
  let pageNumber = 0;
  let totalObjectCount = 0;

  console.log(`Fetching all 'live' events for organization ID ${organizationId}...`);

  try {
    do {
      pageNumber++;
      console.log(`Fetching page ${pageNumber}...`);
      const response = await fetchEventPage(continuation);
      
      if (response.events && response.events.length > 0) {
        allEvents = allEvents.concat(response.events);
      }
      
      if (pageNumber === 1) {
        totalObjectCount = response.pagination.object_count;
      }
      
      continuation = response.pagination.has_more_items ? response.pagination.continuation : null;
      
      if (continuation) {
        console.log(`More items to fetch, next continuation token starts with: ${continuation.substring(0,10)}...`);
      }

    } while (continuation);

    console.log(`Successfully fetched ${allEvents.length} event occurrences across ${pageNumber} page(s). Expected total: ${totalObjectCount}.`);
    return allEvents;
  } catch (error) {
    console.error("Error fetching all events:", error.message);
    return []; // Return empty array on error to prevent further processing issues
  }
}

// Function to group events by name (which conceptually groups by series)
function groupEventsByName(events) {
  const groupedEvents = {};
  events.forEach(event => {
    const eventName = event.name && event.name.text ? event.name.text : 'Unnamed Event';
    if (!groupedEvents[eventName]) {
      groupedEvents[eventName] = [];
    }
    groupedEvents[eventName].push(event);
  });
  return groupedEvents;
}

// Function to format events for markdown
async function formatEventsForMarkdown(groupedEvents) {
  let markdownContent = `# Live Event List for Organization ID: ${organizationId}\n\n`;
  markdownContent += `**Note:** Events are grouped by their series name. Within each series, occurrences are listed chronologically. The field names used below are human-readable labels; the corresponding Eventbrite API fields are often similar. Here's a quick mapping:\n`;
  markdownContent += `- **Series ID**: Identifier for the overall event series (e.g., "10PM Saturdays").\n`;
  markdownContent += `- **Occurrence ID**: Identifier for a specific date/time instance of an event within a series (\`event.id\`).\n`;
  markdownContent += `- **Ticket Class ID**: Identifier for a type of ticket for a specific occurrence (\`ticket_classes[].id\`).\n\n`;

  for (const eventName in groupedEvents) {
    if (groupedEvents.hasOwnProperty(eventName)) {
      const occurrences = groupedEvents[eventName];
      if (!occurrences || occurrences.length === 0) continue;

      // Sort occurrences chronologically by start.utc
      occurrences.sort((a, b) => new Date(a.start.utc) - new Date(b.start.utc));

      // Attempt to find a common series_id or use the first event's ID as a fallback for the series.
      // The 'series_parent' expansion might populate event.series_parent.id or event.series_id
      let seriesIdToDisplay = occurrences[0].series_id || (occurrences[0].series_parent ? occurrences[0].series_parent.id : null);
      if (!seriesIdToDisplay) {
          // Fallback if no explicit series_id is found on the occurrence object.
          // This might happen if the API doesn't directly provide it in this context,
          // or if the event is not part of a series (though grouping by name implies it is).
          // The user's example URL structure suggests a distinct series ID exists.
          console.warn(`Warning: Could not determine a distinct series_id for event group "${eventName}". Falling back to the ID of the first occurrence (${occurrences[0].id}) for the main heading. This might not be the true 'series parent' ID if the API structures data differently.`);
          seriesIdToDisplay = occurrences[0].id; 
      }
      
      markdownContent += `## ${eventName} (Series ID: ${seriesIdToDisplay})\n\n`;

      for (const occurrence of occurrences) {
        const friendlyDate = formatFriendlyDate(occurrence.start.local);
        markdownContent += `### ${eventName} - ${friendlyDate}\n\n`;
        markdownContent += `- **Occurrence ID:** ${occurrence.id}\n`;
        markdownContent += `- **Start Date:** ${occurrence.start.local} (Timezone: ${occurrence.start.timezone})\n`;
        markdownContent += `- **Status:** ${occurrence.status || 'N/A'}\n`;

        let salesStatusDisplay = 'Not available or not determined.';
        if (occurrence.ticket_availability) {
            if (occurrence.ticket_availability.is_sold_out === true) {
                salesStatusDisplay = 'Sold Out (from ticket_availability)';
            } else if (occurrence.ticket_availability.is_sold_out === false) {
                const now = new Date();
                const salesStart = occurrence.ticket_availability.start_sales_date ? new Date(occurrence.ticket_availability.start_sales_date.utc) : null;
                const salesEnd = occurrence.ticket_availability.end_sales_date ? new Date(occurrence.ticket_availability.end_sales_date.utc) : null;

                if (salesStart && now < salesStart) {
                    salesStatusDisplay = `Sales haven't started yet (starts ${occurrence.ticket_availability.start_sales_date.local}) (from ticket_availability)`;
                } else if (salesEnd && now > salesEnd) {
                    salesStatusDisplay = `Sales ended on ${occurrence.ticket_availability.end_sales_date.local} (from ticket_availability)`;
                } else {
                    salesStatusDisplay = 'On Sale / Available (from ticket_availability)';
                }
            } else if (occurrence.ticket_availability.message_code) {
                salesStatusDisplay = `${occurrence.ticket_availability.message_code} (from ticket_availability.message_code)`;
            }
        } else if (occurrence.event_sales_status) {
            if (occurrence.event_sales_status.status) {
                salesStatusDisplay = `${occurrence.event_sales_status.status} (from event_sales_status.status)`;
            } else if (occurrence.event_sales_status.message_code) {
                salesStatusDisplay = `${occurrence.event_sales_status.message_code} (from event_sales_status.message_code)`;
            }
        }
        markdownContent += `- **Sales Status:** ${salesStatusDisplay}\n`;
        
        const categoryName = occurrence.category ? (occurrence.category.name_localized || occurrence.category.name) : 'N/A';
        markdownContent += `- **Category:** ${categoryName}\n`;
        const subCategoryName = occurrence.subcategory ? (occurrence.subcategory.name_localized || occurrence.subcategory.name) : 'N/A';
        markdownContent += `- **Subcategory:** ${subCategoryName}\n`;
        markdownContent += `- **Eventbrite URL:** [${occurrence.url || 'N/A'}](${occurrence.url || '#'}) \n`;

        try {
          const ticketClasses = await fetchTicketClasses(occurrence.id);
          if (ticketClasses && ticketClasses.length > 0) {
            markdownContent += `- **Ticket Classes:**\n`;
            for (const tc of ticketClasses) {
              markdownContent += `  - ID: ${tc.id} - Name: ${tc.name}\n`;
            }
          } else {
            markdownContent += `- **Ticket Classes:** No ticket classes found for this occurrence.\n`;
          }
        } catch (ticketError) {
          console.error(`Error fetching or processing ticket classes for occurrence ${occurrence.id}:`, ticketError.message);
          markdownContent += `- **Ticket Classes:** Error fetching ticket classes.\n`;
        }
        markdownContent += '\n---\n\n';
      }
    }
  }
  return markdownContent;
}

// Main function to run the process
async function main() {
  const fetchedEvents = await fetchAllLiveEvents();
  if (!fetchedEvents || fetchedEvents.length === 0) {
    console.log("No events fetched or an error occurred. Exiting.");
    // Optionally write an error or empty state to the markdown file
    try {
        const outputDir = path.dirname(outputFilePath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(outputFilePath, "# Live Event List\n\nNo events found or an error occurred during fetching.");
        console.log(`Wrote empty/error state to ${outputFilePath}`);
    } catch (writeError) {
        console.error(`Error writing empty/error state to file ${outputFilePath}:`, writeError);
    }
    return;
  }

  const groupedEvents = groupEventsByName(fetchedEvents);
  const markdownOutput = await formatEventsForMarkdown(groupedEvents);

  try {
    const outputDir = path.dirname(outputFilePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    }
    fs.writeFileSync(outputFilePath, markdownOutput);
    console.log(`Successfully wrote all live event details to ${outputFilePath}`);
  } catch (error) {
    console.error(`Error writing to file ${outputFilePath}:`, error);
  }
}

main();
