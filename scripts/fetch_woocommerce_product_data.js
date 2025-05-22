/*
  High-level: Fetches WooCommerce product data for a specific FooEvents booking slot and date,
  extracts relevant booking slot information, and writes a detailed markdown report.
*/

// fetch_woocommerce_product_data.js

// Import necessary modules
require('dotenv').config();
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const fs = require('fs');



// WooCommerce API credentials and Product ID from .env and task
const WOOCOMMERCE_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY;
const WOOCOMMERCE_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET;
const BASE_URL = process.env.BASE_URL;
const PRODUCT_ID = '4156'; // WooCommerce Product ID
const TARGET_SLOT_NAME = "May Show";
const TARGET_BOOKING_DATE = "May 12, 2025";
const OUTPUT_FILE_NAME = 'woocommerce_product_data_reference.md';

// Initialize WooCommerce API
const api = new WooCommerceRestApi({
  url: `https://${BASE_URL}`,
  consumerKey: WOOCOMMERCE_CONSUMER_KEY,
  consumerSecret: WOOCOMMERCE_CONSUMER_SECRET,
  version: "wc/v3"
});

async function fetchProductDataAndWriteToFile() {
  console.log(`Starting to fetch data for Product ID: ${PRODUCT_ID}, Slot: "${TARGET_SLOT_NAME}", Date: "${TARGET_BOOKING_DATE}"`);

  try {
    // 1. Fetch Event Product Data
    console.log(`Fetching product data for ID: ${PRODUCT_ID}...`);
    const { data: product } = await api.get(`products/${PRODUCT_ID}`);
    console.log('Product data fetched successfully.');

    if (!product || !product.meta_data) {
      console.error('Error: Product data or meta_data is missing.');
      return;
    }

    // 2. Locate and Process Booking Slot Configuration
    const bookingMetaKey = 'fooevents_bookings_options_serialized';
    let fooEventsBookingsMeta = product.meta_data.find(meta => meta.key === bookingMetaKey);

    if (!fooEventsBookingsMeta || !fooEventsBookingsMeta.value) {
      console.error(`Error: FooEvents booking meta data with key "${bookingMetaKey}" not found or has no value.`);
      console.log('All meta_data:', JSON.stringify(product.meta_data, null, 2));
      return;
    }

    console.log(`Found booking meta data with key: "${bookingMetaKey}".`);

    let bookingData;
    if (typeof fooEventsBookingsMeta.value === 'string') {
      try {
        bookingData = JSON.parse(fooEventsBookingsMeta.value);
        console.log('Successfully parsed booking data (assumed JSON string).');
      } catch (e) {
        console.error('Error parsing booking data string. It might be PHP serialized or another format not directly parsable by JSON.parse.', e);
        console.error('Booking data string:', fooEventsBookingsMeta.value);
        return;
      }
    } else if (typeof fooEventsBookingsMeta.value === 'object' && fooEventsBookingsMeta.value !== null) {
      bookingData = fooEventsBookingsMeta.value; // Already an object/array
      console.log('Booking data is already an object/array.');
    } else {
      console.error('Error: Booking data is not a string or a recognizable object. Type:', typeof fooEventsBookingsMeta.value);
      return;
    }

    // 3. Specifically locate the data for the "May Show" slot on "May 12, 2025"
    let specificSlotData = null;
    let slotFound = false;

    if (typeof bookingData === 'object' && bookingData !== null) {
      for (const slotId in bookingData) {
        if (bookingData.hasOwnProperty(slotId)) {
          const slot = bookingData[slotId];
          if (slot.label === TARGET_SLOT_NAME && slot.add_date && typeof slot.add_date === 'object') {
            for (const dateId in slot.add_date) {
              if (slot.add_date.hasOwnProperty(dateId)) {
                const dateEntry = slot.add_date[dateId];
                if (dateEntry.date === TARGET_BOOKING_DATE) {
                  specificSlotData = {
                    slotId: slotId,
                    slotLabel: slot.label,
                    dateId: dateId,
                    date: dateEntry.date,
                    stock: dateEntry.stock,
                    capacity: dateEntry.num // Assuming 'num' is capacity, adjust if different
                  };
                  console.log(`Found target slot: "${TARGET_SLOT_NAME}" on "${TARGET_BOOKING_DATE}". Stock: ${dateEntry.stock}`);
                  slotFound = true;
                  break;
                }
              }
            }
          }
          if (slotFound) break;
        }
      }
    } else {
      console.error("Error: Booking data is not in the expected object format. Cannot find slot.");
    }

    if (!slotFound) {
      console.warn(`Warning: Slot "${TARGET_SLOT_NAME}" for date "${TARGET_BOOKING_DATE}" not found in booking data.`);
    }

    // 4. Format the output for Markdown
    let markdownContent = `# WooCommerce Product Data Reference for Product ID: ${PRODUCT_ID}\n\n`;
    markdownContent += `Date Fetched: ${new Date().toISOString()}\n\n`;

    markdownContent += `## Full Product Data (JSON)\n\n`;
    markdownContent += '```json\n' + JSON.stringify(product, null, 2) + '\n```\n\n';

    markdownContent += `## Specific Slot Information: "${TARGET_SLOT_NAME}" on "${TARGET_BOOKING_DATE}"\n\n`;
    if (specificSlotData) {
      markdownContent += `**Slot ID:** ${specificSlotData.slotId}\n`;
      markdownContent += `**Slot Label:** ${specificSlotData.slotLabel}\n`;
      markdownContent += `**Date ID:** ${specificSlotData.dateId}\n`;
      markdownContent += `**Date:** ${specificSlotData.date}\n`;
      markdownContent += `**Current Stock:** ${specificSlotData.stock}\n`;
      markdownContent += `**Capacity (num):** ${specificSlotData.capacity || 'N/A'}\n\n`; // Display N/A if capacity is not found
      markdownContent += `### Raw Slot Date Entry (JSON)\n\n`;
      markdownContent += '```json\n' + JSON.stringify(bookingData[specificSlotData.slotId].add_date[specificSlotData.dateId], null, 2) + '\n```\n\n';
    } else {
      markdownContent += `**Could not find specific data for slot "${TARGET_SLOT_NAME}" on date "${TARGET_BOOKING_DATE}".**\n\n`;
      markdownContent += `### Full Parsed Booking Data for Review (fooevents_bookings_options_serialized)\n\n`;
      markdownContent += '```json\n' + JSON.stringify(bookingData, null, 2) + '\n```\n\n';
    }

    // 5. Write this formatted content to a new file
    fs.writeFile(OUTPUT_FILE_NAME, markdownContent, (err) => {
      if (err) {
        console.error(`Error writing to file ${OUTPUT_FILE_NAME}:`, err);
        return;
      }
      console.log(`Successfully wrote product data to ${OUTPUT_FILE_NAME}`);
    });

  } catch (error) {
    console.error('An error occurred during the process:');
    if (error.response) {
      // API error
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      // Request made but no response
      console.error('Request Error:', error.request);
    } else {
      // Something else happened
      console.error('Error Message:', error.message);
    }
    console.error('Full error object:', error);
  }
}

// Check if .env variables are loaded
if (!WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET || !BASE_URL) {
  console.error("Error: Missing WooCommerce API credentials or Base URL in .env file.");
  console.log("Please ensure WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET, and BASE_URL are set.");
} else {
  fetchProductDataAndWriteToFile();
}
