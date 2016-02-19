## 3.2.0 / 2016-02-19

* add `stop()` callback support to `requestCursor()` and `mapCursor()`

## 3.1.0 / 2016-01-19

* add `mapCursor` method
* fix [IndexedDBShim#204 issue](https://github.com/axemclion/IndexedDBShim/issues/204) when iterate over indexes

## 3.0.0 / 2015-11-28

* drop support for `onblocked` callback. It is not an error and should handle differently.
  Use [idb-factory](https://github.com/treojs/idb-factory) to open/delete database.
* update docs & zuul configuration

## 2.0.0 / 2015-11-22

* instead of one function it exports 3 for different purposes:
  `request(req, [tr])`, `requestTransaction(tr)`, `requestCursor(req, iterator)`
* remove `request.Promise` and rely on globally available, since it's a standart now
* full rewrite on ES6
* add zuul + saucelabs integration
* use eslint to validate code style
* update docs

## 1.1.2 / 2015-05-01

* code style improvements
* update docs

## 1.1.1 / 2015-04-30

* support [indexeddbshim](https://github.com/axemclion/IndexedDBShim)

## 1.1.0 / 2015-04-10

* support `req.onblocked` to reject Promise
* update docs

## 1.0.0 / 2015-04-09

* fix tests in Safari/Firefox/Phantomjs
* update docs

## 0.0.1 / 2015-03-31

* initial demo release :sparkles:
