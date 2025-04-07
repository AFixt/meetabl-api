# Requests

Note: Below, we use `integer` to refer to data types, but those values might arrive
as strings of numeric characters, because browsers treat the parameters in a `GET` URL as strings. Validation should understand and allow this, explicitly casting
those values to the proper type before validating and using them.

## URL Structure

The URL structure of all APIs that use this specification will be in the form of:

```javascript

https://{{baseUrl}}/{{object}}/{{id}}

```

Or, in the case of hierarchical object structures:

```javascript

https://{{baseUrl}}/{{parent-object}}/{{parent-object-id}}/{{object}}/{{id}}

```

The above is a bit subjective, because URLs can become quite long using the above nesting pattern.

Consider the following pattern:

```javascript

https://{{baseUrl}}/tenant/:tenantId/system/:systemId/project/:projectId/issues/:issueId/comment/:commentId

```

Once actual UUIDs are added:

```javascript

https://{{baseUrl}}/tenant/8a007b15-1f39-45cd-afaf-fa6177ed1c3b/system/b3f022a4-2970-4840-b9bb-3d14709c9d2a/project/af6c1308-613f-40ff-9133-a6b993249c8/issues/3f16dca9-870e-4692-be2a-ea6d883b9dfd/comment/c0b2c9df-1df8-4b7c-bb1e-3e449ce746af


```

So, as a general guide, routes should try to avoid using a hierarchy with more than three levels, with four levels considered the absolute maximum and used only in very rare circumstances.

## `GET`

`GET` operations always retrieve records.

### Optional parameters

The following optional parameters may be used in `GET` requests

* `limit`: an `integer` value representing the total number of records to retrieve as a part of the response to this request. `limit` is optional, unless `offset` is supplied. Maximum value is `100`. Default value is `100`.
* `offset`: an `integer` value representing the first number of records to retrieve as a part of the response to this request. `offset` is optional. Default value is `0`
* `order`: a `string` value representing the field to be used in ordering the results from this request. Any valid object property can be used in `order`. Because this parameter impacts the SQL query used to retrieve data, you can use multiple valid field names here. Supplying an invalid field name will result in a `400` response.
* `dir`: an `enum` value representing the direction for the sorting. Valid values are `asc` or `desc`. Any other value will result in a `400` response.

Internally, this would result in a SQL query structured like so:

```SQL
 SELECT * FROM {table} ORDER BY {order} {dir} LIMIT {limit} OFFSET {offset}
```

For example, a request like this:

```SQL
https://{{baseUrl}}/users?limit=100&offset=200&order=created&dir=asc
```

Would result in the following query being made in the database:

```sql
 SELECT * FROM users ORDER BY created ASC LIMIT 100 OFFSET 200

```

NOTE: default values for `order` and `dir` will depend on the type of object being requested. Generally speaking, the following patterns apply:

* When there's a date-related property in the object, results will be ordered by that field by default, ordered by most recent result fist.  For example, assuming a field called `startDate`, the default would be `order=startDate&dir=desc`
* If there is no date-related property to the object, results will be ordered by the next most useful field, which will typically be a name, title, or other short, human-readable descriptor of the object. In those cases, the results will be ordered `asc` (which returns results A-Z). For example, assuming a field called `name`, the default would be `order=name&dir=asc`

#### Special Params: `expand` and `q`

In addition to the above, `GET` requests can also feature the following paramaters:

* `expand`: a `boolean` value representing whether meaningful child objects should be included in the response. Which child objects are included depends on the type of object being queried. Generally it is our practice to "expand" whatever sub-objects and related objects that will be most useful for the intended use in the Eventably UI.
* `q`: a `string` value. The use of `q` turns the request into a search. Which fields are included in the search depends on the type of object. Most searches will be tightly scoped based on the type of user performing the search and the context of the search itself.

Note: It is generally not advised to `expand` on `GET` requests that are expected to pull down a lot of information. `expand` is best used on "`GET` by ID" requests, as doing so is likely to retrieve additional, important, human-readable content.

## "`GET` by ID"

`GET` by ID operations always retrieve a single record.

These requests can also make use of the `expand` query parameter.

## `POST`

`POST` operations always create records

## `PUT`

* `PUT` operations always update a single record, specified by an `id`
* A `PUT` operation without an `id` should return a `400` response
* `PUT` operations DO NOT require that the object be complete. The only fields that should be updated are those that are included in the request
* It should validate to ensure that the `id` provided is a valid UUID. If not, it should return a `400` response.
* If the validation passes, it should perform an `UPDATE` query in the database and:
  * If `results.affectedRows` is greater than '0', it should return a `200` response.  
  * If `results.affectedRows` is '0', it should return a `404` response.

## `DELETE`

* `DELETE` requests are used to remove a single, specific resource from the system.
* A `DELETE` operation without an `id` should return a `400` response
* `DELETE` operations are permanent. We assume that the user's desire to remove the resource has already been confirmed.
* It should validate to ensure that the `id` provided is a valid UUID. If not, it should return a `400` response.
* If the validation passes, it should perform a `DELETE` query in the database and
  * If `results.affectedRows` is greater than '0', it should return a `200` response.  
  * If `results.affectedRows` is '0', it should return a `404` response.

### Cascading Deletes

Some `DELETE` operations will also delete related child records. This should be handled by the database, through the use of `ON DELETE CASCADE` constraints.

## `HEAD`

* `HEAD` requests are used to determine if a specified resource exists.  
* A `HEAD` operation without an `id` should return a `400` response
* It should validate to ensure that the `id` provided is a valid UUID. If not, it should return a `400` response.
* If the validation passes, it should perform a `SELECT` query in the database and
  * If a result exists, it should return a `200` response.  
  * If a result does not exist, it should return a `404` response.

## `expand` Parameter

`GET` and "`GET` by ID" requests can also use a query parameter called `expand` which will expand the results to include child objects and object details. The behavior of `expand` will vary, depening on the type of object(s) and the object hierarchy. Generally, our use of `expand` will be limited to whatever is deemed most useful to the Eventably UI and/ or will make the results more useful to the end consumer. Typically, results that are expanded will provide convenience for both the consumer of the API and the system itself in that it reduces the total number of requests required.

## Pagination

During `GET` (not "`GET` by ID") requests, all results are returned with pagination headers:

* `X-Total-Count`: Indicates the total number of items available.
* `X-Total-Pages`: Indicates the total number of pages.
* `X-Per-Page`: Indicates the number of items per page.
* `X-Current-Page`: Indicates the current page number.

These headers work in conjunction with the optional query parameters `limit`, and `offset`. For example:

* `X-Per-Page` will always equal `limit`.
* `X-Current-Page` will always be impacted by the total count, the `limit` and `offset`.
* As above, if `limit` is not set as a query param, its value defaults to `100`.
* As above, if `offset` is not set as a query param, its value defaults to `0`.
* `X-Total-Pages` is calculated as being `X-Total-Count`/ `limit`.  For example, if there are 1000 records and `limit` is `100`, then `X-Total-Pages` is `10`.
