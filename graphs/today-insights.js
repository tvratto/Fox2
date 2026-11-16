(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.Fox2TodayInsights=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  var MIN_CHANGE_PERCENT=8;
  var RECENT_WINDOW=3;

  function score(record){
    if(!record||!record.measured) return null;
    var displayed=record.displayDailyFatUse;
    var value=displayed===null||displayed===undefined||displayed===''?NaN:Number(displayed);
    var canonical=record.canonicalAuc;
    if(!Number.isFinite(value)) value=canonical===null||canonical===undefined||canonical===''?NaN:Number(canonical);
    return Number.isFinite(value)?value:null;
  }

  function isComplete(record){
    return score(record)!==null&&(record.dayState==='complete'||Number(record.representedMinutes)===1440);
  }

  function percentChange(value,reference){
    if(!Number.isFinite(value)||!Number.isFinite(reference)||reference<=0) return null;
    return (value-reference)/reference*100;
  }

  function roundedPercent(value){
    return Math.max(1,Math.round(Math.abs(value)));
  }

  function mean(values){
    return values.length?values.reduce(function(total,value){return total+value;},0)/values.length:null;
  }

  function uniqueRecords(records){
    var byDate={};
    (records||[]).forEach(function(record){
      if(!record||!record.localDate||score(record)===null) return;
      byDate[record.localDate]=record;
    });
    return Object.keys(byDate).sort().map(function(date){return byDate[date];});
  }

  function chooseInsight(input){
    input=input||{};
    var date=input.date||input.today;
    var records=uniqueRecords(input.records);
    var current=records.find(function(record){return record.localDate===date;});
    var currentScore=score(current);
    if(!current||currentScore===null) return null;

    var priorComplete=records.filter(function(record){return record.localDate<date&&isComplete(record);});
    var recentPrior=priorComplete.slice(-7);
    var provisional=date===input.today&&current.dayState==='provisional';

    if(recentPrior.length>=3&&currentScore>Math.max.apply(null,recentPrior.map(score))){
      return {
        kind:'recent-high',
        text:(provisional?'Already your highest':'Your highest')+' in the last '+recentPrior.length+' measured days.'
      };
    }

    // An unfinished day is compared with a completed day only after it has
    // actually passed that full-day result. A partial lower result stays quiet.
    var previous=priorComplete[priorComplete.length-1];
    var previousScore=score(previous);
    var dayChange=percentChange(currentScore,previousScore);
    if(provisional&&previous&&dayChange!==null&&dayChange>=MIN_CHANGE_PERCENT){
      return {
        kind:'already-higher',
        text:'Already '+roundedPercent(dayChange)+'% higher than your last measured day.'
      };
    }

    if(isComplete(current)&&previous&&dayChange!==null&&Math.abs(dayChange)>=MIN_CHANGE_PERCENT){
      return {
        kind:'day-change',
        text:roundedPercent(dayChange)+'% '+(dayChange>0?'higher':'lower')+' than your previous measured day.'
      };
    }

    var throughCurrent=records.filter(function(record){return record.localDate<=date&&isComplete(record);});
    if(throughCurrent.length>=RECENT_WINDOW*2){
      var recent=throughCurrent.slice(-RECENT_WINDOW).map(score);
      var earlier=throughCurrent.slice(-RECENT_WINDOW*2,-RECENT_WINDOW).map(score);
      var trendChange=percentChange(mean(recent),mean(earlier));
      if(trendChange!==null&&Math.abs(trendChange)>=MIN_CHANGE_PERCENT){
        return {
          kind:'recent-trend',
          text:'Your last 3 measured days averaged '+roundedPercent(trendChange)+'% '+(trendChange>0?'higher':'lower')+' than the 3 before.'
        };
      }
    }

    return null;
  }

  return {chooseInsight:chooseInsight};
});
