/* globals -Promise */
var Promise = require('bluebird');
var expect = require('chai').expect;
var request = require('../lib');
var idb = global.indexedDB || global.webkitIndexedDB;

// force to use bluebird's Promise implementation, because
// it builds on top of microtasks and allows transaction reuse
// https://stackoverflow.com/questions/28388129/inconsistent-interplay-between-indexeddb-transactions-and-promises
// http://lists.w3.org/Archives/Public/public-webapps/2014AprJun/0811.html
request.Promise = Promise;

describe('idb-request', function() {
  var db;

  beforeEach(function createDb(done) {
    var req = idb.open('mydb', 3);
    req.onupgradeneeded = onupgradeneeded;
    req.onblocked = function onblocked(e) { console.log('open blocked:' + e) };
    return request(req).then(function(origin) {
      db = origin;
      db.onversionchange = function onversionchange() { db.close() };
      done();
    });

    function onupgradeneeded(e) {
      var db = e.target.result;
      var tr = e.target.transaction;

      if (e.oldVersion < 1) {
        var books = db.createObjectStore('books', { keyPath: 'isbn' });
        books.createIndex('byTitle', 'title', { unique: true });
        books.createIndex('byAuthor', 'author');
      }
      if (e.oldVersion < 2) {
        tr.objectStore('books').createIndex('by_year', 'year');
      }
      if (e.oldVersion < 3) {
        var magazines = db.createObjectStore('magazines', { autoIncrement: true, keyPath: 'id' });
        magazines.createIndex('by_publisher', 'publisher');
        magazines.createIndex('by_frequency', 'frequency');
      }
    }
  });

  afterEach(function deleteDb(done) {
    var req = idb.deleteDatabase('mydb');
    req.onblocked = function onblocked(e) { console.log('drop blocked:' + e) };
    return request(req).then(function() { done() });
  });

  it('request(db)', function() {
    expect(db.name).equal('mydb');
    expect(db.version).equal(3);
    expect([].slice.call(db.objectStoreNames)).eql(['books', 'magazines']);
  });

  it('request(req)', function(done) {
    var tr = db.transaction(['books', 'magazines'], 'readwrite');
    var books = tr.objectStore('books');
    var magazines = tr.objectStore('magazines');

    return Promise.all([
      request(books.put({ title: 'Quarry Memories', author: 'Fred', isbn: 123456 })),
      request(books.put({ title: 'Water Buffaloes', author: 'Fred', isbn: 234567 })),
      request(books.put({ title: 'Bedrock Nights', author: 'Barney', isbn: 345678 })),
      request(magazines.put({ id: 'mykey', name: 'My magazine' })),
    ]).then(function() {
      return request(books.count()).then(function(count) {
        expect(count).equal(3);
        return request(magazines.get('mykey')).then(function(val) {
          expect(val).eql({ id: 'mykey', name: 'My magazine' });
          done();
        });
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
      return request(tr).then(function() { done() });
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

  it('handle errors', function(done) {
    return request(idb.open('mydb', 2)).catch(function(err) {
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
