/* FOX2 URL payload metadata decoder.
 *
 * Unversioned URLs are the frozen field-device legacy-v1 contract. Payload v2
 * is additive: x= identifies the schema/score algorithm/today slot and m=
 * marks measured daily slots independently of compressed graph points in d=.
 * r= carries the exact represented duration for today's
 * provisional AUC, in whole minutes.
 */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.Fox2PayloadCodec=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function unsupported(raw,reason){
    return {
      supported:false,
      schemaVersion:null,
      schemaLabel:'unsupported',
      scoreAlgorithm:null,
      todayIndex:null,
      todayRepresentedMinutes:null,
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
        todayRepresentedMinutes:null,
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

  function decodeMeasuredMask(raw,dayCount){
    raw=String(raw||'').toLowerCase();
    if(!/^[0-9a-z]{5}$/.test(raw)) return {valid:false,mask:0};
    var mask=parseInt(raw,36);
    if(!Number.isSafeInteger(mask)||mask<0||mask>=Math.pow(2,dayCount)){
      return {valid:false,mask:0};
    }
    return {valid:true,mask:mask};
  }

  function decodeRepresentedMinutes(raw){
    raw=String(raw||'').toLowerCase();
    if(!/^[0-9a-z]{3}$/.test(raw)) return {valid:false,minutes:null};
    var minutes=parseInt(raw,36);
    if(minutes<0||minutes>1440) return {valid:false,minutes:null};
    return {valid:true,minutes:minutes>0?minutes:null};
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
          dayState:null,
          isFuture:false,
          representedMinutes:null
        };
      });
      return header;
    }

    if(header.todayIndex<0||header.todayIndex>=dayCount){
      return unsupported(header.rawHeader,'FOX2 payload today index is outside its day window.');
    }

    var represented=decodeRepresentedMinutes(params.get('r'));
    if(!represented.valid){
      return unsupported(header.rawHeader,'FOX2 payload represented duration is malformed.');
    }
    header.todayRepresentedMinutes=represented.minutes;

    var measuredMask=decodeMeasuredMask(params.get('m'),dayCount);
    if(!measuredMask.valid){
      return unsupported(header.rawHeader,'FOX2 payload measured-day mask is malformed.');
    }

    var decoded=[];
    for(var index=0;index<dayCount;index++){
      var measured=(measuredMask.mask&Math.pow(2,index))!==0;
      var isFuture=index>header.todayIndex;
      var dayState=null;
      if(measured&&!isFuture){
        dayState=index===header.todayIndex?'provisional':'complete';
      }
      decoded.push({
        index:index,
        measured:measured,
        dayState:dayState,
        isFuture:isFuture,
        representedMinutes:!measured||isFuture
          ?null
          :(index===header.todayIndex?represented.minutes:1440)
      });
    }
    header.days=decoded;
    return header;
  }

  return {
    decode:decode,
    parseHeader:parseHeader,
    decodeMeasuredMask:decodeMeasuredMask,
    decodeRepresentedMinutes:decodeRepresentedMinutes,
  };
});
