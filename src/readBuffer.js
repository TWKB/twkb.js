var constants = require('./constants');

var ReadVarInt64 = require('./protobuf').ReadVarInt64;
var ReadVarSInt64 = require('./protobuf').ReadVarSInt64;
var unzigzag = require('./protobuf').unzigzag;

function readBuffer(ta_struct) {
  var flag;
  var has_z = 0;
  var has_m = 0;

  // geometry type and precision header
  flag = ta_struct.buffer[ta_struct.cursor];
  ta_struct.cursor++;

  var precision_xy = unzigzag((flag & 0xF0) >> 4);
  ta_struct.type = flag & 0x0F;
  ta_struct.factors = [];
  ta_struct.factors[0] = ta_struct.factors[1] =  Math.pow(10, precision_xy);

  // Metadata header
  flag = ta_struct.buffer[ta_struct.cursor];
  ta_struct.cursor++;

  ta_struct.has_bbox = flag & 0x01;
  ta_struct.has_size = (flag & 0x02) >> 1;
  ta_struct.has_idlist = (flag & 0x04) >> 2;
  ta_struct.is_empty = (flag & 0x10) >> 4;
  var extended_dims = (flag & 0x08) >> 3;

  // the geometry has Z and/or M coordinates
  if (extended_dims) {
    var extended_dims_flag = ta_struct.buffer[ta_struct.cursor];
    ta_struct.cursor++;

    // Strip Z/M presence and precision from ext byte 
    has_z = (extended_dims_flag & 0x01);
    has_m = (extended_dims_flag & 0x02) >> 1;
    var precision_z = (extended_dims_flag & 0x1C) >> 2;
    var precision_m = (extended_dims_flag & 0xE0) >> 5;

    // Convert the precision into factor 
    if (has_z) {
      ta_struct.factors[2] = Math.pow(10, precision_z);
    }
    if (has_m) {
       ta_struct.factors[2 + has_z] = Math.pow(10, precision_m);
    }
    // store in the struct
    ta_struct.has_z = has_z;
    ta_struct.has_m = has_m;
  }

  ta_struct.ndims = 2 + has_z + has_m;

  // read the total size in bytes
  // The value is the size in bytes of the remainder of the geometry after the size attribute.
  if (ta_struct.has_size) {
    ta_struct.size = ReadVarInt64(ta_struct);
  }

  // bounding box in the format [xmin, deltax, ymin, deltay, zmin, deltaz]
  ta_struct.bbox = {};
  if (ta_struct.has_bbox) {
    ta_struct.bbox.min = [];
    ta_struct.bbox.max = [];
    for (var j = 0; j < ta_struct.ndims; j++) {
      ta_struct.bbox.min[j] = ReadVarSInt64(ta_struct)
      ta_struct.bbox.max[j] = ReadVarSInt64(ta_struct) + ta_struct.bbox.min[j];
    }
  } else {
    ta_struct.bbox.min = [constants.MAX_VALUE,constants.MAX_VALUE,constants.MAX_VALUE,constants.MAX_VALUE];
    ta_struct.bbox.max = [constants.MIN_VALUE,constants.MIN_VALUE,constants.MIN_VALUE,constants.MIN_VALUE];
  }

  return readGeometry(ta_struct);
}

function readGeometry(ta_struct) {
  var type = ta_struct.type;
  // TWKB variable will carry the last refpoint in a pointarray to the next pointarray. It will hold one value per dimmension
  for (var i = 0; i < ta_struct.ndims; i++) {
    ta_struct.refpoint[i] = 0;
  }
  // read the geometry
  var res;
  if (type === constants.POINT) {
    res = parse_point(ta_struct)
  } else if(type === constants.LINESTRING) {
    res = parse_line(ta_struct)
  } else if(type === constants.POLYGON) {
    res = parse_polygon(ta_struct)
  } else if(type === constants.MULTIPOINT) {
    res = parse_multi(ta_struct, parse_point);
  } else if(type === constants.MULTILINESTRING) {
    res = parse_multi(ta_struct, parse_line);
  } else if(type === constants.MULTIPOLYGON) {
    res = parse_multi(ta_struct, parse_polygon);
  } else if(type === constants.COLLECTION) {
    res = parse_collection(ta_struct, readBuffer);
  } else {
    throw new Error("Unknown type: " + type);
  }
  
  return res;
}

function parse_point(ta_struct) {
  return read_pa(ta_struct, 1);
}

function parse_line(ta_struct) {
  var npoints = ReadVarInt64(ta_struct);
  return read_pa(ta_struct, npoints);
}

function parse_polygon(ta_struct) {
  var coordinates = [];
  var nrings = ReadVarInt64(ta_struct);
  for (var ring = 0; ring < nrings; ++ring) {
    coordinates[ring] = parse_line(ta_struct);
  }
  return coordinates;
}

function parse_multi(ta_struct, parser) {
  var ngeoms = ReadVarInt64(ta_struct);
  var geoms = [];
  var IDlist = []
  if (ta_struct.has_idlist) {
    IDlist = readIDlist(ta_struct, ngeoms);
  }
  for (var i = 0; i < ngeoms; i++) {
    var geo = parser(ta_struct);
    geoms.push(geo);
  }
  return {
    ids: IDlist,
    geoms: geoms
  }
}

// TODO: share code with parse_multi
function parse_collection(ta_struct) {
  var ngeoms = ReadVarInt64(ta_struct);
  var geoms = [];
  var IDlist = []
  if (ta_struct.has_idlist) {
    IDlist = readIDlist(ta_struct, ngeoms);
  }
  for (var i = 0; i < ngeoms; i++) {
    var geo = readBuffer(ta_struct);
    geoms.push({
      type: ta_struct.type,
      ndims: ta_struct.ndims,
      coordinates: geo
    });
  }
  return {
    collection: true,
    ids: IDlist,
    geoms: geoms
  }
}

function read_pa(ta_struct, npoints) {
  var i, j;
  var ndims = ta_struct.ndims;
  var factors = ta_struct.factors;
  var coords = new Float32Array(npoints * ndims);

  for (i = 0; i < npoints; i++) {
    for (j = 0; j < ndims; j++) {
      ta_struct.refpoint[j] += ReadVarSInt64(ta_struct);
      coords[ndims * i + j] = ta_struct.refpoint[j]/factors[j];
    }
  }

  // calculates the bbox if it hasn't it
  if(ta_struct.include_bbox && !ta_struct.has_bbox) {
    for (i = 0; i < npoints; i++) {
      for (j = 0; j < ndims; j++) { 
        var c  = coords[j * ndims + i]
        if(c < ta_struct.bbox.min[j]) {
          ta_struct.bbox.min[j] = c;
        }
        if(c > ta_struct.bbox.max[j]) {
          ta_struct.bbox.max[j] = c;
        }
      }
    }
  }
  return coords;
}

function readIDlist(ta_struct, n) {
  var idList = [];
  for (var i = 0; i < n; i++) {
    idList.push(ReadVarSInt64(ta_struct));
  }
  return idList;
}

module.exports = readBuffer;
