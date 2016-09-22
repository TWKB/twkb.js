var constants = require('./constants')
var ReadVarInt64 = require('./protobuf').ReadVarInt64
var ReadVarSInt64 = require('./protobuf').ReadVarSInt64
var unzigzag = require('./protobuf').unzigzag

function readBuffer (ta_struct, howMany) {
  var flag
  var has_z = 0
  var has_m = 0

  // geometry type and precision header
  flag = ta_struct.buffer[ta_struct.cursor]
  ta_struct.cursor++

  var precision_xy = unzigzag((flag & 0xF0) >> 4)
  ta_struct.type = flag & 0x0F
  ta_struct.factors = []
  ta_struct.factors[0] = ta_struct.factors[1] = Math.pow(10, precision_xy)

  // Metadata header
  flag = ta_struct.buffer[ta_struct.cursor]
  ta_struct.cursor++

  ta_struct.has_bbox = flag & 0x01
  ta_struct.has_size = (flag & 0x02) >> 1
  ta_struct.has_idlist = (flag & 0x04) >> 2
  ta_struct.is_empty = (flag & 0x10) >> 4
  var extended_dims = (flag & 0x08) >> 3

  // the geometry has Z and/or M coordinates
  if (extended_dims) {
    var extended_dims_flag = ta_struct.buffer[ta_struct.cursor]
    ta_struct.cursor++

    // Strip Z/M presence and precision from ext byte
    has_z = (extended_dims_flag & 0x01)
    has_m = (extended_dims_flag & 0x02) >> 1
    var precision_z = (extended_dims_flag & 0x1C) >> 2
    var precision_m = (extended_dims_flag & 0xE0) >> 5

    // Convert the precision into factor
    if (has_z) {
      ta_struct.factors[2] = Math.pow(10, precision_z)
    }
    if (has_m) {
      ta_struct.factors[2 + has_z] = Math.pow(10, precision_m)
    }
    // store in the struct
    ta_struct.has_z = has_z
    ta_struct.has_m = has_m
  }

  var ndims = 2 + has_z + has_m
  ta_struct.ndims = ndims

  // read the total size in bytes
  // The value is the size in bytes of the remainder of the geometry after the size attribute.
  if (ta_struct.has_size) {
    ta_struct.size = ReadVarInt64(ta_struct)
  }

  if (ta_struct.has_bbox) {
    var bbox = []
    for (var i = 0; i <= ndims - 1; i++) {
      var min = ReadVarSInt64(ta_struct)
      var max = min + ReadVarSInt64(ta_struct)
      bbox[i] = min
      bbox[i + ndims] = max
    }
    ta_struct.bbox = bbox
  }

  return readObjects(ta_struct, howMany)
}

function readObjects (ta_struct, howMany) {
  var type = ta_struct.type

  // TWKB variable will carry the last refpoint in a pointarray to the next pointarray. It will hold one value per dimmension
  for (var i = 0; i < ta_struct.ndims; i++) {
    ta_struct.refpoint[i] = 0
  }

  if (type === constants.POINT) {
    return parse_point(ta_struct)
  } else if (type === constants.LINESTRING) {
    return parse_line(ta_struct)
  } else if (type === constants.POLYGON) {
    return parse_polygon(ta_struct)
  } else if (type === constants.MULTIPOINT) {
    return parse_multi(ta_struct, parse_point)
  } else if (type === constants.MULTILINESTRING) {
    return parse_multi(ta_struct, parse_line)
  } else if (type === constants.MULTIPOLYGON) {
    return parse_multi(ta_struct, parse_polygon)
  } else if (type === constants.COLLECTION) {
    return parse_collection(ta_struct, howMany)
  } else {
    throw new Error('Unknown type: ' + type)
  }
}

function parse_point (ta_struct) {
  return read_pa(ta_struct, 1)
}

function parse_line (ta_struct) {
  var npoints = ReadVarInt64(ta_struct)
  return read_pa(ta_struct, npoints)
}

function parse_polygon (ta_struct) {
  var coordinates = []
  var nrings = ReadVarInt64(ta_struct)
  for (var ring = 0; ring < nrings; ++ring) {
    coordinates[ring] = parse_line(ta_struct)
  }
  return coordinates
}

function parse_multi (ta_struct, parser) {
  var type = ta_struct.type
  var ngeoms = ReadVarInt64(ta_struct)
  var geoms = []
  var IDlist = []
  if (ta_struct.has_idlist) {
    IDlist = readIDlist(ta_struct, ngeoms)
  }
  for (var i = 0; i < ngeoms; i++) {
    var geo = parser(ta_struct)
    geoms.push(geo)
  }
  return {
    type: type,
    ids: IDlist,
    geoms: geoms
  }
}

// TODO: share code with parse_multi
function parse_collection (ta_struct, howMany) {
  var type = ta_struct.type
  var ngeoms = ReadVarInt64(ta_struct)
  var geoms = []
  var IDlist = []
  if (ta_struct.has_idlist) {
    IDlist = readIDlist(ta_struct, ngeoms)
  }
  for (var i = 0; i < ngeoms && i < howMany; i++) {
    var geo = readBuffer(ta_struct)
    geoms.push({
      type: ta_struct.type,
      coordinates: geo
    })
  }
  return {
    type: type,
    ids: IDlist,
    ndims: ta_struct.ndims,
    offset: howMany < Number.MAX_VALUE ? ta_struct.cursor : undefined,
    geoms: geoms
  }
}

function read_pa (ta_struct, npoints) {
  var i, j
  var ndims = ta_struct.ndims
  var factors = ta_struct.factors
  var coords = new Array(npoints * ndims)

  for (i = 0; i < npoints; i++) {
    for (j = 0; j < ndims; j++) {
      ta_struct.refpoint[j] += ReadVarSInt64(ta_struct)
      coords[ndims * i + j] = ta_struct.refpoint[j] / factors[j]
    }
  }

  // calculates the bbox if it hasn't it
  if (ta_struct.include_bbox && !ta_struct.has_bbox) {
    for (i = 0; i < npoints; i++) {
      for (j = 0; j < ndims; j++) {
        var c = coords[j * ndims + i]
        if (c < ta_struct.bbox.min[j]) {
          ta_struct.bbox.min[j] = c
        }
        if (c > ta_struct.bbox.max[j]) {
          ta_struct.bbox.max[j] = c
        }
      }
    }
  }
  return coords
}

function readIDlist (ta_struct, n) {
  var idList = []
  for (var i = 0; i < n; i++) {
    idList.push(ReadVarSInt64(ta_struct))
  }
  return idList
}

module.exports = readBuffer
