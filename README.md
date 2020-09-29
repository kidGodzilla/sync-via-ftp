# sync-via-ftp

Provides simple, lightweight persistence for tiny apps.

Ideal for toy apps that don't quite justify a database server.

### What it does

1. Creates a global object which can be used to store small amounts of data.
2. Persists the data to `./<NAMESPACE>.json`
3. Optionally backs up the data via FTP on a predefined interval (default: 20 seconds if changed)

## Installation

`npm i -s sync-via-ftp`

## Usage

```js
const syncViaFtp = require('sync-via-ftp');

// Creates a global postData object that syncs to postData.json 
// & to a remote FTP server
syncViaFtp('postData');

// You now have a global object in the `postData` namespace which you can do anything with.
// It will persist data on a fixed interval, to the local disk, and optionally to and from FTP.
// Just don't re-declare the type (it needs to remain an object)

// Manipulate the postData object to add a posts array
if (!postData.posts) postData.posts = [];

// Add a new post to the postData object
postData.posts.push({
    name: "Post title",
    date: (+ new Date()),
    body: 'Hello world'
});

// Get posts
postData.posts.forEach(post => {
  console.log(post.name, post.body);
});
```

## Optional assignment
If you've enabled a linter you may appreciate the optional assignment to the value you will be reading and writing to/from. This may help with code readability as well.

```js
const syncViaFtp = require('sync-via-ftp');

let postData = syncViaFtp('postData'); // postData will be assigned {} immediately after invocation, and then updated to match the synced values, when available

// Alternatively
global.postData = syncViaFtp('postData'); // Lets other collaborators know this is assigned to the global namespace
```

## Passing a custom configuration with a custom persistence interval

```js
const syncViaFtp = require('sync-via-ftp');

global.postData = syncViaFtp('postData', { interval: 10 });
```

## Use a custom callback

This will be executed each time data is read to memory (once when reading from a local file, and again if updated from a remote FTP server)

```js
const syncViaFtp = require('sync-via-ftp');

global.postData = syncViaFtp('postData', { interval: 10 }, namespace => {
    console.log('Updated global.${ namespace } from ./${ namespace }.json')
});

// -> Updated global.postData from ./postData.json
```

## Enabling FTP sync via environment variables

Here is an empty `.env` template for enabling FTP sync.

```
FTP_HOST=''
FTP_USER=''
FTP_PASS=''
```

## Usage with LowDb

You can use sync-via-ftp in conjunction with LowDb (https://github.com/typicode/lowdb) for a simple, persistent database. 

Useful for tiny apps.

```js
const FileSync = require('lowdb/adapters/FileSync');
const syncViaFtp = require('sync-via-ftp');
const low = require('lowdb');

const adapter = new FileSync('dbStore.json');
let db = low(adapter);

syncViaFtp('dbStore', { interval: 10 }, namespace => {
    db = low(adapter); // Re-initialized lowDb with updated data
});

// dbStore will be a side-effect of calling syncViaFtp -- which you should not access directly. 

db.defaults({ posts: [] })
  .write();

const result = db.get('posts')
  .push({ title: process.argv[2] })
  .write();

console.log(result);
```

## Module Lifecycle

1. Upon invoking `global.postData = syncViaFtp('postData');`, postData will immediately be assigned with an empty object (or the current state of `global[namespace]`)
2. `syncViaFtp` will attempt to read `./postData.json` and assign the contents to `global.postData`.
3. If a callback has been passed to `syncViaFtp` as its third parameter, it will be executed.
4. If `FTP_HOST, FTP_USER, & FTP_PASS` are present in `process.env`, `syncViaFtp()` will connect to the FTP server and attempt to retrieve `postData.json`.
5. `postData.json` will be downloaded to overwrite `./postData.json`.
6. `syncViaFtp` will attempt to read `./postData.json` and assign the contents to `global.postData`.
7. If a callback has been passed to `syncViaFtp` as its third parameter, it will be executed.
8. Every 20 seconds (or an interval declared in `config`), the contents of `global.postData` will be written to disk as `./postData.json`.
9. If `FTP_HOST, FTP_USER, & FTP_PASS` are present, `syncViaFtp()` will connect to the FTP server and attempt to write the contents of `global.postData` to the remote server.
