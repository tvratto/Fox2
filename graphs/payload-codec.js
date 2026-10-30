/* FOX2 URL payload metadata decoder.
 *
 * Unversioned URLs are the frozen field-device legacy-v1 contract. Payload v2
 * is additive: x= identifies the schema/score algorithm/today slot and n=
 * carries original daily measurement counts independently of compressed graph
 * points in d=.
 */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.Fox2PayloadCodec=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  var UNKNOWN_COUNT_PAIR='zz';

  function unsupported(raw,reason){
    return {
      supported:false,
      schemaVersion:null,
      schemaLabel:'unsupported',
      scoreAlgorithm:null,
      todayIndex:null,
      rawHeader:raw||'',
      reason:reason
    };
  }

  function isBase36Char(value){
    return /^[0-9a-z]$/i.test(value||'');
  }

  function parseHeader(raw){
    raw=String(raw||'').toLowerCase();
    if(!raw){
      return {
        supported:true,
        schemaVersion:1,
        schemaLabel:'legacy_v1',
        scoreAlgorithm:null,
        todayIndex:null,
        rawHeader:''
      };
    }
    if(raw.length!==3||!isBase36Char(raw[0])||!isBase36Char(raw[1])||!isBase36Char(raw[2])){
      return unsupported(raw,'Malformed FOX2 payload header.');
    }
    var schemaVersion=parseInt(raw[0],36);
    if(schemaVersion!==2){
      return unsupported(raw,'This FOX2 payload version is not supported by this web app.');
    }
    return {
      supported:true,
      schemaVersion:schemaVersion,
      schemaLabel:'payload_v2',
      scoreAlgorithm:parseInt(raw[1],36),
      todayIndex:parseInt(raw[2],36),
      rawHeader:raw
    };
  }

  function decodeCountPair(pair){
    pair=String(pair||'').toLowerCase();
    if(!/^[0-9a-z]{2}$/.test(pair)) return {valid:false};
    if(pair===UNKNOWN_COUNT_PAIR){
      return {valid:true,measured:true,count:null,countKnown:false};
    }
    var count=parseInt(pair,36);
    return {valid:true,measured:count>0,count:count,countKnown:true};
  }

  function decode(params,dayCount){
    dayCount=Math.max(0,Number(dayCount)||0);
    var header=parseHeader(params&&typeof params.get==='function'?params.get('x'):'');
    if(!header.supported) return header;

    if(header.schemaVersion===1){
      header.days=Array.from({length:dayCount},function(_,index){
        return {
          index:index,
          measured:null,
          measurementCount:null,
          measurementCountKnown:false,
          dayState:null,
          isFuture:false
        };
      });
      return header;
    }

    if(header.todayIndex<0||header.todayIndex>=dayCount){
      return unsupported(header.rawHeader,'FOX2 payload today index is outside its day window.');
    }

    var rawCounts=String(params.get('n')||'').toLowerCase();
    if(rawCounts.length!==dayCount*2){
      return unsupported(header.rawHeader,'FOX2 payload measurement counts have the wrong length.');
    }

    var decoded=[];
    for(var index=0;index<dayCount;index++){
      var countInfo=decodeCountPair(rawCounts.substring(index*2,index*2+2));
      if(!countInfo.valid){
        return unsupported(header.rawHeader,'FOX2 payload measurement counts are malformed.');
      }
      var isFuture=index>header.todayIndex;
      var dayState=null;
      if(countInfo.measured&&!isFuture){
        dayState=index===header.todayIndex?'provisional':'complete';
      }
      decoded.push({
        index:index,
        measured:countInfo.measured,
        measurementCount:countInfo.count,
        measurementCountKnown:countInfo.countKnown,
        dayState:dayState,
        isFuture:isFuture
      });
    }
    header.days=decoded;
    return header;
  }

  return {
    decode:decode,
    parseHeader:parseHeader,
    decodeCountPair:decodeCountPair,
    UNKNOWN_COUNT_PAIR:UNKNOWN_COUNT_PAIR
  };
});
