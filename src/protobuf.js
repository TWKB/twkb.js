/**
 * Functions to decode a subset of types from protobuf encoding
 * See https://developers.google.com/protocol-buffers/docs/encoding
 */

export function readVarInt64 (ta_struct) {
  let cursor = ta_struct.cursor
  let nVal = 0
  let nShift = 0
  let nByte

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

export function readVarSInt64 (ta_struct) {
  const nVal = readVarInt64(ta_struct)
  return unzigzag(nVal)
}

export function unzigzag (nVal) {
  if ((nVal & 1) === 0)
    return nVal >> 1
  return -(nVal >> 1) - 1
}