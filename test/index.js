/* globals -Promise */
var Promise = require('es6-promise').Promise;
var expect = require('chai').expect;
var Schema = require('idb-schema');
var request = require('../lib');
var idb = global.indexedDB || global.webkitIndexedDB;
var isPolyfill = false;

// enable WebSQL polyfill
if (!idb) {
  require('treo-websql').polyfill();
  idb = global.indexedDB;
  isPolyfill = true;
}

// force to use a Promise implementation, built on top of microtasks, allowing transaction reuse
// https://stackoverflow.com/questions/28388129/inconsistent-interplay-between-indexeddb-transactions-and-promises
// http://lists.w3.org/Archives/Public/public-webapps/2014AprJun/0811.html
request.Promise = Promise;

describe('idb-request', function() {
  var dbName = 'idb-request1';
  var db;
  var schema = new Schema()
  .version(1)
    .addStore('books', { key: 'isbn' })
    .addIndex('byTitle', 'title', { unique: true })
    .addIndex('byAuthor', 'author')
  .version(2)
    .getStore('books')
    .addIndex('byYear', 'year')
  .version(3)
    .addStore('magazines', { key: 'id', increment: true })
    .addIndex('byPublisher', 'publisher')
    .addIndex('byFrequency', 'frequency');

  beforeEach(function(done) {
    var req = idb.open(dbName, schema.version());
    req.onupgradeneeded = schema.callback();
    return request(req)
    .then(function(origin) { db = origin; done() });
  });

  afterEach(function(done) {
    db.close(); // Safari/WebSQLPolyfill does not handle onversionchange
    return timeout().then(function() {
      var req = idb.deleteDatabase(db.name);
      return request(req).then(function() { done() });
    });

    // wrap setTimeout to promise, to handle block errors with mocha
    function timeout() {
      return new Promise(function(resolve) {
        setTimeout(function() { resolve() }, 50);
      });
    }
  });

  it('request(db)', function() {
    expect(db.name).equal(dbName);
    expect(db.version).equal(schema.version());
    expect([].slice.call(db.objectStoreNames)).eql(['books', 'magazines']);
  });

  it('request(req)', function(done) {
    var books = db.transaction(['books'], 'readwrite').objectStore('books');

    return Promise.all([
      request(books.put({ title: 'Quarry Memories', author: 'Fred', isbn: 123456 })),
      request(books.put({ title: 'Water Buffaloes', author: 'Fred', isbn: 234567 })),
      request(books.put({ title: 'Bedrock Nights', author: 'Barney', isbn: 345678 })),
    ]).then(function() {
      if (isPolyfill) books = db.transaction(['books'], 'readwrite').objectStore('books');
      return request(books.count()).then(function(count) {
        expect(count).equal(3);
        done();
      });
    });
  });

  it('request(req, tr)', function(done) {
    var tr = db.transaction(['magazines'], 'readwrite');
    var magazines = tr.objectStore('magazines');
    var req = magazines.put({ name: 'My magazine' });
    return request(req, tr).then(function(id) {
      expect(id).equal(1);
      done();
    });
  });

  it('request(tr)', function(done) {
    var tr = db.transaction(['magazines'], 'readwrite');
    var magazines = tr.objectStore('magazines');

    return Promise.all([
      request(magazines.put({ id: 1, name: 'Magazine 1' })),
      request(magazines.put({ id: 2, name: 'Magazine 2' })),
    ]).then(function() {
      if (isPolyfill) return done();
      return request(tr).then(function() { done(); });
    });
  });

  it('request(cursor, iterator)', function(done) {
    var tr = db.transaction(['books'], 'readwrite');
    var books = tr.objectStore('books');

    return Promise.all([
      request(books.put({ title: 'Quarry Memories', author: 'Fred', isbn: 123456 })),
      request(books.put({ title: 'Water Buffaloes', author: 'Fred', isbn: 234567 })),
      request(books.put({ title: 'Bedrock Nights', author: 'Barney', isbn: 345678 })),
    ]).then(function() {
      if (isPolyfill) books = db.transaction(['books'], 'readwrite').objectStore('books');
      var req = books.openCursor();
      var result = [];
      return request(req, iterator).then(function() {
        expect(result).length(3);
        done();
      });
      function iterator(cursor) {
        result.push(cursor.value);
        cursor.continue();
      }
    });
  });

  // ignore error handling
  if (isPolyfill) return;

  it('handle errors', function(done) {
    return request(idb.open(dbName, 2)).catch(function(err) {
      expect(err.name).equal('VersionError');
      var tr = db.transaction(['books'], 'readwrite');
      var books = tr.objectStore('books');
      return request(books.add({ isbn: 1 })).then(function() {
        return request(books.add({ isbn: 1 })).catch(function(err) {
          expect(err.name).equal('ConstraintError');
          done();
        });
      });
    });
  });
});
