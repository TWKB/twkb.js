var constants = require('./constants');
var readBuffer = require('./readBuffer');

var typeMap = {};
typeMap[constants.POINT] = 'Point';
typeMap[constants.LINESTRING] = 'LineString';
typeMap[constants.POLYGON] = 'Polygon';

// Create GeoJSON Geometry object from TWKB type and coordinate array
function createGeometry(type, coordinates) {
  return {
    type: typeMap[type],
    coordinates: coordinates
  };
};

// Create GeoJSON Feature object (intended for TWKB multi-types)
function createFeature(type, coordinates, id, ndims) {
  return {
    type: "Feature",
    id: id,
    geometry: transforms[type](coordinates, ndims)
  };
};

// Create an array of GeoJSON feature objects
function createFeatures(type, geoms, ids, ndims) {
  // TODO: consider howMany
  return geoms.map(function(g, i) {
    return createFeature(type, g, ids ? ids[i] : undefined, ndims);
  });
};

// Functions that map from intermediate representation to GeoJSON object
var transforms = {};
transforms[constants.POINT] = function(coordinates, ndims) {
  return createGeometry(constants.POINT, toCoords(coordinates, ndims)[0]);
};
transforms[constants.LINESTRING] = function(coordinates, ndims) {
  return createGeometry(constants.LINESTRING, toCoords(coordinates, ndims));
};
transforms[constants.POLYGON] = function(coordinates, ndims) {
  return createGeometry(constants.POLYGON, coordinates.map(function(c) {
    return toCoords(c, ndims);
  }));
};
transforms[constants.MULTIPOINT] = function(geoms, ids, ndims) {
  return createFeatures(constants.POINT, geoms, ids, ndims);
};
transforms[constants.MULTILINESTRING] = function(geoms, ids, ndims) {
  return createFeatures(constants.LINESTRING, geoms, ids, ndims);
};
transforms[constants.MULTIPOLYGON] = function(geoms, ids, ndims) {
  return createFeatures(constants.POLYGON, geoms, ids, ndims);
};
transforms[constants.COLLECTION] = function(ta_struct) {
  console.log(ta_struct);
};

// TWKB Float32Array coordinates to GeoJSON coordinates
function toCoords(coordinates, ndims) {
  var coords = []
  for (var i = 0, len = coordinates.length; i < len; i += ndims) {
    var pos = []
    for (var c = 0; c < ndims; ++c) {
      pos.push(coordinates[i + c])
    }
    coords.push(pos);
  }
  return coords;
}

/**
 * Transform TWKB to GeoJSON FeatureCollection
 * @param {ArrayBuffer} buffer Binary buffer containing TWKB data
 * @param {number} startOffset Byte offset to start reading the binary buffer
 * @param {number} howMany Stop translation after this many features
 */
function toGeoJSON(buffer, startOffset, howMany) {
  var ta_struct = {
    buffer: buffer,
    cursor: startOffset === undefined ? 0 : startOffset,
    bufferLength: buffer.byteLength,
    refpoint: new Int32Array(4 /* max dims */)
  };
    
  var features = [];
  while (ta_struct.cursor < ta_struct.bufferLength) {
    var res = readBuffer(ta_struct);
    //console.log(ta_struct);
    if (res.geoms) {
      features = features.concat(transforms[ta_struct.type](res.geoms, res.ids, ta_struct.ndims));
    } else {
      features.push({ type: "Feature", geometry: transforms[ta_struct.type](res, ta_struct.ndims) });
    }
  }
  
  return {
    type: 'FeatureCollection',
    features: features
  };
}

module.exports = toGeoJSON;
