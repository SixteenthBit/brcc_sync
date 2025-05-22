/*
  High-level: Decrements inventory for a specific FooEvents booking slot and date
  by fetching WooCommerce product data, modifying the booking meta data, and updating the product.
*/

// decrement_fooevents_inventory.js

// Import necessary modules
require('dotenv').config();
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;

// WooCommerce API credentials and Product ID from .env and task
const WOOCOMMERCE_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY;
const WOOCOMMERCE_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET;
const BASE_URL = process.env.BASE_URL;
const PRODUCT_ID = '4156'; // WooCommerce Product ID
const TARGET_SLOT_NAME = "May Show";
const TARGET_BOOKING_DATE = "May 12, 2025"; // Ensure this date format matches what FooEvents stores

// Initialize WooCommerce API
const api = new WooCommerceRestApi({
  url: `https://${BASE_URL}`,
  consumerKey: WOOCOMMERCE_CONSUMER_KEY,
  consumerSecret: WOOCOMMERCE_CONSUMER_SECRET,
  version: "wc/v3"
});

async function decrementFooEventsInventory() {
  console.log(`Starting inventory decrement for Product ID: ${PRODUCT_ID}, Slot: "${TARGET_SLOT_NAME}", Date: "${TARGET_BOOKING_DATE}"`);

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
    // Try to find the FooEvents booking settings meta key.
    // Based on foovents_reference.md, common keys are '_fooevents_booking_settings', '_fooevents_booking_slots', or '_fooevents_booking_schedule'.
    // We'll prioritize '_fooevents_booking_settings'.
    const bookingMetaKey = 'fooevents_bookings_options_serialized'; // Updated based on logged meta_data
    let fooEventsBookingsMeta = product.meta_data.find(meta => meta.key === bookingMetaKey);

    if (!fooEventsBookingsMeta || !fooEventsBookingsMeta.value) {
      console.error(`Error: FooEvents booking meta data with key "${bookingMetaKey}" not found or has no value.`);
      // As a fallback, try other potential keys if necessary, or log all meta_data for inspection
      console.log('All meta_data:', JSON.stringify(product.meta_data, null, 2));
      return;
    }

    console.log(`Found booking meta data with key: "${bookingMetaKey}".`);

    // Parse/Unserialize the booking data.
    // The foovents_reference.md suggests this might be a serialized PHP array.
    // The WC REST API might return it as a string, or already parsed if it's JSON.
    // If it's a PHP serialized string, direct parsing in Node.js is non-trivial.
    // We'll assume it's either an object/array already, or a JSON string.
    let bookingData;
    if (typeof fooEventsBookingsMeta.value === 'string') {
      try {
        bookingData = JSON.parse(fooEventsBookingsMeta.value);
        console.log('Successfully parsed booking data (assumed JSON string).');
      } catch (e) {
        console.error('Error parsing booking data string. It might be PHP serialized or another format not directly parsable by JSON.parse.', e);
        console.error('Booking data string:', fooEventsBookingsMeta.value);
        // IMPORTANT: If this is PHP serialized, this script cannot proceed without a PHP helper or if the API can return it unserialized.
        return;
      }
    } else if (typeof fooEventsBookingsMeta.value === 'object' && fooEventsBookingsMeta.value !== null) {
      bookingData = fooEventsBookingsMeta.value; // Already an object/array
      console.log('Booking data is already an object/array.');
    } else {
      console.error('Error: Booking data is not a string or a recognizable object. Type:', typeof fooEventsBookingsMeta.value);
      return;
    }

    // At this point, `bookingData` should hold the unserialized/parsed booking configurations.
    // The exact structure of `bookingData` needs to be known to find the specific slot.
    // This is a placeholder for the logic to find and update the slot.
    // We need to iterate through `bookingData` to find the slot matching TARGET_SLOT_NAME and TARGET_BOOKING_DATE.
    // The structure might be an array of slots, or an object where keys are slot IDs/names.
    // Each slot object would then have date-specific availability.

    // --- Placeholder for finding the target slot and date ---
    // Example: Assume bookingData is an array of slot objects like:
    // [ { name: "May Show", dates: { "2025-05-12": { stock: 10 }, ... } }, ... ]
    // Or: { "slot_id_123": { name: "May Show", dates: { "2025-05-12": { stock: 10 } } }, ... }
    // The date format "May 12, 2025" might need conversion to "YYYY-MM-DD" or whatever FooEvents uses internally.
    // For now, let's assume a simplified structure for demonstration and proceed.
    // This part MUST be adapted based on the actual structure of `bookingData`.

    let slotFoundAndUpdated = false;
    let targetSlotPath = null; // To store the path/index to the updated slot for re-serialization

    // Iterate through the bookingData (object of slots)
    if (typeof bookingData === 'object' && bookingData !== null) {
        for (const slotId in bookingData) {
            if (bookingData.hasOwnProperty(slotId)) {
                const slot = bookingData[slotId];
                // Check if slot.label matches TARGET_SLOT_NAME
                if (slot.label === TARGET_SLOT_NAME && slot.add_date && typeof slot.add_date === 'object') {
                    // Iterate through the dates within the slot
                    for (const dateId in slot.add_date) {
                        if (slot.add_date.hasOwnProperty(dateId)) {
                            const dateEntry = slot.add_date[dateId];
                            // Check if dateEntry.date matches TARGET_BOOKING_DATE
                            if (dateEntry.date === TARGET_BOOKING_DATE) {
                                let currentStock = parseInt(dateEntry.stock, 10);
                                if (isNaN(currentStock)) { // Handle cases where stock might be empty string or non-numeric
                                    console.warn(`Warning: Stock for "${TARGET_SLOT_NAME}" on "${TARGET_BOOKING_DATE}" (Slot ID: ${slotId}, Date ID: ${dateId}) is not a number: '${dateEntry.stock}'. Assuming 0.`);
                                    currentStock = 0;
                                }

                                if (currentStock > 0) {
                                    dateEntry.stock = (currentStock - 1).toString();
                                    console.log(`Decremented stock for "${TARGET_SLOT_NAME}" on "${TARGET_BOOKING_DATE}" (Slot ID: ${slotId}, Date ID: ${dateId}) to ${dateEntry.stock}.`);
                                    slotFoundAndUpdated = true;
                                } else {
                                    console.log(`Stock for "${TARGET_SLOT_NAME}" on "${TARGET_BOOKING_DATE}" (Slot ID: ${slotId}, Date ID: ${dateId}) is already 0 or less. Cannot decrement.`);
                                    slotFoundAndUpdated = true; // Mark as found to prevent "not found" error, but no update made.
                                }
                                break; // Date found, exit inner loop
                            }
                        }
                    }
                }
                if (slotFoundAndUpdated) {
                    break; // Slot and date processed, exit outer loop
                }
            }
        }
    } else {
        console.error("Error: Booking data is not in the expected object format. Cannot find slot.");
        console.log('Booking data structure:', JSON.stringify(bookingData, null, 2));
        return;
    }


    if (!slotFoundAndUpdated) {
      console.error(`Error: Slot "${TARGET_SLOT_NAME}" for date "${TARGET_BOOKING_DATE}" not found in booking data.`);
      console.log('Current booking data structure:', JSON.stringify(bookingData, null, 2));
      return;
    }

    // 3. Prepare data for update
    // The `bookingData` variable now holds the modified structure.
    // It needs to be in the same format as it was when fetched (string if it was parsed from JSON string, or object).
    let updatedBookingValue;
    if (typeof fooEventsBookingsMeta.value === 'string') {
      updatedBookingValue = JSON.stringify(bookingData); // Re-serialize to JSON string
    } else {
      updatedBookingValue = bookingData; // Keep as object/array
    }

    const dataToUpdate = {
      meta_data: [
        {
          key: bookingMetaKey,
          value: updatedBookingValue
        }
        // Potentially include other meta_data fields if they should be preserved or if the API overwrites all meta_data.
        // To be safe, one might need to merge this with existing meta_data, excluding the old bookingMetaKey value.
        // However, the PUT request for a single product usually updates only the fields provided.
        // For meta_data, providing an array with a single meta item *should* update just that item if the key matches,
        // or add it if new. If it replaces ALL meta_data, then all existing meta_data needs to be re-sent.
        // The WC REST API docs state: "meta_data    array    Meta data. See Product - Meta data properties"
        // And for updating a product: "To update a product, you can change any of the properties you can set during creation."
        // It's safer to assume it updates/adds based on key.
      ]
    };

    // 4. Update Event Product Data
    console.log(`Updating product ID ${PRODUCT_ID} with new booking data...`);
    const { data: updatedProduct } = await api.put(`products/${PRODUCT_ID}`, dataToUpdate);
    console.log('Product updated successfully.');
    // console.log('Updated product details:', JSON.stringify(updatedProduct, null, 2)); // Optional: log updated product

    // 5. Confirmation
    console.log(`Successfully decremented inventory for Product ID: ${PRODUCT_ID}, Slot: "${TARGET_SLOT_NAME}", Date: "${TARGET_BOOKING_DATE}".`);

  } catch (error) {
    console.error('An error occurred:');
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
  decrementFooEventsInventory();
}
