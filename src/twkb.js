var toGeoJSON = require('./toGeoJSON')
var read = require('./read')

var twkb = {
  toGeoJSON: toGeoJSON,
  read: read
}

module.exports = twkb

global.twkb = twkb
