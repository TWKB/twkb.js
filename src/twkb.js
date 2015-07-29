var constants = require('./constants')
var toGeoJSON = require('./toGeoJSON')
var read = require('./read')

var twkb = {
  toGeoJSON: toGeoJSON,
  read: read
}

for (var key in constants) {
  twkb[key] = constants[key]
}

module.exports = twkb

global.twkb = twkb
