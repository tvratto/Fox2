/*
 * FOX2 customer copy generator
 *
 * Converts trusted Progress data into concise, conversational copy. The
 * generator is deterministic and contains no DOM access so every surface can
 * use the same state, calculation, and wording.
 */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.Fox2CopyGenerator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function mean(values){
    if(!values.length) return null;
    return values.reduce(function(sum,value){return sum+value;},0)/values.length;
  }

  function rounded(value){return Math.round(Number(value)||0);}

  function validCompletedDays(days){
    return (Array.isArray(days)?days:[]).filter(function(day){
      return day&&!day.current&&isFinite(Number(day.score));
    }).map(function(day){
      return {date:String(day.date||''),score:Number(day.score)};
    }).sort(function(a,b){return a.date.localeCompare(b.date);});
  }

  function stableDirection(rawPercent,neutralBand){
    if(Math.abs(rawPercent)<neutralBand) return 'stable';
    return rawPercent>0?'up':'down';
  }

  function result(state,stage,direction,headline,detail,cta,metric,evidence,tone){
    return {
      state:state,
      stage:stage,
      direction:direction,
      headline:headline,
      summary:headline,
      detail:detail||'',
      cta:cta||null,
      metric:metric||null,
      evidence:evidence||'',
      tone:tone||'neutral'
    };
  }

  function baselineEvidence(count,average,baseline,todayExcluded){
    return 'Based on the average of '+count+' completed daily Fat Use '+(count===1?'Score':'Scores')+
      ' ('+rounded(average)+') compared with your baseline ('+rounded(baseline)+').'+
      (todayExcluded?' Today’s unfinished Score is not included.':'');
  }

  function periodEvidence(earlier,recent,todayExcluded){
    return 'Based on your recent completed Fat Use Scores compared with your earlier completed Scores.'+
      (todayExcluded?' Today’s unfinished Score is not included.':'');
  }

  function progress(input){
    input=input||{};
    var completed=validCompletedDays(input.completedDays);
    var today=input.today&&isFinite(Number(input.today.score))?{score:Number(input.today.score)}:null;
    var baseline=Number(input.baseline),hasBaseline=isFinite(baseline)&&baseline>0;
    var action=String(input.action||'').trim(),hasAction=!!action;
    var neutralBand=isFinite(Number(input.neutralBandPercent))?Math.max(0,Number(input.neutralBandPercent)):3;

    if(!completed.length){
      if(today){
        return result(
          'accumulating','starting','unknown',
          'Today’s Fat Use Score is '+rounded(today.score)+' so far.',
          'Keep measuring normally. FOX2 will finalize today’s Score tomorrow morning.',
          {label:'Keep measuring',action:'measure'},null,
          'Today’s Score is still accumulating, so it is not used for a comparison yet.','informational'
        );
      }
      return result(
        'empty','starting','unknown',
        'Your first pattern starts with one completed day.',
        'Measure normally, then tap your phone to sync. FOX2 will do the comparing for you.',
        {label:'Take a measurement',action:'measure'},null,'No completed daily Fat Use Score is available yet.','informational'
      );
    }

    var latest=completed[completed.length-1];
    if(completed.length===1){
      return result(
        'first-result','starting','unknown',
        'Your first completed Fat Use Score is '+rounded(latest.score)+'.',
        hasAction?'That’s your first result since starting '+action+'. Keep measuring to see whether a pattern develops.':'That’s your starting point. Keep measuring to see what changes.',
        {label:'Keep measuring',action:'measure'},
        {basis:'first-completed-score',value:rounded(latest.score),completedCount:1},
        'Based on your first completed daily Fat Use Score.','informational'
      );
    }

    var average=mean(completed.map(function(day){return day.score;}));
    var comparisonValue,reference,basis,evidence;
    if(hasBaseline){
      comparisonValue=average;
      reference=baseline;
      basis='completed-average-vs-baseline';
      evidence=baselineEvidence(completed.length,average,baseline,!!today);
    }else if(completed.length<4){
      comparisonValue=latest.score;
      reference=completed[0].score;
      basis='latest-vs-first';
      evidence='Based on your latest completed Fat Use Score compared with your first completed Score.'+(today?' Today’s unfinished Score is not included.':'');
    }else{
      var split=Math.ceil(completed.length/2);
      var earlier=mean(completed.slice(0,split).map(function(day){return day.score;}));
      var recent=mean(completed.slice(split).map(function(day){return day.score;}));
      comparisonValue=recent;
      reference=earlier;
      basis='recent-average-vs-earlier-average';
      evidence=periodEvidence(earlier,recent,!!today);
    }

    var rawPercent=(comparisonValue-reference)/Math.max(1,reference)*100;
    var percent=Math.round(Math.abs(rawPercent));
    var direction=stableDirection(rawPercent,neutralBand);
    var stage=completed.length<4?'early':'established';
    var state=stage+'-'+direction+(hasAction?'-action':(hasBaseline?'-baseline':'-personal'));
    var metric={
      basis:basis,
      percent:percent,
      rawPercent:rawPercent,
      direction:direction,
      completedCount:completed.length,
      comparisonValue:comparisonValue,
      referenceValue:reference,
      excludesToday:!!today
    };
    var headline='',detail='',cta=null,tone='neutral';

    if(stage==='early'&&hasAction&&hasBaseline){
      if(direction==='up'){
        headline='It’s only been a few days, but since starting '+action+', your Fat Use Score is already '+percent+'% higher.';
        detail='Keep measuring normally to see if this early result holds.';
        tone='positive';
      }else if(direction==='down'){
        headline='It’s still early, but since starting '+action+', your Fat Use Score is '+percent+'% lower so far.';
        detail='That’s useful to know. Keep measuring normally to see whether this holds.';
        tone='supportive';
      }else{
        headline='No clear shift yet—since starting '+action+', your Fat Use Score is '+(percent?'within '+percent+'% of':'right at')+' your baseline.';
        detail='Keep measuring normally. A few more completed days will make the comparison more useful.';
        tone='informational';
      }
    }else if(stage==='established'&&hasAction&&hasBaseline){
      if(direction==='up'){
        headline='Great—since starting '+action+', your Fat Use Score has averaged '+percent+'% higher than your baseline.';
        detail='Keep measuring to see how durable this result is.';
        cta={label:'See what changed',action:'review-change'};
        tone='positive';
      }else if(direction==='down'){
        headline='Since starting '+action+', your Fat Use Score has averaged '+percent+'% lower than your baseline.';
        detail='This result is worth learning from. Review what else changed, then decide what to try next.';
        cta={label:'Review recent days',action:'review-days'};
        tone='supportive';
      }else{
        headline='No clear shift yet—since starting '+action+', your Fat Use Score '+(percent?'remains within '+percent+'% of':'is right at')+' baseline.';
        detail='Keep measuring a little longer to make the comparison easier to interpret.';
        tone='informational';
      }
    }else if(hasBaseline){
      if(direction==='up'){
        headline=(stage==='early'?'Early win: ':'Great—')+'your Fat Use Score is averaging '+percent+'% above your baseline.';
        detail=stage==='early'?'Keep measuring to see whether this becomes a pattern.':'Your completed days are consistently landing above your starting point.';
        tone='positive';
      }else if(direction==='down'){
        headline='Your Fat Use Score is averaging '+percent+'% below your baseline.';
        detail='Think about what changed recently, then choose one thing to test.';
        cta={label:'Choose a change',action:'start-change'};
        tone='supportive';
      }else{
        headline=percent?'Your Fat Use Score is holding close to baseline—within '+percent+'%.':'Your Fat Use Score is right at your baseline.';
        detail='This is a useful starting point for testing one lifestyle change.';
        cta={label:'Choose a change',action:'start-change'};
        tone='informational';
      }
    }else{
      var comparisonLabel=basis==='latest-vs-first'?'your first completed Score':'your earlier completed Scores';
      if(direction==='up'){
        headline=(stage==='early'?'It’s still early, but ':'Great—')+'your recent Fat Use Score is '+percent+'% higher than '+comparisonLabel+'.';
        detail='Add a baseline before your next change if you want FOX2 to measure its impact.';
        cta={label:'Set up a baseline',action:'start-baseline'};
        tone='positive';
      }else if(direction==='down'){
        headline='Your recent Fat Use Score is '+percent+'% lower than '+comparisonLabel+'.';
        detail='A baseline can help you test what may be affecting the change.';
        cta={label:'Set up a baseline',action:'start-baseline'};
        tone='supportive';
      }else{
        headline=percent?'Your recent Fat Use Score is holding close to '+comparisonLabel+'—within '+percent+'%.':'Your recent Fat Use Score matches '+comparisonLabel+'.';
        detail='Set a baseline when you’re ready to test one change.';
        cta={label:'Set up a baseline',action:'start-baseline'};
        tone='informational';
      }
      if(hasAction){
        headline=headline.replace('your recent Fat Use Score','since starting '+action+', your recent Fat Use Score');
      }
    }

    return result(state,stage,direction,headline,detail,cta,metric,evidence,tone);
  }

  function generateCopy(surface,input){
    if(surface==='progress') return progress(input);
    throw new Error('Unsupported FOX2 copy surface: '+surface);
  }

  return {generateCopy:generateCopy,progress:progress};
});
