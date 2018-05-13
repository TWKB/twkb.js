import { POINT, LINESTRING, POLYGON, MULTIPOINT, MULTILINESTRING, MULTIPOLYGON, COLLECTION, MAX } from '../src/constants'
import { readVarInt64, readVarSInt64, unzigzag } from './protobuf'
import { unknownType } from './errors'

export default function readBuffer (ta_struct, howMany) {
  let flag
  let has_z = 0
  let has_m = 0

  // geometry type and precision header
  flag = ta_struct.buffer[ta_struct.cursor]
  ta_struct.cursor++

  const precision_xy = unzigzag((flag & 0xF0) >> 4)
  ta_struct.type = flag & 0x0F
  ta_struct.factors = []
  ta_struct.factors[0] = ta_struct.factors[1] = Math.pow(10, precision_xy)

  // metadata header
  flag = ta_struct.buffer[ta_struct.cursor]
  ta_struct.cursor++

  ta_struct.has_bbox = flag & 0x01
  ta_struct.has_size = (flag & 0x02) >> 1
  ta_struct.has_idlist = (flag & 0x04) >> 2
  ta_struct.is_empty = (flag & 0x10) >> 4
  const extended_dims = (flag & 0x08) >> 3

  // the geometry has Z and/or M coordinates
  if (extended_dims) {
    const extended_dims_flag = ta_struct.buffer[ta_struct.cursor]
    ta_struct.cursor++

    // strip Z/M presence and precision from ext byte
    has_z = (extended_dims_flag & 0x01)
    has_m = (extended_dims_flag & 0x02) >> 1
    const precision_z = (extended_dims_flag & 0x1C) >> 2
    const precision_m = (extended_dims_flag & 0xE0) >> 5

    // convert the precision into factor
    if (has_z)
      ta_struct.factors[2] = Math.pow(10, precision_z)
    if (has_m) 
      ta_struct.factors[2 + has_z] = Math.pow(10, precision_m)
    // store in the struct
    ta_struct.has_z = has_z
    ta_struct.has_m = has_m
  }

  const ndims = 2 + has_z + has_m
  ta_struct.ndims = ndims

  // read the total size in bytes
  // the value is the size in bytes of the remainder of the geometry after the size attribute.
  if (ta_struct.has_size)
    ta_struct.size = readVarInt64(ta_struct)

  if (ta_struct.has_bbox) {
    const bbox = []
    for (let i = 0; i <= ndims - 1; i++) {
      const min = readVarSInt64(ta_struct)
      const max = min + readVarSInt64(ta_struct)
      bbox[i] = min
      bbox[i + ndims] = max
    }
    ta_struct.bbox = bbox
  }

  return readObjects(ta_struct, howMany)
}

function readObjects (ta_struct, howMany) {
  const type = ta_struct.type

  // ta_struct carries the last refpoint in a pointarray to the next pointarray.
  // it will hold one value per dimmension
  for (let i = 0; i < ta_struct.ndims; i++)
    ta_struct.refpoint[i] = 0

  if (type === POINT)
    return parse_point(ta_struct)
  else if (type === LINESTRING)
    return parse_line(ta_struct)
  else if (type === POLYGON)
    return parse_polygon(ta_struct)
  else if (type === MULTIPOINT)
    return parse_multi(ta_struct, parse_point)
  else if (type === MULTILINESTRING)
    return parse_multi(ta_struct, parse_line)
  else if (type === MULTIPOLYGON)
    return parse_multi(ta_struct, parse_polygon)
  else if (type === COLLECTION)
    return parse_collection(ta_struct, howMany)
  else
    unknownType(type)
}

function parse_point (ta_struct) {
  return read_pa(ta_struct, 1)
}

function parse_line (ta_struct) {
  const npoints = readVarInt64(ta_struct)
  return read_pa(ta_struct, npoints)
}

function parse_polygon (ta_struct) {
  const coordinates = []
  const nrings = readVarInt64(ta_struct)
  for (let ring = 0; ring < nrings; ++ring)
    coordinates[ring] = parse_line(ta_struct)
  return coordinates
}

function parse_multi (ta_struct, parser) {
  const type = ta_struct.type
  const ngeoms = readVarInt64(ta_struct)
  const geoms = []
  const ids = readIDlist(ta_struct, ngeoms)
  for (let i = 0; i < ngeoms; i++)
    geoms.push(parser(ta_struct))
  return {
    type,
    ids,
    geoms
  }
}

// TODO: share code with parse_multi
function parse_collection (ta_struct, howMany) {
  const ndims = ta_struct.ndims
  const ngeoms = readVarInt64(ta_struct)
  const geoms = []
  const ids = readIDlist(ta_struct, ngeoms)
  for (let i = 0; i < ngeoms && i < howMany; i++) {
    const coordinates = readBuffer(ta_struct)
    const type = ta_struct.type
    geoms.push({
      type,
      coordinates
    })
  }
  return {
    type: COLLECTION,
    ids,
    ndims,
    offset: howMany < MAX ? ta_struct.cursor : undefined,
    geoms
  }
}

function read_pa (ta_struct, npoints) {
  let i, j
  const ndims = ta_struct.ndims
  const factors = ta_struct.factors
  const coords = new Array(npoints * ndims)

  for (i = 0; i < npoints; i++) {
    for (j = 0; j < ndims; j++) {
      ta_struct.refpoint[j] += readVarSInt64(ta_struct)
      coords[ndims * i + j] = ta_struct.refpoint[j] / factors[j]
    }
  }

  // calculates the bbox if it hasn't it
  if (ta_struct.include_bbox && !ta_struct.has_bbox) {
    for (i = 0; i < npoints; i++) {
      for (j = 0; j < ndims; j++) {
        const c = coords[j * ndims + i]
        if (c < ta_struct.bbox.min[j])
          ta_struct.bbox.min[j] = c
        if (c > ta_struct.bbox.max[j])
          ta_struct.bbox.max[j] = c
      }
    }
  }
  return coords
}

function readIDlist (ta_struct, n) {
  const idList = []
  if (ta_struct.has_idlist)
    for (let i = 0; i < n; i++)
      idList.push(readVarSInt64(ta_struct))
  return idList
}
