/* globals -Promise */
var Promise = require('es6-promise').Promise;
var expect = require('chai').expect;
var request = require('../lib');
var idb = global.indexedDB || global.webkitIndexedDB;
var isPolyfill = false;

// enable WebSQL polyfill
if (!idb) {
  require('./support/indexeddb-shim');
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

  beforeEach(function(done) {
    var req = idb.open(dbName, 3);
    req.onblocked = function onblocked(e) { console.log('create blocked: %j', e); };
    req.onupgradeneeded = onupgradeneeded;
    return request(req).then(function(origin) { db = origin; done(); });

    function onupgradeneeded(e) {
      var oldVersion = e.oldVersion > (Math.pow(2, 32) - 1) ? 0 : e.oldVersion; // Safari bug
      var db = e.target.result;
      var tr = e.target.transaction;

      if (oldVersion < 1) {
        db.createObjectStore('books', { keyPath: 'isbn' });
        tr.objectStore('books').createIndex('byTitle', 'title', { unique: true });
        tr.objectStore('books').createIndex('byAuthor', 'author');
      }
      if (oldVersion < 2) {
        tr.objectStore('books').createIndex('byYear', 'year');
      }
      if (oldVersion < 3) {
        db.createObjectStore('magazines', { autoIncrement: true, keyPath: 'id' });
        tr.objectStore('magazines').createIndex('byPublisher', 'publisher');
        tr.objectStore('magazines').createIndex('byFrequency', 'frequency');
      }
    }
  });

  afterEach(function(done) {
    db.close(); // Safari/WebSQLPolyfill does not handle onversionchange
    setTimeout(function() {
      var req = idb.deleteDatabase(db.name);
      req.onblocked = function onblocked(e) { console.log('delete blocked: %j', e); };
      request(req).then(function() { done(); });
    }, 50);
  });

  it('request(db)', function() {
    expect(db.name).equal(dbName);
    expect(db.version).equal(3);
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

  if (isPolyfill) return; // ignore
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
