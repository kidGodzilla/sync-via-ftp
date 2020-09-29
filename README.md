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

syncViaFtp('dbStore', null, () => {
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
