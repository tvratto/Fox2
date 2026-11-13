/* Canonical FOX2 daily-record normalization.
 *
 * This module is intentionally independent of DOM and Supabase. It is the one
 * place that converts firmware AUC plus its matching represented duration into
 * the user-facing Daily Average. Compressed graph points never enter the
 * calculation.
 */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.Fox2DailyRecord=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function finite(value){
    return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
  }

  function oneDecimal(value){
    return Math.round(Number(value)*10)/10;
  }

  function tierForAverage(value){
    if(!finite(value)) return null;
    value=Number(value);
    if(value<3) return {key:'low',label:'Low'};
    if(value<5) return {key:'medium',label:'Medium'};
    if(value<8) return {key:'high',label:'High'};
    return {key:'very_high',label:'Very High'};
  }

  function normalizeDay(input){
    input=input||{};
    var dayState=input.dayState==='complete'||input.dayState==='provisional'
      ?input.dayState:null;
    var measured=typeof input.measured==='boolean'
      ?input.measured
      :!!input.hasMeasurement;
    if(!measured) dayState=null;
    var aucAuthoritative=!!input.aucAuthoritative;
    var canonicalAuc=aucAuthoritative&&finite(input.canonicalAuc)
      ?Math.max(0,Number(input.canonicalAuc)):null;
    var representedMinutes=null;

    if(measured&&dayState==='complete') representedMinutes=1440;
    else if(measured&&dayState==='provisional'&&finite(input.representedMinutes)){
      var candidate=Math.trunc(Number(input.representedMinutes));
      if(candidate>0&&candidate<=1440) representedMinutes=candidate;
    }

    var dailyAverage=null;
    if(measured&&canonicalAuc!==null&&representedMinutes){
      dailyAverage=canonicalAuc/(representedMinutes/60);
    }
    var displayDailyAverage=dailyAverage===null?null:oneDecimal(dailyAverage);
    var tier=tierForAverage(displayDailyAverage);

    return {
      localDate:String(input.localDate||''),
      measured:measured,
      canonicalAuc:canonicalAuc,
      aucAuthoritative:aucAuthoritative,
      representedMinutes:representedMinutes,
      dailyAverage:dailyAverage,
      displayDailyAverage:displayDailyAverage,
      tierKey:tier?tier.key:null,
      tierLabel:tier?tier.label:null,
      dayState:dayState,
      scoreAlgorithm:finite(input.scoreAlgorithm)?Number(input.scoreAlgorithm):null,
      payloadSchema:input.payloadSchema||null,
      eligibleForTracking:dayState==='complete'&&measured&&dailyAverage!==null
    };
  }

  var RICH_FIELDS=[
    'canonicalAuc','representedMinutes','dailyAverage','displayDailyAverage',
    'tierKey','tierLabel','dayState','scoreAlgorithm'
  ];

  function mergeRecord(existing,incoming,options){
    existing=existing||{};
    incoming=incoming||{};
    options=options||{};
    var merged=Object.assign({},existing);
    var incomingIsNewer=!!options.incomingIsNewer;

    Object.keys(incoming).forEach(function(key){
      var value=incoming[key];
      if(value===null||value===undefined||value==='') return;
      if(incomingIsNewer||merged[key]===null||merged[key]===undefined||merged[key]===''){
        merged[key]=value;
      }
    });

    // Metadata richness is monotonic even when newer legacy data arrives.
    RICH_FIELDS.forEach(function(key){
      if((incoming[key]===null||incoming[key]===undefined||incoming[key]==='')&&
         existing[key]!==null&&existing[key]!==undefined&&existing[key]!==''){
        merged[key]=existing[key];
      }
    });
    return merged;
  }

  function persistenceFields(record){
    record=record||{};
    var fields={};
    function put(key,value){
      if(value!==null&&value!==undefined&&value!=='') fields[key]=value;
    }
    put('represented_duration_minutes',record.representedMinutes);
    put('score_algorithm',record.scoreAlgorithm);
    return fields;
  }

  return {
    normalizeDay:normalizeDay,
    mergeRecord:mergeRecord,
    persistenceFields:persistenceFields,
    tierForAverage:tierForAverage,
    oneDecimal:oneDecimal
  };
});
