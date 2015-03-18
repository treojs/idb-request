var expect = require('chai').expect;
var request = require('../lib');
var idb = window.indexedDB;

describe('idb-request', function() {
  var db;

  beforeEach(function() {
    var req = idb.open('mydb', 3);
    req.onupgradeneeded = onupgradeneeded;

    return request(req).then(function(origin) {
      db = origin;
      db.onversionchange = function onversionchange() { db.close() };
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

  afterEach(function() {
    var req = idb.deleteDatabase('mydb');
    return request(req);
  });

  it('request(db)', function() {
    expect(db.name).equal('mydb');
    expect(db.version).equal(3);
    expect([].slice.call(db.objectStoreNames)).eql(['books', 'magazines']);
  });

  it('request(req)', function() {
    var tr = db.transaction(['books', 'magazines'], 'readwrite');
    var books = tr.objectStore('books');
    var magazines = tr.objectStore('magazines');

    return Promise.all([
      request(books.put({ title: 'Quarry Memories', author: 'Fred', isbn: 123456 })),
      request(books.put({ title: 'Water Buffaloes', author: 'Fred', isbn: 234567 })),
      request(books.put({ title: 'Bedrock Nights', author: 'Barney', isbn: 345678 })),
      request(magazines.put({ id: 'mykey', name: 'My magazine' })),
    ]).then(function() {
      request(books.count()).then(function(count) {
        expect(count).equal(3);
        return request(magazines.get('mykey')).then(function(val) {
          expect(val).eql({ id: 'mykey', name: 'My magazine' });
        });
      });
    });
  });

  it('request(req, tr)', function() {
    var tr = db.transaction(['magazines'], 'readwrite');
    var magazines = tr.objectStore('magazines');
    var req = magazines.put({ name: 'My magazine' });
    return request(req, tr).then(function(id) {
      expect(id).equal(1);
    });
  });

  it('request(tr)', function() {
    var tr = db.transaction(['magazines'], 'readwrite');
    var magazines = tr.objectStore('magazines');

    return Promise.all([
      request(magazines.put({ id: 1, name: 'Magazine 1' })),
      request(magazines.put({ id: 2, name: 'Magazine 2' })),
    ]).then(function() {
      return request(tr);
    });
  });

  it('request(cursor, iterator)', function() {
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
      });

      function iterator(cursor) {
        result.push(cursor.value);
        cursor.continue();
      }
    });
  });
});
