import readBuffer from './readBuffer'
import { MAX } from './constants'

/**
 * Read TWKB to object representation
 * @param {ArrayBuffer} buffer Binary buffer containing TWKB data
 * @param {number} offset Byte offset to start reading the binary buffer
 * @param {number} limit Stop translation after this many objects
 */
export default function read (buffer, offset, limit) {
  limit = limit || MAX

  const ta_struct = {
    buffer: buffer,
    cursor: offset === undefined ? 0 : offset,
    bufferLength: buffer.byteLength || buffer.length,
    refpoint: new Int32Array(4 /* max dims */)
  }

  const data = []
  let c = 0
  while (ta_struct.cursor < ta_struct.bufferLength && c < limit) {
    const res = readBuffer(ta_struct, limit)
    if (res.length > 0) {
      // single geom type, add type info
      data.push({
        type: ta_struct.type,
        offset: limit < MAX ? ta_struct.cursor : undefined,
        bbox: ta_struct.has_bbox ? ta_struct.bbox : undefined,
        coordinates: res
      })
    } else {
      res.bbox = ta_struct.has_bbox ? ta_struct.bbox : undefined
      data.push(res)
    }

    c++
  }

  return data
}
