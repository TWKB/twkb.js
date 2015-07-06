import toGeoJSON from './toGeoJSON';
import read from './read';

const twkb = {
  toGeoJSON: toGeoJSON,
  read: read
};

export default twkb;

global.twkb = twkb;
