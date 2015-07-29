var readBuffer = require('./readBuffer')

/**
 * Read TWKB to object representation
 * @param {ArrayBuffer} buffer Binary buffer containing TWKB data
 * @param {number} startOffset Byte offset to start reading the binary buffer
 * @param {number} howMany Stop translation after this many objects
 */
function read (buffer, startOffset, howMany) {
  howMany = howMany || Number.MAX_VALUE

  var ta_struct = {
    buffer: buffer,
    cursor: startOffset === undefined ? 0 : startOffset,
    bufferLength: buffer.byteLength,
    refpoint: new Int32Array(4 /* max dims */)
  }

  var data = []
  var c = 0
  while (ta_struct.cursor < ta_struct.bufferLength && c < howMany) {
    var res = readBuffer(ta_struct, howMany)
    if (res.length > 0) {
      // single geom type, add type info
      data.push({
        type: ta_struct.type,
        offset: howMany < Number.MAX_VALUE ? ta_struct.cursor : undefined,
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

exports.read = read
