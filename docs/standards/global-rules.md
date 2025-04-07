# Global Rules

* All requests to the API (other than the authentication and register routes) must have a JWT bearer token.
* All requests **should** have `Accept-Language` header set to a supported ISO 2-character language code.
* All responses **must** have `Content-Language` header set to an ISO 2-character language code which matches the `Accept-Language` header OR which defaults to `en`.
* All `GET`, `POST`, and `PUT` responses **must** have a `Content-Type` header with a value of `application/json`
* All `POST` and `PUT` requests **must** have a `Content-Type` header with a value of `application/json`
* All successful `DELETE` responses **must not** have a body.
* All `HEAD` responses **must not** have a body.
* `PUT` requests **may not** provide all possible fields in their requests.
* `PUT` requests **must** have the unique ID for the records being updated, however all other properties are optional (as the assumption is that any required properties were supplied during `POST`).
* All fields that are supplied during `PUT` requests must pass their relevant validation requirements.
* All successful `POST` and `PUT` requests will respond with the full object details as would be retrieved by a "`GET` by ID" request.
* All `description` fields (or fields with similar purpose) **must** accept Markdown
* All JSON responses **must* adhere to the [JSON specification](https://datatracker.ietf.org/doc/html/rfc8259)
* All connections **should** use `Keep-Alive`
* All routes **should** use `Content-Encoding: gzip`
* All dates & times **should** be stored in the database as UTC timestamps
* All dates & times, when returned by the API, **should** be RFC 3339 formatted.
