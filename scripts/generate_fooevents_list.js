/*
  High-level: Generates a markdown list of FooEvents booking slots and dates for specified WooCommerce products,
  fetching product data via WooCommerce API, extracting FooEvents booking metadata, and formatting it for documentation.
*/

require('dotenv').config();
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const fs = require('fs').promises;
const path = require('path');

const productIdsToProcess = [
    31349, 37273, 37271, 37268, 37294, 30897, 37388, 31907, 13918, 37291, 35549, 6410, 11192, 4157, 4154, 4061, 4060, 3986
];

const wooCommerce = new WooCommerceRestApi({
    url: process.env.WOOCOMMERCE_API_URL,
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY,
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET,
    version: "wc/v3"
});

console.log('WooCommerce API Initialized with URL:', process.env.WOOCOMMERCE_API_URL);
console.log('WooCommerce API Consumer Key Loaded:', !!process.env.WOOCOMMERCE_CONSUMER_KEY);
console.log('WooCommerce API Consumer Secret Loaded:', !!process.env.WOOCOMMERCE_CONSUMER_SECRET);

const OUTPUT_FILE_PATH = path.join(__dirname, 'woocommerce_fooevents_full_list.md');

async function fetchProductData(productId) {
    try {
        const response = await wooCommerce.get(`products/${productId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching product ${productId}:`, error.response ? error.response.data : error.message);
        return null;
    }
}

function extractFooEventsData(product) {
    if (!product || !product.meta_data) {
        console.log(`Product ID ${product ? product.id : 'Unknown'}: No product data or meta_data found.`);
        return null;
    }
    const fooEventsMeta = product.meta_data.find(meta => meta.key === 'fooevents_bookings_options_serialized');
    if (fooEventsMeta) {
        console.log(`Found 'fooevents_bookings_options_serialized' for Product ID: ${product.id}`);
        // console.log('Bookings meta value (snippet):', fooEventsMeta.value ? fooEventsMeta.value.substring(0, 100) : 'Value is empty/null');
        console.log('Bookings meta value type:', typeof fooEventsMeta.value);
        console.log('Bookings meta value length:', fooEventsMeta.value ? fooEventsMeta.value.length : 0);
    } else {
        console.log(`'fooevents_bookings_options_serialized' NOT found for Product ID: ${product.id}`);
        return null;
    }

    if (!fooEventsMeta.value) {
        console.warn(`Product ID ${product.id}: fooevents_bookings_options_serialized value is empty.`);
        return null;
    }

    try {
        const bookingsData = JSON.parse(fooEventsMeta.value);
        if (bookingsData && Object.keys(bookingsData).length > 0) {
            console.log(`Successfully parsed bookings for Product ID: ${product.id}. Number of slots: ${Object.keys(bookingsData).length}`);
            if (product.id === 3986) { // Debug for Wednesday Night at Backroom Comedy Club
                console.log('Debug bookingsData for Product ID 3986:', JSON.stringify(bookingsData, null, 2));
            }
        } else {
            console.log(`Parsed bookings for Product ID: ${product.id}, but no booking slots found or data is empty.`);
        }
        return bookingsData;
    } catch (error) {
        console.error(`Error parsing fooevents_bookings_options_serialized for product ${product.id}:`, error.message);
        console.error("Raw value (first 200 chars):", fooEventsMeta.value ? fooEventsMeta.value.substring(0, 200) : 'Value is empty/null');
        return null;
    }
}

function formatToMarkdown(productName, productId, fooEventsData) {
    if (!fooEventsData) {
        return `## [${productName}] (Product ID: ${productId})\n\n- No FooEvents booking data found or data was unparsable.\n\n---\n\n`;
    }

    let markdownContent = `## [${productName}] (Product ID: ${productId})\n\n`;

    for (const slotKey in fooEventsData) {
        if (Object.hasOwnProperty.call(fooEventsData, slotKey)) {
            const slot = fooEventsData[slotKey];
            const slotLabel = slot.label || 'N/A';

            // Construct time string from hour, minute, period if time is not present
            let slotTime = 'N/A';
            if (slot.time) {
                slotTime = slot.time;
            } else if (slot.hour && slot.minute && slot.period) {
                slotTime = `${slot.hour}:${slot.minute} ${slot.period}`;
            }

            markdownContent += `### Slot: ${slotLabel} (Internal Slot ID: ${slotKey})\n`;
            markdownContent += `- **Time:** ${slotTime}\n\n`;

            // Extract dates and stocks from keys ending with _add_date and _stock
            const dateKeys = Object.keys(slot).filter(key => key.endsWith('_add_date'));
            if (dateKeys.length > 0) {
                for (const addDateKey of dateKeys) {
                    const dateValue = slot[addDateKey] || 'N/A';
                    const stockKey = addDateKey.replace('_add_date', '_stock');
                    const stockValue = slot[stockKey] !== undefined ? slot[stockKey] : 'N/A';

                    markdownContent += `#### Date: ${dateValue} (Internal Date ID: ${addDateKey.replace('_add_date', '')})\n`;
                    markdownContent += `- **Stock/Capacity:** ${stockValue}\n`;
                    markdownContent += `---\n`;
                }
            } else if (slot.add_date && typeof slot.add_date === 'object') {
                // fallback to old structure if present
                for (const dateKey in slot.add_date) {
                    if (Object.hasOwnProperty.call(slot.add_date, dateKey)) {
                        const dateEntry = slot.add_date[dateKey];
                        const dateValue = dateEntry.date || 'N/A';
                        const stockValue = dateEntry.stock !== undefined ? dateEntry.stock : 'N/A';

                        markdownContent += `#### Date: ${dateValue} (Internal Date ID: ${dateKey})\n`;
                        markdownContent += `- **Stock/Capacity:** ${stockValue}\n`;
                        markdownContent += `---\n`;
                    }
                }
            } else {
                markdownContent += `- No specific dates found for this slot.\n---\n`;
            }
            markdownContent += `\n`; // Extra newline after each slot's dates
        }
    }
    return markdownContent + "\n"; // Extra newline after each product
}

async function generateFooEventsList() {
    let fullMarkdownOutput = "# WooCommerce FooEvents - Full Event Instance List\n\n";

    for (const productId of productIdsToProcess) {
        console.log(`Processing Product ID: ${productId}`); // Adjusted to match example
        const productData = await fetchProductData(productId);

        if (productData) {
            console.log(`Data received for Product ID: ${productId}`);
            const fooEventsData = extractFooEventsData(productData);
            const productName = productData.name || 'Unknown Product';
            fullMarkdownOutput += formatToMarkdown(productName, productId, fooEventsData);
        } else {
            console.log(`No data received for Product ID: ${productId}`);
            fullMarkdownOutput += `## [Unknown Product] (Product ID: ${productId})\n\n- Failed to fetch product data.\n\n---\n\n`;
        }
    }

    console.log(`Generated markdown content length: ${fullMarkdownOutput.length}`);
    console.log(`Attempting to write to ${OUTPUT_FILE_PATH}...`);
    try {
        await fs.writeFile(OUTPUT_FILE_PATH, fullMarkdownOutput);
        console.log(`Successfully wrote FooEvents list to ${OUTPUT_FILE_PATH}`);
    } catch (error) {
        console.error(`Error writing to file ${OUTPUT_FILE_PATH}:`, error.message);
        console.log(`File write FAILED for ${OUTPUT_FILE_PATH}.`);
    }
}

// To run the script, uncomment the line below or run it from another script.
generateFooEventsList();

module.exports = {
    generateFooEventsList,
    fetchProductData,
    extractFooEventsData,
    formatToMarkdown
};
