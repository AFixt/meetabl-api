# Operations and Responses

## HTTP Status Codes

This API uses the following HTTP status codes in the HTTP Response Headers:

* `200` is returned with status `OK` whenever `GET`, `PUT`, and `HEAD` operations were successful
* `201` is returned with status `Created` whenever a `POST` operation was successful
* `202` is returned with status `Accepted` whenever a `POST` or `PUT` operation was successful but the final result of the operation is expected to take longer than 500ms.
* `204` is returned with status `No Content` whenever a `DELETE` operation was successful
* `400` is returned with status `Bad Request` whenever an operation has failed due to a validation failure. Validation failures include a required parameter missing or a parameter out of bounds
* `401` is returned with status `Unauthorized` whenever an operation has failed due to insufficient permissions. Users will see this whenever they're either trying to access an admin-only operation or trying to access a user-created resource that they were not the creator of but have permissions to access. For instance, all users can see the teams they're a part of, but they cannot edit a team they did not create.
* `402` is returned with status `Payment Required` whenever a user has attempted an operation against a resource that requires a subscription
* `404` is returned with status `Not Found` whenever an operation has failed because the resource does not exist.  As a safety measure, we also return `404` if the item does exist but the user making the request does not have access to it.
* `405` is returned with status `Method Not Allowed` whenever an operation is attempted with anything other than the following request types: `GET`, `POST`, `PUT`, `DELETE`, or `HEAD`.
* `422` is returned with status `Unprocessable Entity` whenever the requester is attempting to `POST` another record for an object type that can have only one. For example: when trying to `POST` user preferences, because a user can have only one preferences record.
* `429` is returned with status `Too Many Requests` whenever the requester has submitted too many requests in too short a period
* `500` is returned with status `Internal Server Error` whenever there's a problem with the API itself or a related dependent service

## Responses

### Success

As described above, all successful responses come with an HTTP `2xx` response.

* Successful `GET` requests with `200` response will have a response body consisting of an array of the objects requested. The object structure will depend on the type of object.
* Successful "`GET` by ID" requests with `200` response will have a response body consisting of the object requested. The object structure will depend on the type of object.
* Successful `POST` requests will always return a `201` response and the response body will echo back the newly created object.
* Successful `POST` and `PUT` requests that are expected to take longer than 500ms will always return a `202` response and the response will contain a `location` header with a link to the newly created object and a `retry-after` header with the number of seconds to wait before checking the status of the operation.
* Successful `PUT` requests will always return a `200` response and the response body will echo back the object in its updated state.
* Successful `DELETE` requests will always return a `204` response and _will not have a response body_.
* Successful `HEAD` requests will always return a `200` response and _will not have a response body_.

### Errors

* All error responses will come with an HTTP `4xx` response other than internal server errors.
* All error responses will feature the same structure in the response body as shown below.

```json
{
  "error": {
    "code": "bad_request",
    "message": "Human-readable message",
    "params": [
        {
            "param": "foo",
            "message": "Foo is required"
        }
    ]
  }
}
```

* `message` will provide a human-readable error message describing the error. This message should be user-friendly and clear enough that its value can be used directly in client applications.
* For `bad_request` responses, the information provided within the `params` array will provide additional field-by-field details to help recover. NOTE: `params` is only provided for `400` responses.
* The value within `code` will be one of the following token values:
  * `bad_request` is returned with all `400` responses. In this case, it means that either a required parameter was missing or a parameter was supplied with an invalid value. When that happens, there will be a `params` array which features an object for each parameter that was invalid. Each of those objects will have two properties:
    * `param`: the name of the parameter that is invalid
    * `message`: a human readable message indicating how the param is failing validation. This is meant to be user-friendly and clear enough that it can be used directly in client applications. Its content will be returned in the language matching the `Content-Language` header in the response.
  * `duplicate` is returned with all `422` responses.
  * `unauthorized` is returned with all `401` responses
  * `payment_required` is returned with all `402` responses
  * `not_found` is returned with all `404` responses
  * `method_not_allowed` is returned with all `405` responses
  * `too_many_requests` is returned with all `429` responses
  * `internal_server_error` is returned with all `500` responses
