# idb-request

Transform IDBRequest to Promise

## Example

```js
var request = require('idb-request');

// pass regular IDBRequest
var req = window.indexedDB.open('mydb', 1);
request(req).then(function(db) {});

// create request and wait transaction to complete
var tr = db.transaction(['stores'], 'readwrite');
var stores = tr.objectStore('stores');
var req = stores.put({ id: 1, title: 'Store 1' });
request(req, tr).then(function() {});

// reuse transaction
Promise.all([
  request(stores.put({ id: 1, title: 'Book 1' })),
  request(stores.put({ id: 2, title: 'Book 2' })),
  request(stores.put({ id: 3, title: 'Book 3' })),
]).then(function() {
  request(tr); // wait transaction to complete
});

// iterate using cursors
var req = stores.openCursor();
var result = []
request(req, function(cursor) {
  result.push(cursor.value);
  cursor.continue();
}).then(function() {});
```

## API
### request(req, [tr])
### request.transaction(tr)
### request.iterator(req, fn)

##

Example using [ES7 async/await syntax](https://github.com/lukehoban/ecmascript-asyncawait),
which you can use today with [6to5](http://6to5.org/):

```js
var request = require('idb-request');
var range = require('idb-range');
var createSchema = require('idb-schema');
var assert = console.assert.bind(console);
var idb = window.indexedDB;

var schema = createSchema()
.version(1)
  .addStore('books', { key: 'isbn' })
  .addIndex('byTitle', 'title', { unique: true })
  .addIndex('byAuthor', 'author')
.version(2)
  .getStore('books')
  .addIndex('byYear', 'year')
.version(3)
  .addStore('magazines')
  .addIndex('byPublisher', 'publisher')
  .addIndex('byFrequency', 'frequency');

async function() {
  // open database
  var req = idb.open('mydb', schema.version());
  req.onupgradeneeded = schema.callback();
  var db = await request(req);

  // write data
  var tr = db.transaction(['books'], 'readwrite');
  var books = tr.objectStore('books');

  // put data in one transaction
  await request(books.put({ id: 1, title: 'Book 1', author: 'Author 1' }));
  await request(books.put({ id: 2, title: 'Book 2', author: 'Author 2' }));
  await request(books.put({ id: 3, title: 'Book 3', author: 'Author 3' }));
  await request(tr); // complete transaction

  // read data
  tr = db.transaction(['books'], 'readonly');
  books = tr.objectStore('books');

  var book1 = await request(books.get(1));
  var book2 = await request(books.get(2));
  var count = await request(books.index('byAuthor').count(range({ gte: 'Author 2' })));

  assert(book1.title == 'Book 1');
  assert(book2.title == 'Book 2');
  assert(count == 2);
}
```
