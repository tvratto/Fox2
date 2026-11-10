/* FOX2 time metadata and local-calendar conversion helpers.
 *
 * Field firmware currently encodes device-local calendar values as if they
 * were UTC. That legacy representation must remain frozen. Future firmware
 * may add z=<IANA time zone>; the web app can then preserve the existing
 * local-calendar display while also deriving a genuine UTC timestamp for
 * durable storage.
 */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.Fox2TimeCodec=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  var LEGACY_BASIS='legacy_local_as_utc';
  var UTC_BASIS='utc_rtc_local_calendar_v1';

  function finiteOffset(value){
    if(value===null||value===undefined||value==='') return null;
    var parsed=Number(value);
    return Number.isFinite(parsed)&&parsed>=-840&&parsed<=840?Math.trunc(parsed):null;
  }

  function validZoneName(value){
    value=String(value||'');
    if(!value||value.length>64||!/^[A-Za-z0-9_+\-/]+$/.test(value)) return false;
    try{
      new Intl.DateTimeFormat('en-US',{timeZone:value}).format(new Date(0));
      return true;
    }catch(error){
      return false;
    }
  }

  function decode(params,payloadMeta){
    var offset=finiteOffset(params&&typeof params.get==='function'?params.get('tz'):null);
    var zone=String(params&&typeof params.get==='function'?(params.get('z')||''):'');
    var zoneValid=validZoneName(zone);
    var version=payloadMeta&&Number(payloadMeta.schemaVersion)||1;
    var utcCapable=version>=2&&zoneValid;
    return {
      timeBasis:utcCapable?UTC_BASIS:LEGACY_BASIS,
      timeZone:utcCapable?zone:null,
      utcOffsetMinutes:offset,
      utcCapable:utcCapable,
      suppliedZone:zone||null,
      zoneValid:zoneValid
    };
  }

  function partsInZone(epochMs,timeZone){
    var formatter=new Intl.DateTimeFormat('en-US',{
      timeZone:timeZone,
      year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    });
    var values={};
    formatter.formatToParts(new Date(epochMs)).forEach(function(part){
      if(part.type!=='literal') values[part.type]=Number(part.value);
    });
    return values;
  }

  function sameWallTime(parts,year,month,day,hour,minute){
    return parts.year===year&&parts.month===month&&parts.day===day&&
      parts.hour===hour&&parts.minute===minute;
  }

  function localToUtcIso(localDate,minuteOfDay,timeZone){
    var match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(localDate||''));
    var minute=Number(minuteOfDay);
    if(!match||!Number.isInteger(minute)||minute<0||minute>1439||!validZoneName(timeZone)) return null;
    var year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
    var hour=Math.floor(minute/60),minutePart=minute%60;
    var wallUtc=Date.UTC(year,month-1,day,hour,minutePart,0,0);
    var candidate=wallUtc;

    // Iterating accounts for zones whose offset at the initial UTC guess is
    // different from the offset at the requested local wall time.
    for(var attempt=0;attempt<3;attempt++){
      var shown=partsInZone(candidate,timeZone);
      var shownAsUtc=Date.UTC(shown.year,shown.month-1,shown.day,shown.hour,shown.minute,shown.second||0,0);
      var next=candidate+(wallUtc-shownAsUtc);
      if(next===candidate) break;
      candidate=next;
    }

    var finalParts=partsInZone(candidate,timeZone);
    if(!sameWallTime(finalParts,year,month,day,hour,minutePart)) return null;
    return new Date(candidate).toISOString();
  }

  return {
    decode:decode,
    validZoneName:validZoneName,
    localToUtcIso:localToUtcIso,
    LEGACY_BASIS:LEGACY_BASIS,
    UTC_BASIS:UTC_BASIS
  };
});
