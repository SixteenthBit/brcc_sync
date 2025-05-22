
Download API Blueprint
Eventbrite API v3
Introduction
About our API
New to APIs? Check out Intro to APIs first to get up to speed.

The Eventbrite API:

    Is REST-based (though we use POST instead of PUT).

    Uses OAuth2 for authorization.

    Always returns responses in JSON.

All URLs referenced in the API documentation have the following base: https://www.eventbriteapi.com/v3.

For the examples in this guide, we'll be using the python-requests library.
Authentication

    Get a Private Token

    (For App Partners) Authorize your Users

    Authenticate API Requests

1. Get a Private Token

a. Log in to your Eventbrite account and visit your API Keys page.

b. Copy your private token.

2. (For App Partners) Authorize your Users

Note: These steps enable you to perform API requests on behalf of other users. To perform API requests on your own behalf, skip to Authenticate API Requests.
Authorize Users

What You'll Need:

    API Key

    Client Secret

    Redirect URI

Note: To find this information, visit your API Key Management page.

The Eventbrite API uses OAuth 2.0 for authorization.

There are two ways to authorize users: Server-side and client-side. We strongly recommend handling authorization on the server side for security reasons.

    Server-Side Authorization (Recommended)

    a. Redirect users to our authorization URL, while including your API key and redirect URI as query parameters: https://www.eventbrite.com/oauth/authorize?response_type=code&client_id=YOUR_API_KEY&redirect_uri=YOUR_REDIRECT_URI

    When the user authorizes your app, your redirect URI will receive a request from our authorization server with your access code included as a query parameter.

    Here's an example of the URI you will be redirected to (with the access code included as a query parameter): http://localhost:8080/oauth/redirect?code=YOUR_ACCESS_CODE

    b. Send a POST request to https://www.eventbrite.com/oauth/token that specifies the grant type and includes your access code, client secret, and API key. This data should be sent as part of your request header.

    Here's an example of a POST request using cURL:

    curl --request POST \
    --url 'https://www.eventbrite.com/oauth/token' \
    --header 'content-type: application/x-www-form-urlencoded' \
    --data grant_type=authorization_code \
    --data 'client_id=API_KEY \
    --data client_secret=CLIENT_SECRET \
    --data code=ACCESS_CODE \
    --data 'redirect_uri=REDIRECT_URI'

    The server will verify the access code and call your redirect URI. The user's private token will be available in the JSON response. Use this private token to make API requests on behalf of this user.

    Client-Side Authorization

    a. Redirect users to our authorization URL, while including your API key and redirect URI as query parameters: https://www.eventbrite.com/oauth/authorize?response_type=token&client_id=YOUR_API_KEY&redirect_uri=YOUR_REDIRECT_URI

    When the user authorizes your app, your redirect URI will receive a request with the private token included as a query parameter.

Next up: Follow the steps in Authenticate API Requests.

3. Authenticate API Requests

To authenticate API requests, you'll need to include either your private token or your user's private token.

There are two ways of including your token in an API request:

    Authorization Header

    Include the following in your Authorization header (replacing MYTOKEN with your token):

    { Authorization: Bearer MYTOKEN }

    Query Parameter Authentication

    Include the following at the end of the URL (replacing MYTOKEN with your token):

    /v3/users/me/?token=MYTOKEN

For every user you would like to perform API requests on behalf of, repeat (For App Partners) Authorize your Users and Authenticate API Requests.
Best practices

These best practices ensure that your authentication and access to the Eventbrite API is successful and secure.
Do not use your private token directly in client-side code.

Before you make your application publicly available, ensure that your client-side code does not contain private tokens or any other private information.
Delete unneeded API keys

To minimize your exposure to attack, delete any private tokens that you no longer need.
Errors

When an error occurs during an API request, you will receive:

    An HTTP error status (in the 400-500 range)

    A JSON response containing more information about the error

A typical error response looks like this:


{
    "error": "VENUE_AND_ONLINE",
    "error_description": "You cannot both specify a venue and set online_event",
    "status_code": 400
}

See below for descriptions of what each line means:
Example 	Description
{ 	
"error": "VENUE_AND_ONLINE", 	“VENUE_AND_ONLINE” is an example of a constant string value for the error. This constant value is what you should base your error handling logic on, because this string won’t change depending on the locale or as the API changes over time.
"error_description": "You cannot both specify a venue and set online_event", 	"You cannot both specify a venue and set online_event" is an example of an error description value. This string usually contains a description of the error, and should only be displayed to developers, not your users.
"status_code": 400 	400 is an example of a status code value. This value mirrors the HTTP status code you will receive. It’s included for convenience, in case your HTTP client makes it difficult to get status codes, or has one error handler for all error codes.
} 	
Common Errors

You can find a listing of the individual errors for each endpoint on their endpoint entries, but there are also some common errors that all endpoints might return:
Status Code 	Text 	Description
301 	PERMANENTLY_MOVED 	Resource must be retrieved from a different URL.
400 	ACTION_NOT_PROCESSED 	Requested operation not processed.
400 	ARGUMENTS_ERROR 	There are errors with your arguments.
400 	BAD_CONTINUATION_TOKEN 	Invalid continuation token passed.
400 	BAD_PAGE 	Page number does not exist or is an invalid format (e.g. negative).
400 	BAD_REQUEST 	The resource you’re creating already exists.
400 	INVALID_ARGUMENT 	Invalid argument value passed.
400 	INVALID_AUTH 	Authentication/OAuth token is invalid.
400 	INVALID_AUTH_HEADER 	Authentication header is invalid.
400 	INVALID_BATCH 	Batched request is missing or invalid.
400 	INVALID_BODY 	A request body that was not in JSON format was passed.
400 	UNSUPPORTED_OPERATION 	Requested operation not supported.
401 	ACCESS_DENIED 	Authentication unsuccessful.
401 	NO_AUTH 	Authentication not provided.
403 	NOT_AUTHORIZED 	User has not been authorized to perform that action.
404 	NOT_FOUND 	Invalid URL.
405 	METHOD_NOT_ALLOWED 	Method is not allowed for this endpoint.
409 	REQUEST_CONFLICT 	Requested operation resulted in conflict.
429 	HIT_RATE_LIMIT 	Hourly rate limit has been reached for this token. Default rate limits are 2,000 calls per hour.
500 	EXPANSION_FAILED 	Unhandled error occurred during expansion; the request is likely to succeed if you don’t ask for expansions, but contact Eventbrite support if this problem persists.
500 	INTERNAL_ERROR 	Unhandled error occurred in Eventbrite. contact Eventbrite support if this problem persists.
Paginated Responses
What's in a paginated response?

An Eventbrite paginated response is made up of two main sections: A pagination header and a list of objects.

Here's an example of a paginated response:

{
  "pagination": {
    "object_count": 4,
    "continuation": "AEtFRyiWxkr0ZXyCJcnZ5U1-uSWXJ6vO0sxN06GbrDngaX5U5i8XYmEuZfmZZYB9Uq6bSizOLYoV",
    "page_count": 2,
    "page_size": 2,
    "has_more_items": true,
    "page_number": 1
  },
  "categories": [
    {
      "slug": "email",
      "name_localized": "Email",
      "name": "Email",
      "id": "7"
    },
    {
      "slug": "website",
      "name_localized": "Website",
      "name": "Website",
      "id": "5"
    },
  ]
}

Here are descriptions of what each attribute within a pagination header means:
Attribute 	Example 	Description
object_count 	4 	The total number of objects found in your response, across all pages.
continuation 	AEtFRyiWxkr0Z
XyCJcnZ5U1-uS
WXJ6vO0sxN06G
brDngaX5U5i8X
YmEuZfmZZYB
9Uq6bSizOLYoV 	The continuation token you'll use to get to the next set of results by making the same request again but including this token. Your results will always include a new continuation token that you can use to jump to the next page. When all records have been retrieved, the continuation token will return an empty list of objects.
page_count 	2 	The total number of pages found in your response.
page_size 	2 	The maximum number of objects that can be returned per page for this API endpoint.
has_more_items 	true 	Boolean indicating whether or not there are more items in your response. In this example, the object is “true”, so there are more items. When all records have been retrieved, this attribute will be “false”.
page_number 	1 	The page number you are currently viewing (always starts at 1).
Using a continuation token

Here's how to use a continuation token to jump to the next page of results:

    Make a call to any listing endpoint that retrieves a paginated response.

    Your format will vary, but it might look something like this: GET https://www.eventbriteapi.com/v3/categories/.

    Verify that the “has_more_items” attribute is “true” before continuing. If it is “false”, there are no additional pages to retrieve, so you can stop here.

    Copy the continuation token from your response.

    Call the endpoint again, after adding a continuation token as a query string parameter to the URI.

    Your call format will vary, but it might look something like this: https://www.eventbriteapi.com/v3/categories/?continuation=AEtFRyiWxkr0ZXyCJcnZ5U1-uSWXJ6vO0sxN06GbrDngaX5U5i8XYmEuZfmZZYB9Uq6bSizOLYoV

    Repeat until all desired records have been retrieved.

Expansions

Eventbrite has many models that refer to each other, and often you’ll want to fetch related data along with the primary model you’re querying—for example, you may want to fetch an organizer along with each event you get back. The way of doing this in the Eventbrite API is called "expansions": you can specify a set of relationships to additionally fetch with every call, which reduces the number of API requests you must make to obtain your data.

When using expansions, note that each expansion you specify will slow down your API request slightly, so try to use as few expansions as possible to ensure faster response times.

The available expansions are based on the type of object that the API is returning; each of the return formats lists available expansions, as you can see in the event and attendee documentation, for example.
Requesting Expansions

The Eventbrite API is currently undergoing an upgrade to its expansions system, so the ways you request an expansion varies based on the API endpoint. The two sections below describe the two different request formats, but important is determining which request format an API endpoint supports.

If an endpoint's top-level response object contains an attribute named _type, that endpoint has been upgraded to Expansions v2 and also supports Expansions v1 for backwards compatibility. If the top-level response object does not contain an attribute named _type, it has not yet been upgraded and supports only Expansions v1 at this time.

At some point in the future, after all endpoints have been upgraded to Expansions v2, Expansions v1 will be deprecated and then later removed. Eventbrite will communicate this deprecation period and removal date when the upgrade is complete and that decision has been made.
Expansions v1

If you are already an API user, this is the expansions system with which you are likely already familiar. To request an expansion, pass a comma-separated list of expansion names as the expand= querystring argument in your URL.

For example, to fetch all my own events with organizers and venues expanded:

/v3/users/me/owned_events/?expand=organizer,venue

Sometimes you might want to expand the attributes of an object that has itself been returned by an expansion.

For example, you may have a list of orders and want to retrieve the event for each of those orders and the venue for each of those events:

/v3/users/me/orders/?expand=event.venue

Expansions can be nested in this way up to four levels deep.
Expansions v2 (Recommended if Available)

This new version of expansions is similar, but keys off the _type attributes in the response. A response contains either a top-level object or a list of top-level objects. In that object or those objects, attribute values might be other objects or lists of objects. All objects that support expansions will contain a _type attribute, and within a list of objects, the value of _type will be the same for all objects. When requesting an expansion, you pass a series of expand.[value of _type]= querystring arguments in the URL, with the value of each argument being the list of requested expansions for that object type.

Given a normal, non-expanded response like this:

{
    "_type": "event",
    "name": "My Cool Event",
    "organizer_id": "1234",
    "venue_id": "5678",
    ...
}

You could expand the organizer and venue with the following argument:

?expand.event=organizer,venue

Which would result in the following change to the response:

{
    "_type": "event",
    "name": "My Cool Event",
    "organizer_id": "1234",
    "organizer": {
        "id": "1234",
        ...
    },
    "venue_id": "5678",
    "venue": {
        "id": "5678",
        ...
    },
    ...
}

Expansions v2 normally makes no distinction between top-level and nested expansions. Expansions belong to object types, not response levels, so you can achieve "nested" expansions by specifying expansions for all the object types you expect to receive and want to expand at any level. For example, given a normal, non-expanded response like this:

{
    "_type": "order",
    "event_id": "9012",
    ...
}

You can expand not only the order's event, but also the event's organizer and venue, with these arguments:

?expand.order=event&expand.event=organizer,venue

And receive a new response like this:

{
    "_type": "order",
    "event_id": "9012",
    "event": {
        "_type": "event",
        "name": "My Cool Event",
        "organizer_id": "1234",
        "organizer": {
            "id": "1234",
            ...
        },
        "venue_id": "5678",
        "venue": {
            "id": "5678",
            ...
        },
        ...
    },
    ...
}

However, this will expand all order events and all event organizers and venues, at any level, which may not be what you wish to achieve. If you know you want an item expanded only at a certain level, you can instead use nested expansions. These arguments are equivalent to the previous example:

?expand.order=event,event.organizer,event.venue

All of these examples are just that—examples. The exact format of a response, and its available expansions, will depend entirely on which API endpoint you are calling.
API Switches
What do switches do?

Switches allow for the dynamic modification of Eventbrite API endpoint behaviors. They can be used to enable new or experimental features, change response formats, and other behaviors. In general, switches are used to ease the process of phasing in new API features that would otherwise break clients. Clients may activate or deactivate switchable features by setting switch headers on API requests.
Switch lifecycle

A feature and its switch go through three phases:

    Opt-in, in which a new switch will be available to turn on the new feature.

    Opt-out, in which the feature will be on by default and the switch will be available to turn it off.

    Fully integrated, at which time the switch will be deprecated.

    Eventbrite will notify all API consumers before any switchable feature is introduced or enters a new phase.

Public and protected switches

Switches may be exposed only to certain clients, at Eventbrite’s discretion. Such switches will be restricted to a set of whitelisted API keys, and any client attempting to set a protected switch using a non-whitelisted API key will get a permission error.

Switches that are not protected are available to be used by any client.
Using switches
Making a request using switch headers

Clients use request headers to set switches on API requests. A switch header may contain any number of switch names, separated by commas. Switch names consist of letters, numbers and underscores, and are case-insensitive.

To use the example of a switch called “EVENT_FORMAT_OCT_2016” that activates a new Event serialization format:

GET /v3/events/12345/ Eb-Api-Switches-Enabled: EVENT_FORMAT_OCT_2016
This call will return the event with ID 12345 using the new format.

If the same switch were opt-out, and the client needed to make a request using the old Event format, it would deactivate the switch like so:

GET /v3/events/12345/ Eb-Api-Switches-Disabled: EVENT_FORMAT_OCT_2016
This call would return the event using the old format.

Errors

A request containing switch headers may return the following error codes:

409 REQUEST_CONFLICT: Conflicting switches were passed. This happens if the client passes the same switch in both the Enabled and Disabled headers. 403 NOT_AUTHORIZED: The client sent a header for a switch that it is not allowed to set. 400 BAD_REQUEST: The client sent a header for a switch that does not exist or has been deprecated.
Basic Types
Integer

10

A standard JSON integer.
Boolean

true

A standard JSON boolean.
String

"Ihre Aal ist r\u00fcckw\u00e4rts"

A standard JSON string.

(When POSTing data as application/x-www-form-urlencoded, use a UTF-8 encoded string instead rather than unicode escapes)
Float

72.19381730

A standard JSON floating-point decimal.
Decimal

"72.19381730"

An arbitrary-precision decimal number encoded as a standard JSON string. Decimals are used in cases where floating-point arithmetic inaccuracies could arise with standard JSON floating-point decimals.
Date Types

There are four types of date formats:

    Date

    Datetime

    Local Datetime

    Datetime with Timezone

Date

"2010-01-31"

Date represents a date as a string in ISO8601 date format. If you wish to represent a time as well, you'll need to use Datetime, Local Datetime, or Datetime with Timezone.
Datetime

"2010-01-31T13:00:00Z"

Datetime represents a date and time as a string in ISO8601 combined date and time format in UTC (Coordinated Universal Time).
Local Datetime

"2010-01-31T13:00:00"

Local Datetime represents a date and time as a string in Naive Local ISO8601 date and time format in the timezone of the event.
Datetime with Timezone

This value is only used for fields where the timezone itself is important information (for example, event start times).

{
    "timezone": "America/Los_Angeles",
    "utc": "2018-05-12T02:00:00Z",
    "local": "2018-05-11T19:00:00"
}

Value 	Type 	Description
"timezone": "America/Los_Angeles" 	string 	A timezone value from the Olson specification
"utc": "2018-05-12T02:00:00Z" 	datetime 	A datetime value in the UTC timezone
"local": "2018-05-11T19:00:00 	datetime 	A datetime value in the named timezone

When being sent as a request:

    utc and timezone are required

    local is ignored

List

[1, 2, 3, 4]
"1,2,3,4"

A list of literal values. With a content-type of application/json, it should be a JSON array of literals, otherwise, for application/x-www-form-urlencoded it should be a string than is a comma separated list of values.
Object List

[{"name1": "val1", "name2": "val2"}, {...}]
"[{\"name1\": \"val1\", \"name2\": \"val2\"}, {...}]"

A JSON list of object values. With a content-type of application/json, it should be a JSON array, otherwise, for application/x-www-form-urlencoded it should be a string encoding of a JSON array.
Dictionary

{"key1": "value1", "key2": {"objectkey": "value"}, "key3": [list_values], {...}}
"{\"key2\": {\"key3\": \"value\"}, \"key1\": \"value\", \"key4\": [\"value\", \"value\"]}"

A JSON object representation of a dictionary. With a content-type of application/json, it should be a JSON object, otherwise, for application/x-www-form-urlencoded it should be a string encoding of a JSON object.
Multipart Text

{
    "text": "Event Name",
    "html": "Event Name",
}

Returned for fields which represent HTML, like event names and descriptions.

The html key represents the original HTML (which should be sanitized and free from injected script tags etc., but as always, be careful what you put in your DOM), while the text key is a stripped version useful for places where you can't or don't need to display the full HTML version.
Country Code

"AR"

The ISO 3166 alpha-2 code of a country.
Currency Code

"USD"

An ISO 4217 3-character code of a currency
Currency

{
    "currency": "USD",
    "value": 432,
    "major_value": "4.32",
    "display": "4.32 USD"
}

When submitting as form-encoded POST data, you can instead provide a string indicating the currency and the value separated by a comma, e.g. USD,432 - however, when you submit a JSON POST body, you must submit this as a JSON object with the currency and value fields.

Returned for monetary values, such as ticket prices, fees charged and tax amounts.

Currencies are represented as their currency code and an integer value, where the code is the currency code as defined by ISO 4217 <http://en.wikipedia.org/wiki/ISO_4217>_ and the integer value is the number of units of the minor unit of the currency (e.g. cents for US dollars).

You can get a value in the currency's major unit - for example, dollars or pound sterling - by taking the integer value provided and shifting the decimal point left by the exponent value for that currency as defined in ISO 4217 <http://en.wikipedia.org/wiki/ISO_4217>_.

For example, the exponent for USD (the US dollar) is 2, so a value of 2311 becomes $23.11. For JPY (the Japanese yen) it's 0, so a value of 2311 becomes ¥2311.

Eventbrite does not currently sell tickets in non-decimal currencies, such as the Malagasy ariary (MGA), but any value for them would also be returned in minor units (for example, ("MGA", 7) would mean 1.2 MGA, or 1 ariary and 2 francs).

The display value is provided for your convenience; its formatting may change depending on the locale you query the API with (for example, commas for decimal separators in European locales).
Address

{
    "address_1": "333 O'Farrell St",
    "address_2": "Suite 400",
    "city": "San Francisco",
    "region": "CA",
    "postal_code": "94102",
    "country": "US",
    "latitude": "37.7576792",
    "longitude": "-122.5078119",
    "localized_address_display": "333 O'Farrell St Suite 400, San Francisco, CA 94102",
    "localized_area_display": "San Francisco, CA",
    "localized_multi_line_address_display": ["333 O'Farrell St", "Suite 400", "San Francisco, CA 94102"]
}

Though address formatting varies considerably between different countries and regions, Eventbrite still has a common address return format to keep things consistent.

In general, you should treat address_1, address_2, city, and region as opaque lines of the address printed in that order. The postal_code field contains the local postal or zip code equivalent, if available, and the country field contains the ISO 3166 <http://en.wikipedia.org/wiki/ISO_3166-1>_ country code for the country (with the name of the country broken out for your convenience).

All fields apart from address_1 and country are optional.
Address Fields
Field 	Type 	Description
address_1 	string 	The street/location address (part 1)
address_2 	string 	The street/location address (part 2)
city 	string 	The city
region 	string 	The ISO 3166-2 2- or 3-character region code for the state, province, region, or district
postal_code 	string 	The postal code
country 	string 	The ISO 3166-1 2-character international code for the country
latitude 	decimal 	The latitude portion of the address coordinates
longitude 	decimal 	The longitude portion of the address coordinates
localized_address_display 	string 	The format of the address display localized to the address country
localized_area_display 	string 	The format of the address's area display localized to the address country
localized_multi_line_address_display 	list 	The multi-line format order of the address display localized to the address country, where each line is an item in the list
Object

{
    "resource_uri": "https://www.eventbriteapi.com/v3/events/3564383166/",
    "id": "3564383166",
}

The standard base representation for first-class objects in Eventbrite, such as :format:event, :format:venue and :format:order.

The resource_uri is an absolute URL to the API endpoint that will return you the canonical representation of the event, and the id is a :format:string that represents a unique identifer for the event (note that it is not necessarily numeric).

Other fields on objects are defined on their individual pages, but note that fields may not be present if their value is null; we have noted fields that may not contain a value with (optional).
Eventual Consistency

The Eventbrite Platform is large and, as such, contains a great amount of data. In order to provide the fastest experience practicable to its users, the Platform employs a model known as eventual consistency. In short, new or updated data may not be available instantly after you submit changes.
Implications of Eventual Consistency

There are many implications associated with the use of eventual consistency—some of them positive, some of them unfortunate. The key positive to eventual consistency is that it makes the Platform faster and generally provides a better, more reliable, and more available experience for users and partners alike. The notable downside is that when you or someone else creates a new event, modifies an existing event, updates the profile for a venue, or otherwise modifies data on the Platform, those changes may not be immediately visible.

When you submit a POST or DELETE request to alter data, the response you receive, if successful, will always contain the most-up-to-date data, reflecting your changes immediately. However, if you then instantly submit a GET request to obtain that same data, you may get a 404 Not Found response (if it's new data you created), or the response may contain stale data (if it's existing data you updated). The time between when you submit your changes and when those changes are visible across the Platform can vary from as little as 1 second to as much as 5 minutes, depending on the data and the current amount of traffic the Platform is handling. In almost all circumstances, that time is less than 15 seconds.
Use Waypoints for Immediate Consistency

There are times where eventual consistency makes it difficult to use the API for rapidly making changes. For example, creating an event, adding ticket classes to that event, and updating images for that event, all with a set of API calls that occur over the series of several seconds. Eventbrite Waypoints allow Platform developers to request immediate consistency during such activities.

A Waypoint is a sort of bookmark to tell the Platform when in the data timeline you expect your data to be found. When you submit a POST or DELETE request to alter data, the response you receive, if successful, will contain an HTTP header named Eventbrite-API-Waypoint-Token. The value of this header is the Waypoint for the data you just created or altered. It is encrypted, but its contents are not important. On the very next response, include a request header named Eventbrite-API-Waypoint-Token with the exact, unaltered value copied from the previous response header. You should do this even if your next request is a GET or another POST or DELETE. In this way, its use is very similar to a browser cookie.

Continue to do this for subsequent responses and requests. Each time you receive a response containing the header Eventbrite-API-Waypoint-Token, submit your next request with the header value from that most-recent response. This will avoid errors commonly associated with eventual consistency, such as 404 Not Found. There is a downside, however: submitting these tokens in your requests will slow down the requests by as much as 5 extra seconds on top of the normal request time for a given endpoint (though usually less than 1 second).

You do not have to hold on to Waypoint tokens indefinitely, and you do not even have to use Waypoint tokens. Once about 5 minutes has passed since your last request, you can discard any Waypoint token you received in that response, and submit your next request with no Waypoint token header. Also, if eventual consistency does not pose any concerns to your workflow, you can safely ignore Waypoint tokens entirely.
Reference
Attendee

Attendee Object

The Attendee object represents the details of Attendee (ticket holder to an Event). The model is one Attendee per each sold ticket.

If the Event is specified to only collect information on the Order owner (the default), all returned Attendees have the same information, apart from the barcodes and Ticket Class ID.

Attendee objects are considered private; meaning that all Attendee information is only available to the User and Order owner.
Attendee Fields
Field 	Type 	Description
created 	datetime 	Attendee creation date and time (i.e. when order was placed).
changed 	datetime 	Date and time of last change to Attendee.
ticket_class_id 	string 	Ticket Class used by Attendee when registering.
variant_id 	string 	Variant of Ticket Class used by Attendee when registering.
ticket_class_name 	string 	Name of Ticket Class used by Attendee when registering.
quantity 	integer 	Always 1.
costs 	attendee_cost 	Attendee ticket cost breakdown.
profile 	attendee-profile 	Attendee basic profile information.
addresses 	attendee-addresses 	Attendee address.
questions 	attendee-questions 	(Optional) Custom questions for the Attendee.
answers 	attendee-answers 	(Optional) Attendee's anwers to custom questions.
barcodes 	attendee-barcodes 	Attendee's entry bar code.
team 	attendee-team 	(Optional) Attendee team information.
affiliate 	attendee-affiliate 	(Optional) Attendee’s affiliate code.
checked_in 	boolean 	true = Attendee checked in.
cancelled 	boolean 	true = Attendee cancelled.
refunded 	boolean 	true = Attendee receives a refund.
status 	string 	Attendee status.
event_id 	string 	Event ID of the Attendee's Event.
order_id 	string 	Order ID under which this Attendee's ticket was purchased.
guestlist_id 	string 	Guest list ID under which the Attendee is listed. A null value means that this Attendee is not a guest.
invited_by 	string 	Attendee who invited guest. A null value means that this Attendee is not a guest.
delivery_method 	string 	Ticket delivery method used for the Attendee. Can be will_call, electronic, standard_shipping or third_party_shipping.

Attendee Cost Fields

Contains the Attendee’s cost breakdown.
Field 	Type 	Description
base_price 	currency 	Attendee's ticket price excluding fees and tax. Do not expose to Attendee as it displays an incorrect value if the Ticket Class include_fee field is used.
eventbrite_fee 	currency 	Attendee's fee. Do not expose this field to Attendee as it displays an incorrect value if the Ticket Class include_fee field is used.
tax 	currency 	Amount of tax charged for the ticket.
payment_fee 	currency 	Fee for ticket payment processing.
gross 	currency 	Attendee total cost (base_price + eventbrite_fee + payment_fee + tax).

Attendee Profile Fields

Contains Attendee personal information.
Field 	Type 	Description
name 	string 	Attendee name. To ensure forward compatibility with non-Western names, use this field instead of first_name/last_name.
email 	string 	Attendee email address.
first_name 	string 	Attendee first name. Use name field instead.
last_name 	string 	Attendee last name. Use name field instead.
prefix 	string 	(Optional) Attendee title or honorific that appears at the front of the name, such as Mr., Ms.
suffix 	string 	(Optional) Attendee suffix that appears at the end of the name (e.g. Jr., Sr.)
age 	integer 	(Optional) Attendee age.
job_title 	string 	(Optional) Attendee job title.
company 	string 	(Optional) Attendee company name.
website 	string 	(Optional) Attendee website address.
blog 	string 	(Optional) Attendee blog address.
gender 	string 	(Optional) Attendee gender, currently either “male” or “female”.
birth_date 	date 	(Optional) Attendee birth date.
cell_phone 	string 	(Optional) Attendee cell/mobile phone number.

Attendee Address Fields

Contains home, shipping, and work addresses associated with the Attendee. All fields are optional.
Field 	Type 	Description
home 	address 	Attendee home address.
ship 	address 	Attendee shipping address.
work 	address 	Attendee work address.

Attendee Questions Fields

Use to present custom questions to an Attendee.
Field 	Type 	Description
id 	string 	Custom question ID.
label 	string 	Custom question label.
type 	string 	Can be text, url, email, date, number, address, or dropdown.
required 	boolean 	true = Answer is required.

Attendee Answers Fields

Contains information on an Attendee's answers to custom questions.
Field 	Type 	Description
question_id 	string 	Custom question ID.
question 	string 	Text of the custom question.
type 	string 	Can be text, url, email, date, number, address, or dropdown.
answer 	varies 	Answer type. Generally use the string value; except when an answer of address or date is more appropriate.

Attendee Barcodes Fields

Represents the barcodes for this Attendee Order (usually one Attendee per each sold ticket).
Field 	Type 	Description
barcode 	string 	Barcode contents. This field value is null when:
- User has turned off the printable tickets option.
- Method of ticket delivery does not match Attendee.
- Attendee method of ticket delivery is not electronic.
in order to prevent exposing the barcode value to the Attendee. When viewed by the User with “event.orders:read” permission, the barcode is always shown.
status 	string 	Barcode status. Can be unused, used, or refunded.
created 	datetime 	Attendee barcode creation date and time.
changed 	datetime 	Last change date and time to Attendee barcode.
is_printed 	boolean 	true = Ticket is printed.

Attendee Team Fields

Represents Attendee team information if the Event has teams configured. An Attendee team is a group of Attendees at an Event, for example a team at a sports tournament.
Field 	Type 	Description
id 	string 	Team ID.
name 	string 	Team name.
date_joined 	datetime 	When Attendee joined the team.
event_id 	string 	Event the team is part of.
Attendee Assigned Unit Fields

Contains details of Attendee seating assignment.
Field 	Type 	Description
unit_id 	string 	Attendee seating assignment ID. This value can never be null.
description 	string 	Detailed description of seating assignment. This is concatenated from the 'labels' and 'titles' fields. This value can never be null.
location_image 	[unit-location-image] (#unit-location-image) 	Physical location of seat assignment on the seatmap. This value is null or omitted if seatmap is not published for the Event.
labels 	list 	Label of seating assignment. This value can never be null.
titles 	list 	Title of seating assignment. This value can never be null. Number of titles are always equal to or more than the number of labels. If seat location is displayed in the grid view, API client is expected to group assigned locations by title and use a separate grid for each unique title.
Attendee Note Fields

The Attendee note representes a free-form text note related to an Attendee.
Field 	Type 	Description
created 	datetime 	Note creation date and time.
text 	string 	Note content up to 2000 characters.
type 	string 	This value is always ‘attendee’.
event_id 	event 	Event associated with this Attendee note.
order_id 	order 	Order associated with this Attendee note.
attendeee_id 	attendee 	Attendee ID associated with this Attendee note.
author_name 	string 	First and last name Attendee who created the note.

Unit Location Image Fields

Seat assignment physical coordinate on the seatmap and the corresponding seatmap image URL.
Field 	Type 	Description
url 	string 	Fully qualified URL of the seatmap image. Currently all seatmap images are in 660x660 .png format. This value can never be null.
x 	float 	Seat's x-coordinate location within the seatmap, as measured by % from the left edge of seatmap. The value ranges from 0.0 to 100.0. This value can never be null.
y 	float 	Seat's y-coordinate location within the seatmap, as measured by % from the left edge of seatmap. The value ranges from 0.0 to 100.0. This value can never be null.
Expansions

Information from expansions fields are not normally returned when requesting information. To receive this information in a request, expand the request.
Expansion 	Source 	Description
event 	event_id 	Attendee's Event.
order 	order_id 	Attendee's Order.
promotional_code 	promotional_code 	Promotional Code applied to Attendee's Order.
assigned_number 	assigned_number 	Attendee bib number, if one exists for a race or endurance Event.
answers 	attendee-answers 	(Optional) Attendee answers to custom questions.
survey 	attendee-questions 	(Optional) Custom questions presented to the Attendee.
survey_responses 	attendee-survey-responses(object) 	(Optional) Attendee's responses to survey questions.
assigned_unit 	attendee-assigned-unit 	(Optional) Attendee’s seating assignment details if Event has reserved seating.
contact_list_preferences 	contact_list_preferences 	(Optional) Opt-in preferences for the email address associated with the Attendee.
Retrieve
GET
Retrieve an Attendee

Retrieve an Attendee by Attendee ID.
List
GET
List Attendees by Event

List Attendees by Event ID. Returns a paginated response.
GET
List Attendees by Organization

List Attendees of an Organization's Events by Organization ID. Returns a paginated response.
Balance
Balance

Hosts

    test: https://balance-api.jjzbds0g.ext.evbqa.com

    dev: https://balance-api.lxsadnd8.ext.evbdev.com

    preprod: https://balance-api.xypz0s6q.ext.evbstage.com

    prod: https://balance-api.fnii7z7a.ext.eventbrite.com

GET
Remaining Balance

Given an organization id and an event id returns an event-level balance specific to the time the endpoint is called
Categories

Category Object

An overarching category that an event falls into (vertical). Examples are “Music”, and “Endurance”.
Retrieve
GET
Category by ID

Gets a category by ID as category.
GET
Subcategory by ID

Retrieve a Subcategory by Subcategory ID.
List
GET
List of Categories

Returns a list of Category as categories, including subcategories nested. Returns a paginated response.
GET
List of Subcategories

List all available Subcategories. Returns a paginated response.
Discount

Discount Object

The Discount object represents a discount that an Order owner can use when purchasing tickets to an Event.

A Discount can be used to a single Ticket Class or across multiple Ticket Classes for multiple Events simultaneously (known as a cross event Discount).

There are four types of Discounts:

    Public Discount. Publically displays Discount to Order owner on the Event Listing and Checkout pages. Only used with a single Event.

    Coded Discount. Requires Order owner to use a secret code to access the Discount.

    Access Code. Requires Order owner to use a secret code to access hidden tickets. Access codes can also optionally contain a discount amount.

    Hold Discount. Allows Order owner to apply or unlock Discount for seats on hold.

The display price of a ticket is calculated as:
price_before_discount - discount_amount = display_price

Notes:

    Public and Coded Discounts can specify either an amount off or a percentage off, but not both types discounts.

    Public Discounts should not contain apostrophes or non-alphanumeric characters (except “-”, “_”, ” ”, “(”, ”)”, “/”, and “”).

    Coded Discounts and Access Codes should not contain spaces, apostrophes or non-alphanumeric characters (except “-”, “_”, “(”, ”)”, “/”, and “”).

Fields

Use these fields to specify information about a Discount.
Field 	Type 	Description
code 	string 	Discount name for a Public Discount, or the code for a Coded Discount and Access Code.
type 	string 	Discount type. Can be access, coded, public or hold.
end_date 	datetime 	Date until which the Discount code is usable. Date is naive and assumed relative to the timezone of an Event. If null or empty, the discount is usable until the Event end_date. ISO 8601 notation: YYYY-MM-DDThh:mm:ss.
end_date_relative 	integer 	End time in seconds before the start of the Event until which the Discount code is usable. If null or empty, the discount is usable until the Event end_date.
amount_off 	decimal 	Fixed amount applied as a Discount. This amount is not expressed with a currency; instead uses the Event currency from 0.01 to 99999.99. Only two decimals are allowed. The default is null for an Access Code.
percent_off 	decimal 	Percentage amount applied as a Discount. Displayed in the ticket price during checkout, from 1.00 to 100.00. Only two decimals are allowed. The default is null for an Access Code.
quantity_available 	integer 	Number of times this Discount can be used; 0 indicates unlimited use.
quantity_sold 	integer 	Number of times this Discount has been used. This is a read only field.
start_date 	local datetime 	Date from which the Discount code is usable. If null or empty, the Discount is usable effective immediately.
start_date_relative 	integer 	Start time in seconds before the start of the Event from which the Discount code is usable. If null or empty, the Discount is usable effective immediately.
ticket_class_ids 	list 	List of discounted Ticket Class IDs for a single Event. Leave empty if you want to see all the tickets for the Event.
event_id 	string 	Single Event ID to which the Discount can be used. Leave empty for Discounts.
ticket_group_id 	string 	Ticket Group ID to which the Discount can be used.
hold_ids 	list 	List of hold IDs this discount can unlock. Null if this discount does not unlock a hold.

The following conditions define the extend of the Discount:

    If event_id is provided and ticket_class_ids are not provided, a single Event Discount is created for all Event tickets.

    If both event_id and ticket_class_ids are provided, a single Event Discount is created for the specific Event tickets.

    If ticket_group_id is provided, a Discount is created for the Ticket Group.

    If neither event_id nor ticket_group_id are provided, a Discount is created that applies to all tickets for an Organization's Events, including future Events.

Expansions

Information from expansions fields are not normally returned when requesting information. To receive this information in a request, expand the request.
Expansion 	Source 	Description
event 	event_id 	Single Event to which the Discount can be used.
ticket_group 	ticket_group_id 	Ticket Group to which the Discount can be used.
reserved_seating 	ticket-reserved-seating-settings 	Reserved seating settings for the Ticket Class. This expansion is not returned for Ticket Classes that do not support reserved seasting.
Retrieve
GET
Retrieve a Discount

Retrieve a Discount by Discount ID.
Create
POST
Create a Discount

Create a new Discount.
Update
POST
Update a Discount

Update a Discount by Discount ID.
List
GET
Search Discounts by Organization

List Discounts by Organization ID. Returns a paginated response.
Delete
DELETE
Delete a Discount

Delete a Discount. Only unused Discounts can be deleted.

Warning: A Discount cannot be restored after being deleted.
Display Settings

Display Settings Object

The Display Settings object represents the settings that create the Event display as shown on the Event Listing page.
Retrieve
GET
Retrieve Display Settings

Retrieve the Display Settings for an Event by Event ID.
Update
POST
Update Display Settings

Update Display Settings for an Event by Event ID.
Event Capacity
Retrieve
GET
Retrieve a Capacity Tier

Retrieve the capacity tier for an event.
Update
POST
Update a Capacity Tier

Update the capacity tier for an event. Partial updates are supported. Submit only attributes that are changed.

These rules must apply when updating capacity tier:

    Sum of quantity_total from capacity holds cannot exceed remaining capacity quantity

    If the event is already oversold, new remaining capacity quantity cannot become further negative (oversold)

To create GA capacity hold inventory tiers for an event, include payload with holds. capacity_total must be supplied if event does not have a capacity set.

For example:

{
    "capacity_total": 100,
    "holds": [
        {
            "name": "Marketing",
            "quantity_total": 10,
            "sort_order": 1,
        },
    ]
}

To update/delete GA capacity hold inventory tiers for an event, include payload with holds that contain id and fields of the hold tier to be updated. Deleting is the same as updating with is_deleted set to true.

Deleting a hold tier that has tickets sold or associated with attendees will be denied. quantity_total for a hold tier cannot be reduced below the quantity used (quantity_sold + quantity_pending). Payload can contain partial data/partial hold inventory tiers to be updated/deleted.

For example:

{
    "holds": [
        {"id": "I987", "name": "Marketing"},  # update existing tier
        {"id": "I988", "is_deleted": true},  # delete existing tier
        {"name": "Accounting", "quantity_total": 10},  # create new tier
    ]
}

Event Description

Event Description

Event Descriptions have two representations:

    A fully-rendered HTML version of the event summary AND event description, and

    A "raw" version of the description that is broken up into its distinct modules. To set and retrieve modules, please see the Structured Content documentation.

For more in depth description for how to set the event description, please see the event description tutorial.

|
Retrieve
GET
Retrieve Full HTML Description

Returns the fully rendered description for an Event as a string of HTML. This endpoint will work with events created using New or Classic Create.

{
 "description: <div>Example summary!<\/div>\n<div><P>My <EM>event's<\/EM> description would go <STRONG>here<\/STRONG>.<\/P><\/div>"
}

Permissions

event.details:read
Event Schedule

Event Schedule Object

The Event Schedule object is a set of rules that is used to add occurrences to a series parent event. A series parent event may have multiple schedules associated with it. Each schedule may only be associated with one series parent event.

Create
POST
Create an event schedule

Creating an event schedule requires that a series parent event has already been created. For instructions on how to create a series parent event, please refer to the Create Event API.

Creating an event schedule will add occurrences to a series parent event, according to the pattern specified in the schedule. Each occurrence is backed by an Event, and will be associated with the series parent event specified in the request. If an occurrence specified by the schedule has the same date and time as an existing occurrence, the new occurrence is ignored and not created (the rest of the occurrences specified by the schedule are still created).
Event Search

Lists public Events from Eventbrite.
List - deprecated
GET
Search Events - deprecated

List public Events from Eventbrite. Returns a paginated response.

    Notice: Access to this API was shut down at 11:59 pm PT on Thursday, December 12, 2019.

For more information regarding the shut down, refer to our changelog.
Event Series

Event Series Object

An Event Series is a repeating Event with a sequence of multiple and various dates. These dates may or may not be in a predictable order.

An Event Series is made up of the parent Event, and child Events that represent each different date of the parent Event. Each child Event is created with the details of the parent Event.

For instructions on how to create an Event Series, please refer to the Create Event API.
Retrieve
GET
Retrieve an Event Series

Retrieve the parent Event Series by Event Series ID.
Event Teams

Work with the team information of an event
List
GET
List by Event

Returns a list of teams for the event. Returns a paginated response.
Retrieve
GET
Retrieve Team

Returns information for a single team.
Attendees by Team
GET
List Attendees by Team

Returns attendee for a single team. Returns a paginated response.
Create
POST
Create a Team

Create and returns a team.
Check password
POST
Verify password for a team

Verify that the password of a team is correct, and if so, and returns the token of the team
Search
GET
Search teams by name Team

Returns the teams of an event searched by name. Returns a paginated response.
Event

Event Object

The Event object represents an Eventbrite Event. An Event is owned by one Organization.
Public Fields

Use these fields to specify information about an Event. For publicly listed Events, this information can be retrieved by all Eventbrite Users and Eventbrite applications.
Field 	Type 	Description
name 	multipart-text 	Event name.
summary 	string 	(Optional) Event summary. Short summary describing the event and its purpose.
description 	multipart-text 	(DEPRECATED) (Optional) Event description. Description can be lengthy and have significant formatting.
url 	string 	URL of the Event's Listing page on eventbrite.com.
start 	datetime-tz 	Event start date and time.
end 	datetime-tz 	Event end date and time.
created 	datetime 	Event creation date and time.
changed 	datetime 	Date and time of most recent changes to the Event.
published 	datetime 	Event publication date and time.
status 	string 	Event status. Can be draft, live, started, ended, completed and canceled.
currency 	string 	Event ISO 4217 currency code.
online_event 	boolean 	true = Specifies that the Event is online only (i.e. the Event does not have a Venue).
hide_start_date 	boolean 	If true, the event's start date should never be displayed to attendees.
hide_end_date 	boolean 	If true, the event's end date should never be displayed to attendees.
Private Fields

Use these fields to specify properties of an Event that are only available to the User.
Field 	Type 	Description
listed 	boolean 	true = Allows the Event to be publicly searchable on the Eventbrite website.
shareable 	boolean 	true = Event is shareable, by including social sharing buttons for the Event to Eventbrite applications.
invite_only 	boolean 	true = Only invitees who have received an email inviting them to the Event are able to see Eventbrite applications.
show_remaining 	boolean 	true = Provides, to Eventbrite applications, the total number of remaining tickets for the Event.
password 	string 	Event password used by visitors to access the details of the Event.
capacity 	integer 	Maximum number of tickets for the Event that can be sold to Attendees. The total capacity is calculated by the sum of the quantity_total of the Ticket Class.
capacity_is_custom 	boolean 	true = Use custom capacity value to specify the maximum number of Attendees for the Event. False = Calculate the maximum number of Attendees for the Event from the total of all Ticket Class capacities.

Music Properties

The Music Properties object includes a few attributes of an event for Music clients. To retrieve Music Properties by Event ID, use the music_properties expansion.
Field 	Type 	Description
age_restriction 	enum 	Minimum age requirement of event attendees.
presented_by 	string 	Main music event sponsor.
door_time 	string 	Time relative to UTC that the doors are opened to allow people in the the day of the event. When not set, the event will not have any door time set. 2019-05-12T-19:00:00Z
Expansions

Information from expansions fields are not normally returned when requesting information. To receive this information in a request, expand the request.
Expansion 	Source 	Description
logo 	logo_id 	Event image logo.
venue 	venue_id 	Event Venue.
organizer 	organizer_id 	Event Organizer.
format 	format_id 	Event Format.
category 	category_id 	Event Category.
subcategory 	subcategory_id 	Event Subcategory.
bookmark_info 	bookmark_info 	Indicates whether a user has saved the Event as a bookmark. Returns false if there are no bookmarks. If there are bookmarks, returns a a dictionary specifying the number of end-users who have bookmarked the Event as a count object like {count:3}.
refund_policy 	refund_policy 	Event Refund Policy.
ticket_availability 	ticket_availability 	Overview of availability of all Ticket Classes
external_ticketing 	external_ticketing 	External ticketing data for the Event.
music_properties 	music_properties 	Event Music Properties
publish_settings 	publish_settings 	Event publish settings.
basic_inventory_info 	basic_inventory_info 	Indicates whether the event has Ticket Classes, Inventory Tiers, Donation Ticket Classes, Ticket Rules, Inventory Add-Ons, and/or Admission Inventory Tiers.
event_sales_status 	event_sales_status 	Event’s sales status details
checkout_settings 	checkout_settings 	Event checkout and payment settings.
listing_properties 	listing_properties 	Display/listing details about the event
has_digital_content 	has_digital_content 	Whether or not an event Has Digital Content
Retrieve
GET
Retrieve an Event

Retrieve an Event by Event ID.

    Note: If the Event being retrieved was created using the new version of Create, then you may notice that the Event’s description field is now being used to hold the event summary. To retrieve your event’s fully-rendered HTML description, you will need to make an additional API call to retrieve the Event's full HTML description.

Create

POST
Create an Event

Create a new Event.

By default, this API creates an event that occurs once. In order to create a series of events with multiple occurrences (also known as a "repeating event" or "recurring event"), you must first create one event to serve as the "series parent", then add occurrences to the series parent. Creating the series parent is done by calling the Create Event API with the is_series attribute set to True. Occurrences can then be added to the newly created series parent, using the Event Schedule API.
Update
POST
Update an Event

Update Event by Event ID.

Note that if the event is a series parent, updating name, description, hide_start_date, hide_end_date, currency, show_remaining, password, capacity, or source on the series parent will update these fields on all occurrences in the series.
List
GET
List Events by Venue

List Events by Venue ID. Returns a paginated response.
GET
List Events by Organization

List Events by Organization ID. Returns a paginated response.
GET
List Events by Series

List Events by Event Series ID. Returns a paginated response.
Publish
POST
Publish an Event

Publish an Event.

In order for publish to be permitted, the event must have all necessary information, including a name and description, an organizer, at least one ticket, and valid payment options. This API endpoint will return argument errors for event fields that fail to validate the publish requirements. Returns a boolean indicating success or failure of the publish.

If the event is a series parent, all occurrences in the series must be in a valid state to be published. Publishing the series parent will publish all series occurrences.

Deleted Events can not be published.
Unpublish
POST
Unpublish an Event

Unpublish an Event. Returns a boolean indicating the success or failure of the unpublish action. To unpublish a free Event, including a past free Event, the Event must not have any pending or completed orders. A completed and paid out paid Event can be unpublished. A paid Event that is not completed and paid out can only be unpublished if the Event does not have any pending or completed orders.

If the event is a series parent, all occurrences in the series must be in a valid state to be unpublished. Unpublishing a series parent will unpublish all series occurrences. A series occurrence cannot be unpublished individually.
Copy
POST
Copy an Event

Copy the Event, creating a duplicate version of the Event with a new Event ID. Use to create a new Event based on an existing Event. Returns the Event object for the newly created Event.

The Event payment options, payout method, refund policy, and tax settings will copy to the new Event.
Cancel
POST
Cancel an Event

Cancel an Event. Returns a boolean indicating the success or failure of the cancel action. To cancel an Event, the Event must not have any pending or completed orders.

If the event is a series parent, all series occurrences must be in a valid state to be canceled. Canceling the series parent will cancel all series occurrences.
Delete
DELETE
Delete an Event

Delete an Event if the delete is permitted. Returns a boolean indicating the success or failure of the delete action. To delete an Event, the Event must not have any pending or completed orders.

If the event is a series parent, all series occurrences must be in a valid state to be deleted. Deleting the series parent will delete all series occurrences.
Formats

Format Object

The Format object represents an Event type, for example seminar, workshop or concert. Specifying a Format helps website visitors discover a certain type of Event.
Retrieve
GET
Retrieve a Format

Retrieve a Format by Format ID.
List
GET
List Formats

List all available Formats. Returns a paginated response.
Inventory Tiers

"Tiered Inventory" allows organizer to define inventory (usually total quantity) to be shared by multiple ticket classes.

For example, "Admission" inventory tier has total quantity of 100, which can be sold as Adult ticket, Child ticket, or Senior ticket.

For the same event, another tier, "Parking", may have total quantity of 200 with VIP Parking ticket and Regular parking ticket.

Inventory Tier Object

The Inventory Tier object represents an entity that controls capacity (an allocation of total quantity) across multiple tickets to be sold.
GA Holds

Holds are tickets or capacity held back from the main sale inventory for other needs, such as for press, guests of the artist or the artist's label, etc.

A hold tier could be created under a parent tier, and the quantity in the hold tier would be deducted from the parent tier.

For example, "Lawn" inventory tier has a capacity total of 1000 and total quantity of 900 which can be sold as VIP, Adult, or Child ticket.

100 of the 1000 is held under "Marketing" hold inventory tier, which can be sold as Marketing VIP, Marketing Adult, or Marketing Child ticket.
Expansions

Information from expansions fields are not normally returned when requesting information. To receive this information in a request, expand the request.
Expansion 	Source 	Description
image 	image_id 	Image for the Inventory Tier.
Retrieve
GET
Retrieve an Inventory Tier

Retrieve an Inventory Tier by ID for an Event.
Create
POST
Create an Inventory Tier

Create a new Inventory Tier for an Event.
POST
Create Multiple Inventory Tiers

Create multiple Inventory Tiers for an event.
Update

POST
Update an Inventory Tier

Update an existing Inventory Iier by ID for an Event. Partial updates are supported. Submit only attributes that are changed.
POST
Update Multiple Inventory Tiers

Update multiple existing Inventory Tiers for an Event. Partial updates are supported. Submit only attributes that are changed.
List
GET
List Inventory Tiers by Event

Retrieves inventory tiers for an event.
Delete
DELETE
Delete an Inventory Tier

Mark an existing Inventory Tier as deleted.
Media

Media Object

The Media object represents an image that can be included with an Event listing, for example to provide branding or further information on the Event.
Retrieve
GET
Retrieve Media

Retrieve Media by Media ID.
Upload
POST
Upload a Media File

Upload a Media image file.
Retrieve Upload
GET
Retrieve a Media Upload

Retrieve information on a Media image upload.
Online Event Page

Online Event Page

The Online Event Page (formerly known as the Digital Links Page, or Digital Content) is a feature that allows online event organizers to create a separate landing page for attendees of that event - and can include information pertinent to that event, such as webinar links, documents, etc.

To understand better how to create the Online Event Page, please see the Online Event Page Tutorial

For the api that powers Online Event Page, please see the Structured Content documentation.

Has Digital Content Object

This is the object that is returned from the Event Expansions
Field 	Type 	Description
has_digital_content 	boolean 	whether or not an event has digital content
digital_content_url 	string 	The url to the Online Event Page for an event, only accessible if the attendee has purchased a ticket.
Order

Order object

The Order object represents an order made against Eventbrite for one or more Ticket Classes. In other words, a single Order can be made up of multiple tickets. The object contains an Order's financial and transactional information; use the Attendee object to return information on Attendees.

Order objects are considered private; meaning that all Order information is only available to the Eventbrite User and Order owner.
Order Fields
Field 	Type 	Description
created 	datetime 	Date and time the Order was placed and the Attendee created.
changed 	datetime 	Date and time of the last change to Attendee.
name 	string 	Order owner name. To ensure forward compatibility with non-Western names, use this field instead of first_name/last_name.
first_name 	string 	Order owner first name. Use name field instead.
last_name 	string 	Order owner last name. Use name field instead.
email 	string 	Order owner email address.
costs 	order-costs 	Cost breakdown of the Order.
event_id 	string 	Order's Event ID.
time_remaining 	number 	Time remaining to complete Order (in seconds).
questions 	order-questions 	(Optional) Custom questions shown to Order's owner.
answers 	order-answers 	(Optional) Answers to custom questions shown to Order's owner.
promo_code 	string 	(Optional) Discount code applied to Order.
status 	string 	Order status.

Order Costs Fields

Contains a breakdown of Order costs.
Field 	Type 	Description
base_price 	currency 	Order amount without fees and tax. Use instead the display_price field if the Ticket Class include_fee field is used; otherwise an incorrect value is shown to the Order owner.
display_price 	currency 	Order amount without fees and tax. This field shows the correct value to the Order owner when the Ticket Class include_fee field is used.
display_fee 	currency 	Order amount with fees and tax included (absorbed) in the price as displayed.
gross 	currency 	Total amount of Order.
eventbrite_fee 	currency 	Eventbrite fee as portion of Order gross amount. Do not expose this field to Order owner.
payment_fee 	currency 	Payment processor fee as portion of Order gross amount.
tax 	currency 	Tax as portion of Order gross amount passed to Event Organization.
display_tax 	order-display-tax 	Order tax. Same value as tax field, but also includes the tax name.
price_before_discount 	currency 	Order price before a Discount code is applied. If no discount code is applied, value should be equal to display_price.
discount_amount 	currency 	Order total Discount. If no discount code is applied, discount_amount will not be returned.
discount_type 	string 	Type of Discount applied to Order. Can be null or coded, access, public or hold. If no discount code is applied, discount_type will not be returned.
fee_components 	Cost Component (list) 	List of price costs components that belong to the fee display group.
tax_components 	Cost Component (list) 	List of price costs components that belong to the tax display group.
shipping_components 	Cost Component (list) 	List of price costs components that belong to the shippig display group.
has_gts_tax 	boolean 	Indicates if any of the tax_components is a gts tax.
tax_name 	string 	The name of the tax that applies, if any.

Display Tax Fields
Field 	Type 	Description
name 	string 	Tax name.
tax 	currency 	Tax amount.
Refund Request Fields

The Order includes a refund request.
Field 	Type 	Description
from_email 	string 	Email used to create the refund request.
from_name 	string 	Refund request name.
status 	string 	Refund request status.
message 	string 	Message associated with the refund request.
reason 	string 	Refund request reason code.
last_message 	string 	Last message associated with the last status of the refund request.
last_reason 	string 	Last reason code of the refund request.
items 	list of refund_item 	Requested refunded items of the refund request.

Refund Item Fields

A Refund Request contains a refund item.
Field 	Type 	Description
event_id 	string 	Refund item Event.
order_id 	string 	Refund item Order. Field can be null.
processed_date 	datetime 	(Optional) The date and time this refund item was processed, if it has been processed.
item_type 	string 	Refund item Order type. Use order for full refund, attendee for partial refund for the Attendee, or merchandise for partial refund as merchandise.
amount_processed 	currency 	(Optional) The amount of money refunded. This will be absent if the refund has not been processed.
amount_requested 	currency 	(Optional) The amount of money requested for refund. Only appears for attendee-initiated refunds.
quantity_processed 	number 	(Optional) Quantity refunded. If the item_type field value is order, quantity_processed is always 1. If the item_type field value is attendee or merchandise, then the quantity_processed value displays the number of items processed. This will be absent if the refund has not been processed.
quantity_requested 	number 	(Optional) Quantity requested to be refunded. If the item_type is order, quantity_requested is always 1. If the item_type is attendee or merchandise, then the quantity_requested value displays the number of items requested for a refund. Only appears for attendee-initiated refund items.
refund_reason_code 	string 	A descriptive code for the refund reason
status 	string 	Refund item status, one of pending, processed, or error

Order Questions Fields

Use to present Custom Questions to an Attendee.
Field 	Type 	Description
id 	string 	Custom Question ID.
label 	string 	Custom Question Label.
type 	string 	Can be text, url, email, date, number, address, or dropdown
required 	boolean 	true = Answer to custom question is required.

Order Answers Fields

Contains information on an Attendee's answers to custom questions.
Field 	Type 	Description
question_id 	string 	Custom Question ID.
attendee_id 	string 	Attendee ID.
question 	string 	Custom Question text.
type 	string 	Can be text, url, email, date, number, address, or dropdown.
answer 	varies 	Answer type. Generally use the string value; except when an answer of address or date is more appropriate.
Order Notes Fields

Order Notes is free-form text related to an Order.
Field 	Type 	Description
created 	datetime 	Order note creation date and time.
text 	string 	Order note content up to 2000 characters.
type 	string 	Type of Order associated with order note, always and only order.
event_id 	event 	ID of Event associated with Order.
order_id 	order 	ID of Order associated with order note.
author_name 	string 	First and last name Order owner associated with order note.
Expansions

Information from expansions fields are not normally returned when requesting information. To receive this information in a request, expand the request.
Expansion 	Source 	Description
event 	event_id 	Order's associated Event.
attendees 	attendee(list) 	Order's Attendees.
merchandise 	merchandise(list) 	Merchandise included in this Order.
concierge 	concierge 	Order's concierge.
refund_requests 	refund_request 	Order's refund request.
survey 	order-questions 	(Optional) Order's custom questions.
survey_responses 	order-survey-responses(object) 	(Optional) Order's responses to survey questions.
answers 	order-answers 	(Optional) Order's answers to custom questions.
ticket_buyer_settings 	ticket_buyer_settings 	(Optional) Include information relevant to the purchaser, including confirmation messages.
contact_list_preferences 	contact_list_preferences 	(Optional) Opt-in preferences for the email address associated with the Order.
Retrieve
GET
Retrieve Order by ID

Retrieve an Order by Order ID.
List
GET
List Orders by Organization ID

Returns a paginated response of orders, under the key orders, of orders placed against any of the events the organization owns (events that would be returned from /organizations/:id/events/)
GET
List Orders by Event ID

List Orders by Event ID. Returns a paginated response.
GET
List Orders by User ID

List Orders by User ID. Returns a paginated response.
Organizations Members

Organization Member Object

This object represents a Member of an Organization with a Role.
List
GET
List Members of an Organization

List an Organization's Members by Organization ID. Returns a paginated response.
Organization Roles

Organization Role Object

Organization Role is an object representing a set of permissions owned by an Organization.

Roles are grouped together by the Organization object, and a Role can only belong to one Organization. If an Organization is deleted, all Roles belonging to that Organization are also deleted.
List
GET
List Roles by Organization

List an Organization's Roles by Organization ID. Returns a paginated response.
Organization

Organization Object

An object representing a business structure (like a Marketing department) in which Events are created and managed. Organizations are owned by one User and can have multiple Members.

The Organization object is used to group Members, Roles, Venues and Assortments.
Public Fields

Use these fields to specify information about an Organization.
Field 	Type 	Description
id 	string 	Organization ID. Must be obtained via an API request, such as a List your Organizations request. The organization_id is NOT equal to an organizer_id (the string in an Organizer Profile URL).
name 	string 	Organization Name.
image_id 	string 	(Optional) ID of the image for an Organization.
vertical 	string 	Type of business vertical within which this Organization operates. Currently, the only values are default and music. If not specified, the value is default.
List your Organizations
GET
List your Organizations

List the Organizations to which you are a Member. Returns a paginated response.
List Organizations by User
GET
List Organizations by User

List Organizations by User ID. Returns a paginated response.
Pricing

Pricing Object

The Pricing object represents all the available fee rates for different currencies, countries, Assortments and sales channels.
Items
POST
Calculate Items

Calculates the Fees that Eventbrite would charge for a given price as it’s shown on the ticket authoring flow. This price would be hypothetical, as the pricing calculation would be based on the passed parameters instead of facts as it happens when an order is created.

This price is a simplified view. The price reported can’t be used to calculate the price of an order. Its used to get fees, taxes and total price depending from scope parameter. The scope can be as one of the members: organization, event, ticket_class or assortment_plan.

Depending on the scope type, the scope identifier has different meanings: For scope.type organization scope.identifier represents an organization id. For scope.type event scope.identifier represents an event id. For scope.type ticket_class scope.identifier represents a ticket class id. For scope.type assortment_plan scope.identifier can take a value of either 'package1' or 'package2'

Returns a item_pricing according to the provided base price and scope.
List
GET
List Pricing

List all available Pricing rates. Returns a paginated response.
Questions

Questions Object

The Questions object represents questions that are presented to an Order Owner as part of the registration process. There are two types of Questions:

    Default Questions. For example first name, last name and email address.

    Custom Questions. Questions and answers unique to the account and/or Event and created by the User. For example, to require the acknowledgement of terms and conditions as part of the ticket purchase process.

List Default Questions
GET
List Default Questions by Event

List default Questions by Event ID. Returns a paginated response.
Get Default Question by Id
GET
Get Default Question by Id

Retrieve a Canned Question by Event and Question ID.
Create Default Question
POST
Create a Default Question for an Event

Create a default Question for an Event. Returns the result as a question array.
Update Default Question by Id
POST
Update Default Question by Id

Modify details of the canned question of the event
Delete Default Question by Id
DELETE
Delete Default Question by Id

Deactivate a canned question for the event
List Custom Questions
GET
List Custom Questions by Event

List custom Questions by Event ID. Returns a paginated response, with a question array.
Create Custom Question
POST
Create a Custom question for an Event

Create a custom Question for an Event. Returns the result as a question array.
Get Custom Question by Id
GET
Get Custom Question by Id

Retrieve a Custom Question by Event and Question ID.
Delete Custom Question
DELETE
Delete a Custom Question for an Event

Delete a custom Question by Event and Question ID.
Reports

Report Object

The Report object represents the Reports that you can retrieve using the API. This includes Reports on:

    Sales activity

    Attendees for an Event.

Retrieve a Sales Report
GET
Retrieve a Sales Report

Retrieve a sales Report by Event ID or Event status.
Retrieve a Attendee Report
GET
Retrieve a Attendee Report

Retrieve an Attendee Report by Event ID or Event status.
Seat Map

Seat Map Object

The Seat Map object represents the info of reserved seating Seat Map.
Expansions

Information from expansions fields are not normally returned when requesting information. To receive this information in a request, expand the request.
Expansion 	Source 	Description
event 	event_id 	Event that this seat map belongs to.
venue 	venue_id 	Venue that this seat map belongs to.
basic_inventory_info 	basic_inventory_info 	Indicates whether the event has Ticket Classes, Inventory Tiers, Donation Ticket Classes, Ticket Rules, Inventory Add-Ons, and/or Admission Inventory Tiers.

List Seat Maps by Organization
GET
List Seat Maps by Organization

List Seat Maps of an Organization.

    Warning: Response is not paginated yet, but will be paginated soon.

Create Seat Map For Event
POST
Create Seat Map For Event

Create a Seat Map for a new reserved seating event by copying an existing seat map. Event must be a new reserved seating. Once a seat map is already created for the event, this endpoint will return error. List Seat Maps by Organization can be used to find source seat maps and their IDs.
Structured Content

Endpoints for getting and setting structured content. Structured content is mainly used to create a rich event description. Structured content works off of the concept of pages and modules - each event has a structured content page that can contain multiple modules of different types content.

Structured content works as an insert only system, so any time you want to update module(s), you will need to resubmit all of the content you had previously submitted plus any changes. Structured content also works as a versioned system, so you will need to increment with a new version every time.

For more in depth description for how to get and set the full event description with regards to structured content, please see the event description tutorial.

Structured content also powers the Online Event Page. For more information about the feature and how to use the structured content api in the context of Online Event Page, please visit the Online Event Page Tutorial.
Field 	Type 	Description
page_version_number 	string 	The number representing the current version of the description
modules 	array[Structured Content Module] 	The list of Modules
widgets 	array[Structured Content Widget] 	The list of Widgets
Structured Content Modules

Event descriptions are comprised of one or more modules, and there are three currently-supported module types: text, image, video. Each module type will contain type-specific data.
Field 	Type 	Description
type 	string 	Module type. We currently support text, image, and video types, but this list will change as more module types are added. Clients should be prepared to handle modules types they don't know how to render. In this case, clients may refuse to render the edit interface for these modules, but they should at a minimum store the data associated with these types and send it back to the server when sending edits of known types.
data 	object 	The module data specific for this module type.
Structured Content Widgets

Special structured data that could be added once to a page. Currently supported widgets: Agenda, FAQs.
Field 	Type 	Description
type 	string 	Widget type. We currently support agenda and faqs.
data 	object 	The widget data specific for this widget type.

For examples of module data formats for POST and GET, please refer to the event description tutorial.
Retrieve
GET
Retrieve Latest Published Version of Structured Content by Event Id

Retrieve a paginated response of structured content for the given event id. This will retrieve the latest published version of the structured content. Therefore you must publish a version of the content before using this endpoint - aka send in publish=true with current set of modules to Set Structured Content endpoint. It will default to getting the structured content of the event listing page if no purpose is provided.
GET
Retrieve Latest Working Version of Structured Content by Event Id

Retrieve a paginated response of structured content for the given event id. This will retrieve the latest working version of the structured content - this means latest version that is either published or unpublished. It will default to getting the structured content of the event listing page if no purpose is provided.
Create/Update
POST
Set Structured Content by Event Id and Version

Add new structured content to the event id for a specific version of structured content. This endpoint encapsulates both create and update for structured content. It will default to creating/updating the structured content for the listing page if no purpose is provided.

Make sure to send in publish=true with current* set of modules. If you do not publish your structured content, then your most updated structured content will not be visible to public users looking at your event listing page - it will only be visible to you. From a technical perspective, Get Latest Working Version of Structured Content by Event Id will return your most recent modules (published or unpublished), but Get Latest Published Version of Structured Content by Event Id will return only the latest structured content that has been published.

* If you ONLY send in publish=true without the current set of modules, it will not work - modules will return as empty. Make sure to send in your most current modules AND publish=true.
Texts Overrides

Text Overrides Object

The Text Overrides objects allow you to customize certain strings shown during ticket sales on a per event basis.
Retrieve Text Overrides
GET
Retrieve Text Overrides

Retrieve the Text Overrides for the selected locale for an organization, with options to filter by Venue or Event
Create Text Overrides
POST
Create Text Overrides

Create the Text Overrides for an organization, Venue, or Event. Messages will be internationalized using the locale parameter if it's specified. In case we don't send the locale we have 2 scenarios:

    If event_id is provided the event's locale will be used

    For other cases default locale will be used.

Ticket Buyer Settings

Ticket Buyer Settings Object

Use this object to specify the following settings for an Event's ticket buyers:

    Receive confirmation message.

    Display instructions on ticket.

    ID of ticket Event.

    Ticket is refundable.

    Receive URL, in place of confirmation message, for post-purchase information.

    Message to display after ticket sales end.

    Whether attendees are allowed to update information after registration.

    Name/Title of the registration survey page.

    Information about the registration survey.

    Survey registration time limit (in minutes).

    Which respondent type the information must be collected for (ticket_buyer or attendee).

    Which ticket classes the information must be collected for.

Retrieve
GET
Retrieve Ticket Buyer Settings by Event

Retrieve Ticket Buyer Settings by Event ID.

Example:

{
    "confirmation_message": {
        "text": "<H1>Confirmation Message</H1>",
        "html": "Confirmation Message"
    },
    "instructions": {
        "text": "<H1>Instructions</H1>",
        "html": "Instructions"
    },
    "sales_ended_message": {
        "text": "<H1>Sales Ended Message</H1>",
        "html": "Sales Ended Message"
    },
     "survey_info": {
        "text": "<b>Filling in this survey is required to attend the event</b>",
        "html": "Filling in this survey is required to attend the event"
    },
    "event_id": "43253626762",
    "survey_name": "Registration Page Title",
    "refund_request_enabled": true,
    "allow_attendee_update": true,
    "survey_time_limit": 15,
    "redirect_url": null,
    "survey_respondent": "attendee",
    "survey_ticket_classes": ["125", "374"]
}

Update
POST
Update Ticket Buyer Settings for an Event

Update Ticket Buyer Settings by Event ID.

Example:

{
    "ticket_buyer_settings": {
        "confirmation_message": {
            "text": "<H1>Confirmation Message</H1>",
            "html": "Confirmation Message"
        },
        "instructions": {
            "text": "<H1>Instructions</H1>",
            "html": "Instructions"
        },
        "sales_ended_message": {
            "text": "<H1>Sales Ended Message</H1>",
            "html": "Sales Ended Message"
        },
        "survey_info": {
            "text": "<b>Filling in this survey is required to attend the event</b>",
            "html": "Filling in this survey is required to attend the event"
        },
        "event_id": "43253626762",
        "survey_name": "Registration Page Title",
        "refund_request_enabled": true,
        "allow_attendee_update": true,
        "survey_time_limit": 15,
        "redirect_url": null,
        "survey_respondent": "attendee",
        "survey_ticket_classes": ["125", "374"]
    }
}

Ticket Class

Ticket Class Object

The Ticket Class object represents a possible ticket class (i.e. ticket type) for an Event.

Typically, multiple different types of tickets for an Event can be purchased in one transaction. These ticket types do not necessarily map directly to the one Attendee per one ticket model (instead for example, an Attendee might buy multiple tickets for different days of an Event Series).

Ticket Classes can be one of the following types:

    Free. Ticket Classes that have no cost or currency. An Event with only free Ticket Classes is a free Event and doesn't require payout information.

    Paid. Ticket Classes with an associated cost in the Event's currency. Currency is specified in the Event object and is duplicated in the Ticket Class object as the return value of a currency type.

    Donation. Order owner is prompted to enter at their own discretion an amount to donate during checkout. There is no fixed cost of donation.

Ticket Class price can be communicated in a way that either includes Eventbrite fees in the total displayed price or shows fees split out as a separate cost from the total ticket price. The User determines how costs are communicated.

Ticket Class responses for Events not owned by the Organization only shows cost and fees, as displayed on the Ticket Listing page. Results from Events the Organization owns also includes information on the actual_cost and actual_fee, which identify the amount of the ticket that the Organization is paid (actual_cost) and the Eventbrite fee deducted from the total charged amount (actual_fee).

Ticket Classes can be grouped using the Ticket Group object, most commonly to apply a Cross-Event Discount to multiple Ticket Classes.
Public Fields

Use these fields to specify information about a Ticket Class. For publically listed Events, this Ticket Class information can be viewed by all Users and Eventbrite applications.
Field 	Type 	Description
name 	string 	Ticket Class name.
description 	string 	(Optional) Ticket Class description.
sorting 	integer 	The order in which ticket classes are listed during purchase flow on the event listing page.
cost 	currency 	Display cost of the Ticket Class (paid only) on Ticket Listing page.
fee 	currency 	Display fee of the Ticket Class (paid only) on Ticket Listing page.
donation 	boolean 	true = Ticket Class is a Donation.
free 	boolean 	true = Ticket Class is Free.
minimum_quantity 	integer 	Minimum number of tickets that can be purchased per Order.
maximum_quantity 	integer 	Maximum number of tickets that can be purchased per Order.
has_pdf_ticket 	boolean 	true = Attendee receives a PDF Order confirmation.
delivery_methods 	list 	List of delivery methods enabled for this Ticket Class. Possible values are: [electronic, will_call, standard_shipping, third_party_shipping]
on_sale_status 	string 	Ticket class sale status. One of: AVAILABLE, SOLD_OUT
image_id 	string 	Image ID for this ticket class (Used for add-ons).
Private Fields

Use these fields to specify properties of a Ticket Class that are only available Organizations Members.
Field 	Type 	Description
capacity 	integer 	Number of this Ticket Class available for sale.
quantity_sold 	integer 	Number of this Ticket Class that has previously been sold (does not include tickets being purchased in real time).
hidden 	boolean 	true = Ticket Class is hidden from the public.
sales_start 	datetime 	Date and time that sales for this Ticket Class begin.
sales_end 	datetime 	Date and time that sales for this Ticket Class end.
sales_end_relative 	object 	Relative values used to calculate ticket sales_end. Can only be used for series parent tickets.
sales_start_after 	string 	ID of a Ticket Class that, when another Ticket Class sells out, triggers the start of sales of this ticket class.
include_fee 	boolean 	true = Ticket fee included in the ticket price as shown on the Ticket Listing page. This parameter cannot be used in conjunction with the split_fee parameter.
split_fee 	boolean 	true = Ticket fee not included in the ticket price as shown on the Ticket Listing page. Instead the actual_cost and actual_fee are displayed separately.
hide_description 	boolean 	true = Ticket Class description hidden on the Ticket Listing page (also removes description from public responses).
hide_sale_dates 	boolean 	true = Ticket Class sale dates will be hidden on the event landing page and in ticket selection.
auto_hide 	boolean 	true = Ticket Class hidden on the Ticket Listing page when tickets are not for sale .
auto_hide_before 	datetime 	Overrides the default time that auto hide is automatically disabled, so that the ticket class continues to be displayed. Otherwise sales_start is shown.
auto_hide_after 	datetime 	Override the default time that auto hide is automatically enabled, so that the the ticket class continues to be hidden. Otherwise sales_end is shown.
order_confirmation_message 	string 	Confirmation message displayed when an Order is completed.
secondary_assignment_enabled 	boolean 	true = Has secondary barcode assignment enabled (for ex/ RFID)
Expansions

Information from expansions fields are not normally returned when requesting information. To receive this information in a request, expand the request.
Expansion 	Source 	Description
event 	event_id 	Event for the Ticket Class.
image 	image_id 	Image for the Ticket Class.
Retrieve
GET
Retrieve a Ticket Class

Retrieve a Ticket Class by Ticket Class ID.
Create
POST
Create a Ticket Class

Create a new Ticket Class.

    Note: After May 7, 2020, we will require you to provide an inventory_tier_id as part of your request for any ticket_classes you are creating or updating for a tiered event. For more information refer to our changelog.

    Add-On creation: First you will need to create an Add-On Inventory Tier with count_against_event_capacity set to false and then provide the inventory_tier_id of the Add-On Inventory Tier when creating a new Ticket Class as part of your request.

Update
POST
Update a Ticket Class

Update Ticket Class by Ticket Class ID.
List
GET
List Ticket Classes by Event

List Ticket Classes by Event ID. Returns a paginated response.
GET
List Ticket Classes Available For Sale by Event

List Ticket Classes available for sale by Event ID for use in the purchase flow. Returns a paginated response.
Ticket Group

Ticket Group Object

The Ticket Group object is used to group Ticket Classes.

Most commonly used to apply a Cross-Event Discount to multiple Ticket Classes.
Fields
Field 	Type 	Description
name 	string 	Ticket Group name. A name containing more than 20 characters is automatically truncated.
status 	string 	Ticket Group status. Can be transfer, live, deleted or archived. By default, the status is live.
event_ticket_ids 	dict 	Dictionary showing the Ticket Class IDs associated with a specific Event ID.
tickets 	objectlist 	List of Ticket Class. Includes for each Ticket Class id, event_id, sales_channels, variants and name. By default this field is empty, unless the Ticket Class Expansions fields are used.
Retrieve
GET
Retrieve a Ticket Group

Retrieve a Ticket Group by Ticket Group ID.
Create
POST
Create a Ticket Group

Create a new Ticket Group for an Organization.

Maximum number of 300 live Ticket Groups per Organization; archived or deleted Ticket Classes are not included in this limitation.
Update
POST
Update a Ticket Group

Update Ticket Group by Ticket Group ID.
Add Ticket Class
POST
Add a Ticket Class to Ticket Groups

Add a Ticket Class to Ticket Groups by Organization ID and Event ID.

To remove a Ticket Class from every Ticket Group owned by an Organization, leave the Ticket Group ID empty.
List
GET
List Ticket Groups by Organization

List Ticket Groups by Organization ID. Returns a paginated response.

To include the Ticket Class name and sales channel in the response, add the Ticket Class expansion parameter.
Delete
DELETE
Delete a Ticket Group

Delete a Ticket Group. The status of the Ticket Group is changed to deleted.
User

    Note: Note These URLs will accept “me” in place of a user ID in URLs - for example, /users/me/orders/ will return orders placed by the current user.

User Object

User is an object representing an Eventbrite account. Users are Members of an Organization.
Retrieve Information about a User Account
GET
Retrieve Information about a User Account

Returns a user for the specified user as user. If you want to get details about the currently authenticated user, use /users/me/. To include the User’s assortment package in the response, add the assortment expansion parameter: /users/me/?expand=assortment
Retrieve Information About Your User Account
GET
Retrieve Information About Your User Account

Retrieve your User account information.
Venue

Venue Object

The Venue object represents the location of an Event (i.e. where an Event takes place).

Venues are grouped together by the Organization object.
Venue Fields
Field 	Type 	Description
address 	address 	Venue address.
id 	string 	Venue ID.
age_restriction 	string 	Age restriction of the Venue.
capacity 	number 	Maximum number of tickets that can be sold for the Venue.
name 	string 	Venue name.
latitude 	string 	Latitude coordinates of the Venue address.
longitude 	string 	Longitude coordinates of the Venue address.
Retrieve
GET
Retrieve a Venue

Retrieve a Venue by Venue ID.
Create
POST
Create a Venue

Create new Venue under an Organization.
Update
POST
Update a Venue

Update a Venue by Venue ID.
List
GET
List Venues by Organization

List Venues by Organization ID. Returns a paginated response.
Webhooks

Webhook Object

An object representing a webhook associated with the Organization.
Create
POST
Create Webhooks by Organization ID

Create a Webhook by Organization ID.
POST
Create Webhooks - deprecated

Create a Webhook.

    Warning: Access to this API will be no longer usable on June 1st, 2020.

For more information regarding deprecated APIs, refer to our changelog.
List
GET
List Webhook by Organization ID

List Webhooks by Organization ID.
GET
List of Webhooks - deprecation

List Webhooks.

    Warning: Access to this API will be no longer usable on June 1st, 2020.

For more information regarding deprecated APIs, refer to our changelog.
Delete
DELETE
Delete Webhook by ID

Delete a Webhook by ID.
No action selected

You can try selecting ‘Retrieve an Attendee’ from the left column.
Learn more about using the documentation.
