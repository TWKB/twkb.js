var MAX_value=1<< 63;
var MIN_value=-1<< 63;

var TWKB = 
{
	geoJSONfromBuffer: function (buffer,options)
	{
		var geoms = {};
		geoms.type="FeatureCollection";
		geoms.features=[];
				
		var the_length=buffer.byteLength;
			
		var ta_struct = {};
		ta_struct.buffer=buffer;
		if (options.startReadingAt)
			ta_struct.cursor = options.startReadingAt;
		else
			ta_struct.cursor = 0;
		ta_struct.include_bbox=options.include_bbox;
		while(ta_struct.cursor<the_length)
		{	
			var res = TWKB.readBuffer(ta_struct)
			for (var i =0, len=res.length;i<len;i++)
				geoms.features.push(res[i]);	
		}	
		return geoms;
		
	}
	,
	readBuffer: function (ta_struct)
	{
			var has_z=0;
			var has_m=0;
		/*Here comes a byte containing type info and precission*/
			var flag = ta_struct.buffer[ta_struct.cursor];
			ta_struct.cursor++;
				
			var typ=flag&0x0F;	
			var precision_xy=TWKB.unzigzag((flag&0xF0)>>4);
			ta_struct.factors=[];
			ta_struct.factors[0]=ta_struct.factors[1]= Math.pow(10, precision_xy);

		//Flags for options
		
			var flag = ta_struct.buffer[ta_struct.cursor];
			ta_struct.cursor ++;

			ta_struct.has_bbox   =  flag & 0x01;
			ta_struct.has_size   = (flag & 0x02) >> 1;
			ta_struct.has_idlist = (flag & 0x04) >> 2;
			var extended_dims = (flag & 0x08) >> 3;
			ta_struct.is_empty   = (flag & 0x10) >> 4;

			if ( extended_dims )
			{
				var extended_dims =  ta_struct.buffer[ta_struct.cursor];
				ta_struct.cursor ++;


				/* Strip Z/M presence and precision from ext byte */
				has_z    = (extended_dims & 0x01);
				has_m    = (extended_dims & 0x02) >> 1;
				precision_z = (extended_dims & 0x1C) >> 2;
				precision_m = (extended_dims & 0xE0) >> 5;

				/* Convert the precision into factor */
				if(has_z)
					ta_struct.factors[2] = Math.pow(10, precision_z);
				if(has_m)
					ta_struct.factors[2+has_z] = Math.pow(10, precision_m);			
			}

			ta_struct.ndims = 2 + has_z + has_m;		
		
		if(ta_struct.has_size)
			ta_struct.size=TWKB.ReadVarInt64(ta_struct);
		
		ta_struct.bbox={};
		if(ta_struct.has_bbox)
		{
			ta_struct.bbox.min=[];
			ta_struct.bbox.max=[];
			for (var j=0;j<ta_struct.ndims;j++)
			{
				ta_struct.bbox.min[j]=TWKB.ReadVarSInt64;
				ta_struct.bbox.max[j]=TWKB.ReadVarSInt64+ta_struct.bbox.min[j];
			}
		}
		else
		{			
			ta_struct.bbox.min=[MAX_value,MAX_value,MAX_value,MAX_value];
			ta_struct.bbox.max=[MIN_value,MIN_value,MIN_value,MIN_value];
		}
		
		/*TWKB variable will carry the last refpoint in a pointarray to the next pointarray. It will hold one value per dimmension. */
		var buffer = new ArrayBuffer(4*ta_struct.ndims);
		ta_struct.refpoint = new Int32Array(buffer);
		for (var i = 0;i<ta_struct.ndims;i++)
		{
			ta_struct.refpoint[i]=0;
		}		
		
		var res=[];
		/*If POINT*/			
		if(typ==1)
		{
			res[0]=TWKB.parse_point(ta_struct)
		}			
		/*if LINESTRING*/
		else if(typ==2)
		{
			res[0]=TWKB.parse_line(ta_struct)
		}		
		/*if POLYGON*/
		else if(typ==3)
		{	
			res[0]=TWKB.parse_polygon(ta_struct)
		}		
		/*if MultiPOINT*/
		else if(typ==4)
		{
			res = TWKB.parse_multi(ta_struct,TWKB.parse_point);
		}			
		/*if MultiLINESTRING*/
		else if(typ==5)
		{
			res = TWKB.parse_multi(ta_struct,TWKB.parse_line);
		}		
		/*if MultiPOLYGON*/
		else if(typ==6)
		{	
			res = TWKB.parse_multi(ta_struct,TWKB.parse_polygon);
		}
		/*if Collection*/
		else if(typ==7)
		{	
			res = TWKB.parse_multi(ta_struct,TWKB.readBuffer);
		}
		return res;
		
	}


	,
	ReadVarInt64: function ReadVarInt64(ta_struct)
	{
	    cursor=ta_struct.cursor;
		nVal = 0;
	    nShift = 0;

	    while(1)
	    {
		nByte = ta_struct.buffer[cursor];
		if (!(nByte & 0x80))
		{
		    cursor++;
		ta_struct.cursor=cursor;
		    return nVal | (nByte << nShift);
		}
		nVal = nVal | (nByte & 0x7f) << nShift;
		cursor ++;
		nShift += 7;
	    }
	}
	,
	ReadVarSInt64: function(ta_struct)
	{
	    nVal = TWKB.ReadVarInt64(ta_struct);
	    return TWKB.unzigzag(nVal);
	}
	,
	unzigzag: function (nVal)
	{
	    if ((nVal & 1) == 0) 
		return ((nVal) >> 1);
	    else
		return -(nVal >> 1)-1;
	}

	,
	parse_point: function (ta_struct)
	{
		var geom={};
		geom.type="Point";	
		geom.coordinates = TWKB.read_pa(ta_struct,1);
		return geom;
	}
	,
	parse_line: function (ta_struct)
	{
		var geom={};
		geom.type="LineString";			
		var npoints=TWKB.ReadVarInt64(ta_struct);
		geom.coordinates = [];
		geom.coordinates = TWKB.read_pa(ta_struct,npoints);
		return geom;
	}
	,
	parse_polygon: function (ta_struct)
	{
		var geom={};
		geom.type="Polygon";

		geom.coordinates = [];		
		var nrings=TWKB.ReadVarInt64(ta_struct);
		for (ring=0;ring<nrings;ring++)
		{		
			var npoints=TWKB.ReadVarInt64(ta_struct);
			geom.coordinates[ring] =  TWKB.read_pa(ta_struct,npoints);
		}	
		return geom;
	}
	,
	parse_multi: function (ta_struct,parser)
	{
		var ngeoms=TWKB.ReadVarInt64(ta_struct);
		
		var geoms=[];
		if(ta_struct.has_idlist)
		{

			var IDlist=TWKB.readIDlist(ta_struct,ngeoms);
			for (var i=0;i<ngeoms;i++)
			{		
				Feature={};
				Feature.type="Feature";
				Feature.id=IDlist[i];
				Feature.geometry= parser(ta_struct);						
				geoms.push(Feature);
			}	
		}
		else
		{
			for (geom=0;geom<ngeoms;geom++)
			{		
				geoms.push(parser(ta_struct));
			}
		}
		return geoms;
	}
	
	,

	read_pa: function(ta_struct,npoints)
	{
		var coords=[];
		var ndims=ta_struct.ndims;
		var factors=ta_struct.factors;
		

		for (i =0;i<(npoints);i++)
		{
			coords[i]=[];
			for (j =0;j<(ndims);j++)
			{
				ta_struct.refpoint[j]+=TWKB.ReadVarSInt64(ta_struct);
				coords[i][j]=ta_struct.refpoint[j]/factors[j];				
			}
		}
		if(ta_struct.include_bbox && !ta_struct.has_bbox)
		{
			for (i =0;i<(npoints);i++)
			{
				for (j =0;j<(ndims);j++)
				{
					if(coords[i][j]<ta_struct.bbox.min[j])
						ta_struct.bbox.min[j]=coords[i][j];
					if(coords[i][j]>ta_struct.bbox.max[j])
						ta_struct.bbox.max[j]=coords[i][j];
				}
			}
		}
		return coords;	
	}
	,
	readIDlist: function(ta_struct,n)
	{
		var IDlist=[];
		for (var i =0;i<n;i++)
			IDlist.push(TWKB.ReadVarSInt64(ta_struct));
		return IDlist;
	}
}

module.exports = TWKB;
