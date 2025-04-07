# Node.js structure and naming conventions

## On the Applicability of these Standards

All work performed on the project shall conform to these standards, without exception. Failure to conform to these standards will result in denial of the work delivered until the delivered code conforms to these standards.

## Readability Comes Before Anything

In order to streamline the development process, avoid bugs, and ease maintenance of the system, developers should ensure that - above all - readability matters most. Almost all of the items listed in this document relate to improving the readability of the code so that it can be more easily read by others (including yourself). A good guide to keep in mind is to ask someone to take a quick glance at the code. If even a marginally experienced developer can't understand what's happening, something is wrong.

## JavaScript Code Style

JavaScript code should follow modern ES6+ standards with consistent styling. When working with Node.js, leveraging modern JavaScript features is encouraged, including:

* Arrow functions
* Destructuring assignments
* Template literals
* Async/await for asynchronous operations
* ES modules (where supported by your Node version)

For compatibility reasons, always be aware of which Node.js version you're targeting, as some features may require transpilation for older versions.

## Comments

Informative documentation is the cornerstone of easier maintenance and repair of the system. For that reason, developers should take a rather liberal approach to commenting their code. A general rule of thumb is that if you look at a section of code and think "Wow, I don't want to try and describe that", you need to comment it before you forget how it works. Comments should document decisions. At every point where you had a choice of what to do place a comment describing which choice you made and why.

All documentation blocks ("docblocks") must be compatible with the JSDoc format. Describing the JSDoc format is beyond the scope of this document. For more information, visit: https://jsdoc.app/

### File Level Document Block

Every file that contains JavaScript code must have a header block at the top of the file. The header block should contain these items, at minimum:

* Short description for the file
* Long description of the file
* JSDoc for author

```js
/**
 * Short description for file
 *
 * (optional) Long description for file ...
 *
 * @author 	author name 
 */
```

### Function Level Documentation Block

Every function definition must have a documentation block above the function. The documentation block should contain these items, at a minimum:

* Description of the function
* Any external dependencies used
* Parameters
* Return value

```js
/** 
 * abusive language filter, replaces bad words in a string with '****'
 * @param {string} string - string of text to be cleaned
 * @returns {string} the same input string is redisplayed with the curse words converted
 */
```

### Inline Comments

JavaScript style comments (`// single-line` and `/* multi-line */`) are both fine. Use of hash-style comments (`#`) should not be used, even though Node.js now supports them in newer versions. The primary convention is to use `//` for single-line comments and `/* */` for multi-line comments (with `/**` being used as the marker for the top of the multi-line comment).

#### Examples:

```js
// single line comment

/**
 * This is a 
 * multi-line
 * comment
 */
```

### Comment Your "Gotchas"

Developers should ensure that all those places where something happens which may trip up future developers has been commented clearly and that you make these comments much easier to notice by others than normal comments.

* @TODO means there's more to be done to finish/ improve/ repair that section.
* :BUG: means there's a known bug in that section of code.
* :KLUDGE: means you've done something ugly, inefficient, or inideal. Explain how you would do it differently next time if you had more time.
* :WARNING: Tells others that the following code is very tricky so don't go changing it without thinking.

*Committing @TODO code to master is a pretty terrible idea and should be avoided if possible. If you have a @TODO comment, it **must** also have a JIRA ticket associated with it. i.e.:*

```js
// @TODO Jira ticket XYZ-123 add param foo to indicate whether bar applies
```

#### Formatting of a "Gotcha" Comment Block

Make the gotcha keyword the first symbol in the comment. If you have a keyword you feel is more appropriate than any of the ones listed above, feel free to make up your own.

Comments may consist of multiple lines, but the first line should be a self-containing, meaningful summary.

The writer's name and the date of the remark (in YY-MM-DD format) should be part of the comment. This information is in the source repository, but it can take a quite a while to find out when and by whom it was added. Often gotchas stick around longer than they should. Embedding date information allows other programmer to make this decision. Embedding who information lets us know who to ask. If, during your inquiry, you discover the issue has been resolved, please add that to the comments as "FIXED"

#### Example "Gotcha" blocks

```js
/**
 * :KLUDGE: klg 07-11-02: possible unsafe type cast
 * We need a type check here to recover the derived type. It should
 * probably use a more robust validation method.
 */
```

```js
/**
 * :BUG: klg 07-11-02: unescaped request data causes SQL error
 * Data being posted to the form causes SQL error whenever
 * it contains quotes, double-quotes, or apostrophes.
 *
 * FIXED klg 07-11-09: use of validation middleware escapes these 
 * characters. Increased security and avoids SQL errors
 */
```

## Editor Settings

### Tabs vs. Spaces

Developers must use spaces all the time. Developers should set their editors to format "tabs" as 2 spaces, which is the standard for Node.js and JavaScript projects.

### Line Length

The target line length is 100 characters for basic code lines but readability is the primary consideration in determining how and when lines should wrap.

### Linefeeds

The three major operating systems (Unix, Windows and Mac OS) use different ways to represent the end of a line. Unix systems use the newline character (\n), Mac systems use a carriage return (\r), and Windows systems use a carriage return followed by a line feed (\r\n).

Developers should use simple newlines (Unix/LF style), as this is the standard for all Node.js projects. If you develop on Windows, be sure to set up your editor to save files in Unix format.

### Always Use Braces

Braces must be included when writing code using if, for, while etc. blocks. There are no exceptions to this rule, even if the braces could be omitted per language syntax. Leaving out braces makes code harder to maintain in the future and can also cause bugs that are very difficult to track down.

### Placement of Braces

For JavaScript, braces should follow the "K&R style" (Kernighan and Ritchie) convention. The opening brace is placed on the same line as the statement, with one space before it:

```js
if (condition) {
  // do something
}
```

NOT

```js
if (condition)
{
  // do something
}
```

### Spaces Between Tokens

There must be one space on either side of a token in expressions, statements etc. The only exceptions are commas (which should have one space after, but none before), semi-colons (which should not have spaces on either side if they are at the end of a line, and one space after otherwise).

Variable assignment:

```js
const i = 0;
```

Function with arguments:

```js
foo(a, b, c);
```

Ternary Operator:

```js
const i = (j < 5) ? j : 5;
```

Loop:

```js
for (let i = 1; i <= 10; i++) {
  console.log(i);
}
```

### Operator Precedence (parens)

Even though operator precedence in JavaScript follows established standards, it's not reasonable to expect everyone to know the exact precedence of all operators. Always use brackets or parentheses to make your intentions absolutely clear. This makes maintainability much easier for anyone reviewing the code later.

## Variables

### Variable Naming

Variable names should suggest a property or noun clearly indicating what sort of information will be stored in the value. For instance, `username` clearly indicates that the value stored in that variable will be a username.

Hungarian notation should never be used in the naming of variables, functions, classes, or anything else.

### Exception: Loops

Variables within loops, being only local to that particular loop, can (and should) be short.

```js
for (let i = 0; i < 5; i++) {
  // do stuff
}
```

Or:

```js
array.forEach((item, index) => {
  // do stuff
});
```

Or when working with objects:

```js
Object.entries(myObject).forEach(([key, value]) => {
  // do stuff
});
```

There are, however certain conventions to consider when naming variables within loops:

* `i`, `j`, and `k` are often used as generic names for integer variables in nested loops
* When working with arrays, `item` or a descriptive singular noun is preferable as the iterated value

Do not use the variable `l` (lowercase 'L') in any of your code as it looks too much like the number 'one'.

### Abbreviations and Acronyms

Abbreviations and acronyms should not be used unless the abbreviation or acronym is likely to be universally understood among all other developers likely to be working on the system. For example 'WCAG' is an acronym likely to be understood by all team members as "Web Content Accessibility Guidelines", whereas 'SBC' (Small Block Chevy) is a bit less likely to be understood by those same employees.

### Private Variables and Methods

In modern JavaScript classes, private members should use the `#` prefix notation (where supported) or a convention of preceding private members with an underscore (`_`) if the code must support older Node versions:

```js
class MyClass {
  // Private field (modern approach)
  #privateField = 'private';
  
  // Private method (modern approach)
  #privateMethod() {
    // implementation
  }
  
  // Legacy convention for older Node versions
  _legacyPrivateField = 'private';
  
  _legacyPrivateMethod() {
    // implementation
  }
}
```

### Initialize Variables

Always initialize variables before using them. Use `const` for variables that won't be reassigned, and `let` for variables that will change. Avoid using `var` which has problematic scoping behavior.

```js
const user = '';  // Preferred for constants
let count = 0;    // For variables that will change
```

### Variable Declaration

Always use `const` or `let` to declare variables - never rely on variables implicitly becoming global. Using `const` by default and `let` only when needed is preferred to show intent and prevent accidental reassignment.

### Uppercase For Constants

Constants should be declared using all uppercase letters with underscores as separators:

```js
const MAX_USERS = 100;
const API_KEY = 'abcdef123456';
```

This only applies to "true" constants - values that are known at creation time and never change. Configuration values that are loaded at runtime but don't change during execution should use camelCase.

### Boolean Variable Values

Use the actual boolean values `true` and `false` (lowercase), not strings like 'true' or 'false'. Unlike PHP, JavaScript has proper boolean primitives.

#### Comparisons against booleans

When creating a comparison against a boolean, use the simplest form:

```js
if (isValid) {
  // do something when valid
}

if (!isExpired) {
  // do something when not expired
}
```

For non-boolean values, use triple equals (`===`) for strict equality checking:

```js
if (value === null) {
  // handle null case
}
```

## Object-Oriented JavaScript

### Naming Classes

Use PascalCase (first letter of each word capitalized) for class names:

```js
class UserController {
  // class implementation
}
```

### One Class Per File

All classes should be separated into their own files. The name of the file should follow the convention of matching the class name: `UserController.js`.

### Do Not Do Real Work With Constructors

Do not do any real work with an object's constructor. Instead, use the constructor to initialize variables only and/or do only actions that can't fail. This is because constructors can't return a rejected promise or throw nicely handled errors.

Create a method for an object which needs to do stuff that completes construction. This method should be called after object instantiation. The conventional name for this method tends to be `init()` or a more descriptive name like `connect()` for database connections.

## Functions

### Naming

Like variables, functions and methods should be named in a way that is clear and concise. In general that means the name of the function should be as accurate a description of what the function does as possible:

* If a function prints user information to the screen the name of the function should be `printUserInformation`.
* If a function validates that an e-mail address is formatted properly it should be called `isValidEmail()`.
* In general functions that return a boolean value should start with `is` or `has`
* Functions should use camelCase (first letter lowercase, subsequent words capitalized)
* Functions should be stateless and as a general rule *never* rely on global information not directly passed to the function
* Private functions or methods (not exported) should begin with underscore `_calculateTotal()`

### Arguments

Argument names should be chosen with the same care as variable names.

Arguments with default values should go at the end of the argument list:

```js
function greet(name, greeting = 'Hello') {
  return `${greeting}, ${name}!`;
}
```

For functions that accept many options, use an options object:

```js
function searchUsers(query, { limit = 20, offset = 0, sortBy = 'name' } = {}) {
  // implementation
}
```

### Be wary of writing functions without a return value

A common practice is making functions that perform side effects without returning a value. While sometimes necessary, this can limit reusability. Consider the following:

```js
function mySum(numX, numY) {
  const total = numX + numY;
  console.log(total); 
}
```

In the case of the example above, there's only one thing the `mySum` function can do: log the results of a simple addition. While, on the surface, that might not be a big deal, it creates two problems:

* It keeps the function from being able to be included as part of another function or bigger process.
* Any remediation to this function (to make it return, rather than log its result) will break all already-existing code which uses this function.

A better approach would be to ensure all functions return some value, even if that value is a primitive or a boolean. Doing so makes for much more robust & reusable code which also enables you to do better error handling and provide greater usability for the end user. The example function can be modified as follows:

```js
function mySum(numX, numY) {
  const total = numX + numY;
  return total; 
}
```

The function can now also be modified further to do some basic type checking to make sure the input parameters are indeed numbers (and set to return NaN if they're not) and the function can also be used elsewhere, such as within other functions.

```js
// Example usage
const total = mySum(10, 10);
if (!isNaN(total)) {
  console.log(total);
}
```

## Control Structures

### Switch Statements

Control statements written with the `switch` construct must have a single space before the opening parenthesis of the conditional statement, and also a single space after the closing parenthesis.

All content within the `switch` statement must be indented as described elsewhere in this document.

```js
switch (numPeople) {
  case 1:
    break;

  case 2:
    break;

  default:
    break;
}
```

The `default` case must not be omitted from a switch statement.

NOTE: It is sometimes useful to write a case statement which falls through to the next case by not including a break or return in that case. To distinguish these cases from bugs, any case statement where break or return are omitted must contain the comment `// break intentionally omitted`.

### if/else/elseif

Control statements based on the if and else constructs must have a single space before the opening parenthesis of the conditional, and a single space after the closing parenthesis.

Within the conditional statements between the parentheses, operators must be separated by spaces for readability. Inner parentheses are encouraged to improve logical grouping of larger conditionals.

The opening brace is written on the same line as the conditional statement. The closing brace is always written on its own line. Any content within the braces must be indented two spaces.

```js
if (a !== 2) {
  a = 2;
}
```

For "if" statements that include "else if" or "else", the formatting must be as in these examples:

```js
if (a !== 2) {
  a = 2;
} else {
  a = 7;
}
```

```js
if (a !== 2) {
  a = 2;
} else if (a === 3) {
  a = 4;
} else {
  a = 7;
}
```

JavaScript allows for these statements to be written without braces in some circumstances. The coding standard makes no differentiation and all "if", "else if" or "else" statements must use braces.

### Ternary Operators

In general don't use ternary operators - use the longer form if / else statements. The exception would be cases where the ternary operation is painfully obvious or for simple assignments:

```js
// Acceptable use of ternary
const displayName = user.name ? user.name : 'Anonymous';
```

### Loops and Iteration

Modern JavaScript provides multiple ways to iterate through arrays and objects. Prefer these modern approaches over traditional `for` loops when possible:

```js
// Preferred for arrays
array.forEach(item => {
  // process item
});

// For transforming arrays
const newArray = array.map(item => transformItem(item));

// For filtering arrays
const filteredArray = array.filter(item => meetsCriteria(item));

// For object properties
Object.keys(obj).forEach(key => {
  const value = obj[key];
  // process key and value
});
```

### Condition Format

When comparing a variable to a literal value, put the variable on the left hand side:

```js
if (userId === 6) { /* do stuff */ }
```

This is the opposite of some languages like PHP where putting constants on the left can catch assignment typos. In JavaScript, the strict equality operator (`===`) prevents this issue.

## Strings

### String Literals

String literals in modern JavaScript should use template literals (backticks) for strings that include variables or span multiple lines, and single quotes for simple strings:

```js
// Simple string
const name = 'Karl';

// String with variable interpolation
const greeting = `Hello, ${name}!`;

// Multiline string
const message = `This is a long message
that spans multiple
lines`;
```

### Variable Strings

For string interpolation, use template literals (backticks) rather than concatenation:

```js
// Preferred
const message = `User ${userId} is missing in action.`;

// Avoid
const message = 'User ' + userId + ' is missing in action.';
```

### String Concatenation

If you need to concatenate strings rather than use template literals, strings may be concatenated using the `+` operator. A space must always be added before and after the `+` operator to improve readability:

```js
const name = 'Karl' + ' ' + 'Groves';
```

### Concatenating Long Strings

When concatenating strings with the `+` operator, it is permitted to break the statement into multiple lines to improve readability. In these cases, each successive line should be padded with whitespace such that the `+` operator is aligned under the `=` operator:

```js
const query = "SELECT id, name FROM people "
             + "WHERE name = 'Karl' "
             + "ORDER BY name ASC ";
```

However, template literals are usually a better choice for multiline strings:

```js
const query = `
  SELECT id, name 
  FROM people
  WHERE name = 'Karl'
  ORDER BY name ASC
`;
```

## Arrays

### Declaring Arrays

Always use the literal notation for array declarations (unless there's a good reason not to):

```js
// Preferred
const names = ['Karl', 'Joe', 'Bob'];

// Avoid
const names = new Array('Karl', 'Joe', 'Bob');
```

### Array Methods

Modern JavaScript provides powerful array methods that should be preferred over manual iteration:

```js
// Finding an element
const user = users.find(u => u.id === userId);

// Check if array contains an element
const hasAdmin = users.some(user => user.role === 'admin');

// Transform all elements
const userNames = users.map(user => user.name);

// Filter elements
const activeUsers = users.filter(user => user.isActive);

// Reduce to a single value
const totalAge = users.reduce((sum, user) => sum + user.age, 0);
```

### Numerically Indexed Arrays

Negative numbers are not permitted as indices.

An indexed array may be started with any non-negative number, however this is discouraged and it is recommended that all arrays have a base index of 0.

When declaring arrays with the literal syntax, a trailing space must be added after each comma delimiter to improve readability:

```js
const sampleArray = ["Foo", "Bar", "Bat", "Baz"];
```

It is also permitted to declare multiline indexed arrays. In this case, each successive line must be padded with spaces such that beginning of each line aligns as shown below:

```js
const sampleArray = [1, 2, 3, "Foo", "Bar",
                    a, b, c,
                    56.44, d, 500];
```

### Objects (Associative Arrays)

When declaring objects with the literal syntax, it is encouraged to break the statement into multiple lines for readability. In this case, each successive line must be padded with whitespace such that both the keys and the values are aligned:

```js
const sampleObject = {
  firstKey:  'firstValue',
  secondKey: 'secondValue'
};
```

Objects can also be declared one property at a time. In JavaScript, property names should be camelCase by convention, with exceptions for specific scenarios like API integrations:

```js
const user = {};
user.firstName = 'John';
user.lastName = 'Doe';
```

For accessing properties, use dot notation when the property name is known and fixed. Use bracket notation only when the property name is dynamic or non-standard:

```js
// Preferred for known properties
const name = user.firstName;

// For dynamic properties
const fieldName = 'firstName';
const name = user[fieldName];
```

## Debugging

### Error Handling

Always use proper error handling with try/catch blocks, especially for asynchronous operations:

```js
// For promises
myPromise()
  .then(result => {
    // handle success
  })
  .catch(error => {
    // handle errors
    console.error('Operation failed:', error);
  });

// For async/await
async function doSomething() {
  try {
    const result = await myPromise();
    // handle success
  } catch (error) {
    // handle errors
    console.error('Operation failed:', error);
  }
}
```

### Logging

Use appropriate logging levels for different types of information. Never use `console.log` in production code - use a proper logging library like Winston or Bunyan instead:

```js
// Example with a logging library
const logger = require('./logger');

// Different log levels
logger.debug('Detailed debug information');
logger.info('Something noteworthy happened');
logger.warn('Warning: something might be wrong');
logger.error('Error occurred', err);
```

### Validation

Validate all inputs, especially from HTTP requests. Use validation libraries like Joi, express-validator, or similar tools:

```js
// Example with express-validator
const { body, validationResult } = require('express-validator');

app.post('/user',
  // Validation middleware
  [
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
  ],
  // Request handler
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Process validated request
  }
);
```

## File Formats

All files must:

* Be stored as UTF-8 encoded text files
* Be Unix formatted "Unix formatted" means lines must end only with a line feed (LF). Line feeds are represented as ordinal 10, octal 012 and hex 0A. Do not use carriage returns (CR) like Macintosh computers do or the carriage return/line feed combination (CRLF) like Windows computers do.

### Extensions for files

* `.js` for JavaScript files
* `.mjs` for ES modules (if used)
* `.cjs` for CommonJS modules (if explicit)
* `.jsx` for React JSX files
* `.ts` for TypeScript files
* `.tsx` for TypeScript React files
* `.json` for JSON configuration files
* `.html` for HTML files
* `.css` for CSS files
* `.test.js` or `.spec.js` for test files

### Naming Conventions for files and directories

All names for files and directories must make sense when read. Ensure that the name indicates the type of content/structure which it contains. This is just as important for developers as it is the audience.

### File and directory naming casing

For Node.js projects, follow these conventions:

* Use kebab-case (lowercase with hyphens) for directories and most files: `user-authentication/`
* Use camelCase for JavaScript files that export a single function or object: `userService.js`
* Use PascalCase for files that export a class or React component: `UserController.js`, `LoginForm.jsx`
* Use UPPER_SNAKE_CASE for constants files: `DEFAULT_CONSTANTS.js`
* Use lowercase for configuration files: `package.json`, `.eslintrc.js`

Exception: Files containing classes should mirror the casing of the class. For instance, a `UserService` class file would be `UserService.js`.

### Delimiters

#### Publicly Viewable Files and Directories

Avoid using underscore delimiters on publicly viewable files and directories. Underscores, when displayed in electronic email and documents end up disappearing, being obscured instead by the underline which automatically appears on the URL. Laypersons may think that the underscore (again, which has been obscured by the underline) is a space and type it into their browser's address bar as such, resulting in a 404 error, leaving them unable to access the resource they're seeking.

#### Files and Directories Not Visible to Public

In the case of non-viewable files and directories, it is allowable to use underscores on these types of files. Such an approach may serve as a reminder that what's inside them isn't meant to be directly accessed by the outside world.

#### File and Directory Names Must Not Contain Spaces

Do not, under any circumstances, use spaces in file names of any kind.

## Directory structure

### Like Items With Like Items

Site assets should be placed in directories with other similar assets. For example, all style sheets should be placed in a directory called "styles", all images should be placed in a directory called "images", and so forth. In instances where like assets can be further separated into logical groups, you should do so.

### Grouped Together According To Topic

When it comes to publicly viewable pages, they should be placed in a directory structure that reflects the structure of the information itself - again, grouping similar information together. At the same time, take care that you do not use unnecessary sub directories. Create sub-directories when it is anticipated that the site's growth will be such that they're needed.

For instance:

* http://www.example.com/newsletters/2023/ - good
* http://www.example.com/newsletters/2023/january/ - bad, if the '2023' folder will only hold 12 files (one for each month), or good, if each month's folder contains multiple files, such as newsletter assets or if newsletters are published weekly.

### Node.js Project Structure

For a Node.js project, follow this general structure:

```
project-root/
├── src/                    # Source code
│   ├── config/             # Configuration files
│   ├── controllers/        # Route controllers
│   ├── middlewares/        # Express middlewares
│   ├── models/             # Data models
│   ├── routes/             # Route definitions
│   ├── services/           # Business logic
│   ├── utils/              # Utility functions
│   └── app.js              # Express app setup
├── tests/                  # Test files
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── fixtures/           # Test fixtures
├── public/                 # Public assets
│   ├── images/             # Image files
│   ├── styles/             # CSS files
│   └── scripts/            # Client-side JS
├── node_modules/           # Dependencies (git ignored)
├── .env                    # Environment variables (git ignored)
├── .env.example            # Example environment variables
├── .eslintrc.js            # ESLint configuration
├── .gitignore              # Git ignore file
├── package.json            # Project metadata and dependencies
├── package-lock.json       # Locked dependencies
└── README.md               # Project documentation
```

### Assets: Grouped Together According To Purpose

As stated above, all site assets should be grouped together according to their purpose.

* All images in a `public/images` directory
* All style sheets in a `public/styles` directory
* All client-side JavaScript files in a `public/scripts` directory
* All server modules in appropriately named directories under `src/`

### Exception: Assets That Aren't Used Globally

One exception to the above is when site assets are not shared throughout the most (or even majority) of the system. For more specific assets, place them closer to where they're used.

## Security

### Directory Security

For Express applications, ensure that only intended directories are publicly accessible. Configure Express to serve static files only from the designated public directory:

```js
// Only serve static files from the public directory
app.use(express.static('public'));
```

Never expose sensitive directories like `src`, `config`, or `node_modules` to the public.

### Filter All External Data

All data arriving to the system via HTTP requests must be validated and sanitized to prevent injection attacks, cross-site scripting (XSS), and other security vulnerabilities. Use middleware like helmet and express-validator:

```js
// Basic Express security setup
const express = require('express');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

const app = express();

// Set security-related headers
app.use(helmet());

// Parse JSON bodies
app.use(express.json());

// Example route with validation
app.post('/user',
  [
    body('email').isEmail().normalizeEmail(),
    body('name').trim().escape()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Process validated and sanitized request
  }
);
```

### Validate All External Data

After being filtered, all external data must be validated as well. This applies to all routes, including ones that receive query parameters.

For example, if the page in question has a URL like 'http://www.example.com/users?id=1', you should validate that `req.query.id` is indeed an integer and not something else:

```js
// Route parameter validation
app.get('/users', 
  [
    query('id').isInt()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Process with validated id
    const userId = parseInt(req.query.id, 10);
  }
);
```

### Environment Variables

Sensitive information like database credentials, API keys, and other secrets should never be hardcoded. Use environment variables with the dotenv package:

```js
// Load environment variables from .env file
require('dotenv').config();

// Use environment variables
const dbConnection = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};
```

Never commit `.env` files to version control. Instead, provide a `.env.example` file with placeholder values.

### Error Handling and Logging

Implement proper error handling throughout the application. Never expose detailed error information to clients in production:

```js
// Global error handler middleware
app.use((err, req, res, next) => {
  // Log the error details for debugging
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    requestId: req.id
  });
  
  // Client-facing error (don't expose internals)
  res.status(500).json({
    error: 'An unexpected error occurred',
    requestId: req.id // For support reference
  });
});
```
