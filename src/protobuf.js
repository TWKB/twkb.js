/**
 * Functions to decode a subset of types from protobuf encoding
 * See https://developers.google.com/protocol-buffers/docs/encoding
 */

function ReadVarInt64 (ta_struct) {
  var cursor = ta_struct.cursor
  var nVal = 0
  var nShift = 0
  var nByte

  while (true) {
    nByte = ta_struct.buffer[cursor]
    if ((nByte & 0x80) === 0) {
      cursor++
      ta_struct.cursor = cursor
      return nVal | (nByte << nShift)
    }
    nVal = nVal | (nByte & 0x7f) << nShift
    cursor++
    nShift += 7
  }
}

function ReadVarSInt64 (ta_struct) {
  var nVal = ReadVarInt64(ta_struct)
  return unzigzag(nVal)
}

function unzigzag (nVal) {
  if ((nVal & 1) === 0) {
    return nVal >> 1
  }
  return -(nVal >> 1) - 1
}

exports.ReadVarInt64 = ReadVarInt64
exports.ReadVarSInt64 = ReadVarSInt64
exports.unzigzag = unzigzag
