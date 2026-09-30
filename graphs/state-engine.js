/*
 * FOX2 seven-day state engine
 *
 * Pure data model: no DOM access and no customer-facing copy. It converts
 * classifiable daily records into chronological seven-day states, then adds
 * transitions, persistence, safety flags, and personal-history context.
 */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.Fox2StateEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  var DAY_MS=86400000;
  var LEVEL_ORDER={low:0,moderate:1,higher:2,strong:3};

  function parseIso(iso){return new Date(iso+'T00:00:00Z');}
  function iso(date){return date.toISOString().slice(0,10);}
  function addDays(isoDate,amount){
    var d=parseIso(isoDate);
    d.setUTCDate(d.getUTCDate()+amount);
    return iso(d);
  }
  function median(values){
    if(!values.length) return null;
    var sorted=values.slice().sort(function(a,b){return a-b;});
    var mid=Math.floor(sorted.length/2);
    return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
  }
  function mean(values){
    if(!values.length) return null;
    return values.reduce(function(sum,value){return sum+value;},0)/values.length;
  }
  function round(value,digits){
    if(value===null||value===undefined) return null;
    var p=Math.pow(10,digits||0);
    return Math.round(value*p)/p;
  }
  function levelForScore(score){
    if(score<=60) return 'low';
    if(score<=120) return 'moderate';
    if(score<=180) return 'higher';
    return 'strong';
  }
  function responseBand(rate){
    if(rate<=.20) return 'quiet';
    if(rate<.60) return 'intermittent';
    return 'active';
  }
  function higherUseBand(rate){
    if(rate===0) return 'none';
    if(rate<.50) return 'occasional';
    return 'frequent';
  }
  function amplitudeBand(amplitude){
    if(amplitude===null) return 'none';
    if(amplitude<2.5) return 'small';
    if(amplitude<=4) return 'typical';
    return 'strong';
  }
  function longestStreakAbove(days,threshold){
    var sorted=days.slice().sort(function(a,b){return a.date.localeCompare(b.date);});
    var longest=0,current=0,previousDate=null;
    sorted.forEach(function(day){
      var consecutive=previousDate&&addDays(previousDate,1)===day.date;
      if(Number(day.score)>threshold) current=consecutive?current+1:1;
      else current=0;
      if(current>longest) longest=current;
      previousDate=day.date;
    });
    return longest;
  }
  function direction(delta,threshold){
    if(delta===null||delta===undefined) return 'unknown';
    if(delta>=threshold) return 'rising';
    if(delta<=-threshold) return 'falling';
    return 'stable';
  }
  function titleCase(value){
    return String(value||'').replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
  }

  function stateForWindow(startDate,endDate,days,minClassifiableDays){
    var windowDays=days.filter(function(day){
      return day.date>=startDate&&day.date<=endDate;
    });
    var count=windowDays.length;
    var coverage=count>=minClassifiableDays?'sufficient':count>=2?'limited':'insufficient';
    var state={
      startDate:startDate,endDate:endDate,coverage:coverage,
      classifiableDays:count,days:windowDays,
      stateId:'INSUFFICIENT_DATA',stateLabel:'Insufficient data',
      level:'unknown',response:'unknown',higherUse:'unknown',
      safetyFlag:'none',metrics:{},transition:null,
      stateStreak:0,levelStreak:0,historical:{}
    };
    if(!count) return state;

    var scores=windowDays.map(function(day){return Number(day.score);});
    var responsive=windowDays.filter(function(day){return day.movement==='responsive';});
    var higher=windowDays.filter(function(day){return Number(day.score)>120;});
    var amplitudes=responsive.map(function(day){return Number(day.responseAmplitude)||0;}).filter(function(v){return v>0;});
    var medianScore=median(scores);
    var responseRate=responsive.length/count;
    var higherRate=higher.length/count;
    var level=levelForScore(medianScore);
    var response=responseBand(responseRate);
    var higherUse=higherUseBand(higherRate);
    var bandDays={low:0,moderate:0,higher:0,strong:0};
    windowDays.forEach(function(day){bandDays[levelForScore(Number(day.score))]++;});
    var above60=windowDays.filter(function(day){return Number(day.score)>60;}).length;
    var above180=windowDays.filter(function(day){return Number(day.score)>180;}).length;

    state.metrics={
      medianScore:round(medianScore,1),meanScore:round(mean(scores),1),
      minScore:Math.min.apply(null,scores),maxScore:Math.max.apply(null,scores),
      responsiveDays:responsive.length,responseRate:round(responseRate,3),
      higherUseDays:higher.length,higherUseRate:round(higherRate,3),
      bandDays:bandDays,
      above60Days:above60,above60Rate:round(above60/count,3),
      above120Days:higher.length,above120Rate:round(higherRate,3),
      above180Days:above180,above180Rate:round(above180/count,3),
      longestStreakAbove60:longestStreakAbove(windowDays,60),
      longestStreakAbove120:longestStreakAbove(windowDays,120),
      longestStreakAbove180:longestStreakAbove(windowDays,180),
      medianResponseAmplitude:amplitudes.length?round(median(amplitudes),1):null,
      maxResponseAmplitude:amplitudes.length?round(Math.max.apply(null,amplitudes),1):null
    };
    state.level=level;
    state.response=response;
    state.higherUse=higherUse;
    state.amplitude=amplitudeBand(state.metrics.medianResponseAmplitude);

    if(coverage!=='sufficient') return state;
    state.stateId=(level+'_'+response).toUpperCase();
    state.stateLabel=titleCase(level)+' + '+titleCase(response);
    if((level==='higher'||level==='strong')&&response==='quiet'){
      state.safetyFlag='watch_high_steady';
    }
    return state;
  }

  function addTransitions(states){
    var previous=null;
    var gapWindows=0;
    var priorMedians=[];
    var everHadHigherUse=false;
    states.forEach(function(state,index){
      if(state.coverage!=='sufficient'){
        state.transition={kind:'insufficient_data',changes:[]};
        if(previous) gapWindows++;
        return;
      }

      var transition={kind:'baseline',changes:[],scoreDirection:'unknown',responseDirection:'unknown',above60Direction:'unknown',above120Direction:'unknown',above180Direction:'unknown'};
      if(previous){
        var scoreDelta=round(state.metrics.medianScore-previous.metrics.medianScore,1);
        var responseDelta=round(state.metrics.responseRate-previous.metrics.responseRate,3);
        var above60Delta=round(state.metrics.above60Rate-previous.metrics.above60Rate,3);
        var above120Delta=round(state.metrics.above120Rate-previous.metrics.above120Rate,3);
        var above180Delta=round(state.metrics.above180Rate-previous.metrics.above180Rate,3);
        transition.kind=state.stateId===previous.stateId?'same_state':'state_change';
        transition.from=previous.stateId;
        transition.to=state.stateId;
        transition.gapWindows=gapWindows;
        transition.scoreDelta=scoreDelta;
        transition.responseDelta=responseDelta;
        transition.above60Delta=above60Delta;
        transition.above120Delta=above120Delta;
        transition.above180Delta=above180Delta;
        transition.scoreDirection=direction(scoreDelta,10);
        transition.responseDirection=direction(responseDelta,.20);
        transition.above60Direction=direction(above60Delta,.20);
        transition.above120Direction=direction(above120Delta,.20);
        transition.above180Direction=direction(above180Delta,.20);
        if(transition.scoreDirection!=='stable') transition.changes.push('score_'+transition.scoreDirection);
        if(transition.responseDirection!=='stable') transition.changes.push('response_'+transition.responseDirection);
        if(transition.above60Direction!=='stable') transition.changes.push('above_60_'+transition.above60Direction);
        if(transition.above120Direction!=='stable') transition.changes.push('above_120_'+transition.above120Direction);
        if(transition.above180Direction!=='stable') transition.changes.push('above_180_'+transition.above180Direction);
        if(LEVEL_ORDER[state.level]>LEVEL_ORDER[previous.level]) transition.changes.push('entered_higher_level');
        if(LEVEL_ORDER[state.level]<LEVEL_ORDER[previous.level]) transition.changes.push('entered_lower_level');
        state.stateStreak=gapWindows===0&&state.stateId===previous.stateId?previous.stateStreak+1:1;
        state.levelStreak=gapWindows===0&&state.level===previous.level?previous.levelStreak+1:1;
        if(gapWindows===0&&state.safetyFlag==='watch_high_steady'&&previous.safetyFlag==='watch_high_steady'){
          state.safetyFlag='persistent_high_steady';
          transition.changes.push('high_steady_persisting');
        }
      }else{
        state.stateStreak=1;
        state.levelStreak=1;
      }

      state.transition=transition;
      state.historical={
        firstUsableState:priorMedians.length===0,
        newHighestMedian:priorMedians.length>0&&state.metrics.medianScore>Math.max.apply(null,priorMedians),
        newLowestMedian:priorMedians.length>0&&state.metrics.medianScore<Math.min.apply(null,priorMedians),
        medianPercentile:priorMedians.length?round(priorMedians.filter(function(v){return v<=state.metrics.medianScore;}).length/priorMedians.length,2):null,
        firstHigherUseWeek:state.metrics.higherUseDays>0&&!everHadHigherUse
      };
      if(state.metrics.higherUseDays>0) everHadHigherUse=true;
      priorMedians.push(state.metrics.medianScore);
      previous=state;
      gapWindows=0;
    });
    return states;
  }

  function buildWeeklyStates(days,options){
    options=options||{};
    var valid=(days||[]).filter(function(day){
      return day&&/^\d{4}-\d{2}-\d{2}$/.test(day.date)&&isFinite(Number(day.score));
    }).slice().sort(function(a,b){return a.date.localeCompare(b.date);});
    if(!valid.length) return [];
    var endDate=options.endDate||valid[valid.length-1].date;
    var minClassifiableDays=options.minClassifiableDays||4;
    var earliest=valid[0].date;
    var windows=[];
    var cursorEnd=endDate;
    while(cursorEnd>=earliest){
      var cursorStart=addDays(cursorEnd,-6);
      windows.push(stateForWindow(cursorStart,cursorEnd,valid,minClassifiableDays));
      cursorEnd=addDays(cursorStart,-1);
    }
    windows.reverse();
    return addTransitions(windows);
  }

  function currentState(states){
    for(var i=(states||[]).length-1;i>=0;i--){
      if(states[i].coverage==='sufficient') return states[i];
    }
    return null;
  }

  return {
    version:'0.1.0',
    buildWeeklyStates:buildWeeklyStates,
    currentState:currentState,
    levelForScore:levelForScore,
    responseBand:responseBand,
    higherUseBand:higherUseBand
  };
});
