# Validation

This document describes how general validation works across all routes. Each route may have additional validation of their own specific to that route.

## All requests

1. All requests must [validate the JWT used in the request](https://medium.com/dataseries/public-claims-and-how-to-validate-a-jwt-1d6c81823826)
1. All requests must verify that the JWT is not in the blacklist table

Note: Below, we use `integer` to refer to data types, but those values might arrive
as strings of numeric characters, because browsers treat the parameters in a `GET` URL as strings. Validation should understand and allow this, explicitly casting
those values to the proper type before validating and using them.

## `GET`

1. All `GET` requests should verify that the user is either the owner of the records being retrieved or has - at minimum - `read` permissions for that type of object.
1. All `GET` routes support a handful of optional query string parameters, each of which must be validated:
    * `limit`: an `integer` value representing the total number of records to retrieve as a part of the response to this request. `limit` is optional, unless `offset` is supplied. Maximum value is `100`
    * `offset`: an `integer` value representing the first number of records to retrieve as a part of the response to this request. `offset` is optional.
    * `order`: an `string` value representing the field to be used in ordering the results from this request. Fields that can be used in `order` are limited to the type of object being retrieved. Supplying an invalid field name will result in a `400` response.
    * `dir`: an `enum` value representing the direction for the sorting. Valid values are `asc` or `desc`. Any other value will result in a `400` response.
1. For security purposes all other query params should be explicitly unset and ignored.

## `GET by Id`

 1. The `id` param is required
 1. The `id` must be a UUID, unless specified otherwise
 1. Any URL parameter other than `id` should be ignored. For security purposes all other params should be explicitly unset and ignored.
 1. Validation should first verify that the record exists.

## `POST`

 1. All `POST` operations must come in the form of a JSON body.
 1. Each object type may also have its own specific validation requirements as described in its specification

## `PUT`

 1. All `PUT` operations must come in the form of a JSON body.
 1. The `id` param is required
 1. The `id` must be a UUID, unless specified otherwise
 1. Any URL parameter other than `id` should be ignored. For security purposes all other params should be explicitly unset and ignored.
 1. Validation should first verify that the record exists.
 1. Each object type may also have its own specific validation requirements as described in its specification

## `DELETE`

 1. The `id` param is required
 1. The `id` must be a UUID, unless specified otherwise
 1. Any URL parameter other than `id` should be ignored. For security purposes all other params should be explicitly unset and ignored.
 1. Validation should first verify that the record exists.

## `HEAD`

 1. The `id` param is required
 1. The `id` must be a UUID, unless specified otherwise
 1. Any URL parameter other than `id` should be ignored. For security purposes all other params should be explicitly unset and ignored.
 1. Validation should first verify that the record exists.
