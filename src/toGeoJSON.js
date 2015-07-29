var constants = require('./constants')
var readBuffer = require('./readBuffer')

var typeMap = {}
typeMap[constants.POINT] = 'Point'
typeMap[constants.LINESTRING] = 'LineString'
typeMap[constants.POLYGON] = 'Polygon'

// Create GeoJSON Geometry object from TWKB type and coordinate array
function createGeometry (type, coordinates) {
  return {
    type: typeMap[type],
    coordinates: coordinates
  }
}

// Create GeoJSON Feature object (intended for TWKB multi-types)
function createFeature (type, coordinates, id, ndims) {
  return {
    type: 'Feature',
    id: id,
    geometry: transforms[type](coordinates, ndims)
  }
}

// Create an array of GeoJSON feature objects
function createFeaturesFromMulti (type, geoms, ids, ndims) {
  return geoms.map(function (coordinates, i) {
    return createFeature(type, coordinates, ids ? ids[i] : undefined, ndims)
  })
}

// Create an array of GeoJSON feature objects
function createFeaturesFromCollection (geoms, ids, ndims) {
  return geoms.map(function (g, i) {
    return createFeature(g.type, g.coordinates, ids ? ids[i] : undefined, ndims)
  })
}

// Map TWKB type to correct transformation function from intermediate representation to GeoJSON object
var transforms = {}
transforms[constants.POINT] = function (coordinates, ndims) {
  return createGeometry(constants.POINT, toCoords(coordinates, ndims)[0])
}
transforms[constants.LINESTRING] = function (coordinates, ndims) {
  return createGeometry(constants.LINESTRING, toCoords(coordinates, ndims))
}
transforms[constants.POLYGON] = function (coordinates, ndims) {
  return createGeometry(constants.POLYGON, coordinates.map(function (c) { return toCoords(c, ndims) }))
}
transforms[constants.MULTIPOINT] = function (geoms, ids, ndims) {
  return createFeaturesFromMulti(constants.POINT, geoms, ids, ndims)
}
transforms[constants.MULTILINESTRING] = function (geoms, ids, ndims) {
  return createFeaturesFromMulti(constants.LINESTRING, geoms, ids, ndims)
}
transforms[constants.MULTIPOLYGON] = function (geoms, ids, ndims) {
  return createFeaturesFromMulti(constants.POLYGON, geoms, ids, ndims)
}
transforms[constants.COLLECTION] = function (geoms, ids, ndims) {
  return createFeaturesFromCollection(geoms, ids, ndims)
}

// TWKB flat coordinates to GeoJSON coordinates
function toCoords (coordinates, ndims) {
  var coords = []
  for (var i = 0, len = coordinates.length; i < len; i += ndims) {
    var pos = []
    for (var c = 0; c < ndims; ++c) {
      pos.push(coordinates[i + c])
    }
    coords.push(pos)
  }
  return coords
}

/**
 * Transform TWKB to GeoJSON FeatureCollection
 * @param {ArrayBuffer|Buffer} buffer Binary buffer containing TWKB data
 */
function toGeoJSON (buffer) {
  var ta_struct = {
    buffer: buffer,
    cursor: 0,
    bufferLength: buffer.byteLength || buffer.length,
    refpoint: new Int32Array(4 /* max dims */)
  }

  var features = []
  while (ta_struct.cursor < ta_struct.bufferLength) {
    var res = readBuffer(ta_struct, Number.MAX_VALUE)
    if (res.geoms) {
      features = features.concat(transforms[res.type](res.geoms, res.ids, ta_struct.ndims))
    } else {
      features.push({ type: 'Feature', geometry: transforms[ta_struct.type](res, ta_struct.ndims) })
    }
  }

  return {
    type: 'FeatureCollection',
    features: features
  }
}

module.exports = toGeoJSON
