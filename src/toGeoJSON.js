var constants = require('./constants');
var readBuffer = require('./readBuffer');
var eof = require('./readBuffer');

var typeMap = {};
typeMap[constants.POINT] = 'Point';
typeMap[constants.LINESTRING] = 'LineString';
typeMap[constants.POLYGON] = 'Polygon';

function createGeometry(type, coordinates) {
  return {
    type: typeMap[type],
    coordinates: coordinates
  };
};

function createFeature(type, ta_struct, g, i) {
  return {
    type: "Feature",
    id: ta_struct.has_idlist ? ta_struct.res.ids[i] : undefined,
    geometry: transforms[type]({res: g, ndims: ta_struct.ndims})
  };
};

function createMultiTransform(type, ta_struct) {
  // TODO: consider howMany
  return ta_struct.res.geoms.map(function(g, i) {
    return createFeature(type, ta_struct, g, i);
  });
};

var transforms = {};
transforms[constants.POINT] = function(ta_struct) {
  return createGeometry(constants.POINT, toCoords(ta_struct.res, ta_struct.ndims)[0]);
};
transforms[constants.LINESTRING] = function(ta_struct) {
  return createGeometry(constants.LINESTRING, toCoords(ta_struct.res, ta_struct.ndims));
};
transforms[constants.POLYGON] = function(ta_struct) {
  return createGeometry(constants.POLYGON, ta_struct.res.map(function(c) {
    return toCoords(c, ta_struct.ndims);
  }));
};
transforms[constants.MULTIPOINT] = function(ta_struct) {
  return createMultiTransform(constants.POINT, ta_struct);
};
transforms[constants.MULTILINESTRING] = function(ta_struct) {
  return createMultiTransform(constants.LINESTRING, ta_struct);
};
transforms[constants.MULTIPOLYGON] = function(ta_struct) {
  return createMultiTransform(constants.POLYGON, ta_struct);
};

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
    readBuffer(ta_struct);
    if (ta_struct.res.geoms) {
      features = features.concat(transforms[ta_struct.type](ta_struct));
    } else {
      features.push({ type: "Feature", geometry: transforms[ta_struct.type](ta_struct) });
    }
  }
  
  return {
    type: 'FeatureCollection',
    features: features
  };
}

module.exports = toGeoJSON;
