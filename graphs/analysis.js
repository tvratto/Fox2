// FOX2 complete-history interpretation and visualization.
// Loaded before the main page script; runtime data is supplied after the
// device payload and database history have been initialized.

// ── Complete-history analysis tab ────────────────────────────────────────
// Daily scores written before this web fix were saved one calendar day early.
// Keep this compatibility correction read-only; new rows are stored correctly.
var SCORE_DATE_FIX_CUTOFF='2026-09-28';

function addIsoDays(iso,amount){
  var d=new Date(iso+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()+amount);
  return d.toISOString().slice(0,10);
}

function analysisShortDate(iso){
  var parts=String(iso||'').split('-');
  if(parts.length!==3) return String(iso||'');
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[Number(parts[1])-1]+' '+Number(parts[2]);
}

function analysisWeekday(iso){
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(iso+'T00:00:00Z').getUTCDay()];
}

function analysisRelativeDay(iso,referenceDate){
  if(!referenceDate) return analysisWeekday(iso);
  var age=Math.round((new Date(referenceDate+'T00:00:00Z')-new Date(iso+'T00:00:00Z'))/86400000);
  if(age===0) return 'Today';
  if(age===1) return 'Yesterday';
  if(age>=2&&age<=7) return 'Last '+analysisWeekday(iso);
  return analysisWeekday(iso);
}

function analysisDayPart(minute){
  if(Number(minute)<720) return 'morning';
  if(Number(minute)<1020) return 'afternoon';
  return 'evening';
}

function analysisLookbackWindow(days,tagRows,referenceDate,maxAgeDays){
  var oldestDate=referenceDate?addIsoDays(referenceDate,-Math.max(0,maxAgeDays||5)):null;
  var candidates=(days||[]).filter(function(day){
    return day&&day.responseEpisode&&(!oldestDate||day.date>=oldestDate)&&(!referenceDate||day.date<=referenceDate)&&isFinite(Number(day.responseEpisode.startTime||day.responseEpisode.peakTime));
  }).slice().sort(function(a,b){return b.date.localeCompare(a.date);});
  if(!candidates.length) return null;
  var day=candidates[0];
  var episode=day.responseEpisode;
  var eventTime=Number(episode.startTime||episode.peakTime);
  var minute=isFinite(Number(episode.startMinute))?Number(episode.startMinute):new Date(eventTime).getUTCHours()*60+new Date(eventTime).getUTCMinutes();
  var part=analysisDayPart(minute);
  var weekday=analysisWeekday(day.date);
  var priorDate=addIsoDays(day.date,-1);
  var eventLabel=weekday+' '+part;
  var lookbackPhrase=part==='morning'
    ?analysisWeekday(priorDate)+' evening and '+weekday+' morning'
    :part==='afternoon'
      ?analysisWeekday(priorDate)+' evening through '+weekday+' morning'
      :weekday+' morning and afternoon';
  var tagged=[];
  (tagRows||[]).forEach(function(row){
    var date=String(row.day_date||'');
    (Array.isArray(row.events)?row.events:[]).forEach(function(event){
      if(!isFinite(Number(event.minute))||event.name==='Note'||event.icon==='✏️') return;
      var tagTime=new Date(date+'T00:00:00Z').getTime()+Number(event.minute)*60000;
      if(tagTime<=eventTime&&tagTime>=eventTime-18*3600000){
        tagged.push({time:tagTime,icon:event.icon||'',name:event.name||'tagged choice',label:(event.icon?event.icon+' ':'')+(event.name||'tagged choice')});
      }
    });
  });
  tagged.sort(function(a,b){return b.time-a.time;});
  var datedEventLabel=weekday+', '+analysisShortDate(day.date)+', in the '+part;
  var displayEventLabel=analysisRelativeDay(day.date,referenceDate)+' '+part;
  var guidance=displayEventLabel+' stood out. ';
  if(tagged.length){
    guidance+='You tagged '+tagged[0].label+' beforehand. We don’t know yet if it helped. If it is safe to repeat, try it again and tag it.';
  }else{
    guidance+='Think back to what was different from '+lookbackPhrase+'. Choose one safe part of that routine to repeat and tag it next time.';
  }
  var evidence='On '+analysisShortDate(day.date)+', your Fat Zone rose from a usual level near '
    +Math.round(Number(episode.baseline)*10)/10+' to '+Math.round(Number(episode.peak)*10)/10+'.';
  return {date:day.date,eventLabel:eventLabel,displayEventLabel:displayEventLabel,datedEventLabel:datedEventLabel,guidance:guidance,evidence:evidence,day:day,tag:tagged[0]||null};
}

function analysisMedian(values){
  var sorted=values.slice().sort(function(a,b){return a-b;});
  var mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}

function findResponseEpisodes(points){
  var episodes=[];
  var DAY_MS=86400000;
  for(var i=0;i<points.length;i++){
    // Establish a personal baseline from recent measurements, not a
    // population-wide fixed breath value.
    var prior=points.slice(Math.max(0,i-7),i).filter(function(p){
      return points[i].time-p.time<=14*DAY_MS;
    });
    if(prior.length<4) continue;
    var baseline=analysisMedian(prior.map(function(p){return p.value;}));

    // A response begins when the signal rises at least two levels above its
    // recent baseline. It is confirmed only if it returns toward that
    // baseline within six readings and 72 hours.
    if(points[i].value<baseline+2) continue;
    var peak=points[i];
    var returned=null;
    var returnIndex=-1;
    for(var j=i+1;j<Math.min(points.length,i+7);j++){
      if(points[j].time-points[i].time>72*3600000) break;
      if(points[j].value>peak.value) peak=points[j];
      if(points[j].value<=baseline+.5){
        returned=points[j];
        returnIndex=j;
        break;
      }
    }
    if(!returned) continue;
    episodes.push({
      peakDate:peak.date,returnDate:returned.date,
      baseline:baseline,peak:peak.value,returned:returned.value,
      amplitude:peak.value-baseline,
      startDate:points[i].date,startTime:points[i].time,startMinute:points[i].minute,
      peakTime:peak.time,peakMinute:peak.minute,
      returnTime:returned.time,returnMinute:returned.minute
    });
    i=returnIndex;
  }
  return episodes;
}

function latestAvailableMeasurementDate(points){
  var latest='';
  (points||[]).forEach(function(point){
    if(point.date&&point.date>latest) latest=point.date;
  });
  if(typeof DAYS!=='undefined'&&Array.isArray(DAYS)){
    DAYS.forEach(function(day){
      if(day&&day.isoDate&&Array.isArray(day.pts)&&day.pts.length&&day.isoDate>latest) latest=day.isoDate;
    });
  }
  return latest||null;
}

function buildHistoricalAnalysis(readingRows,scoreRows){
  var readingsByDay={};
  var allPoints=[];
  (readingRows||[]).forEach(function(row){
    if(!row.reading_ts || !isFinite(Number(row.ppm))) return;
    var date=String(row.reading_ts).slice(0,10);
    if(!readingsByDay[date]) readingsByDay[date]=[];
    var d=new Date(row.reading_ts);
    var point={
      minute:d.getUTCHours()*60+d.getUTCMinutes(),
      value:Number(row.ppm),date:date,time:d.getTime()
    };
    readingsByDay[date].push(point);
    allPoints.push(point);
  });
  allPoints.sort(function(a,b){return a.time-b.time;});
  var responseEpisodes=findResponseEpisodes(allPoints);
  var responseByDay={};
  responseEpisodes.forEach(function(episode){
    var existing=responseByDay[episode.peakDate];
    if(!existing || episode.amplitude>existing.amplitude) responseByDay[episode.peakDate]=episode;
  });

  var scoreByDay={};
  (scoreRows||[]).forEach(function(row){
    if(!row.day_date || !isFinite(Number(row.auc_score))) return;
    var date=String(row.day_date);
    if(date<SCORE_DATE_FIX_CUTOFF) date=addIsoDays(date,1);
    scoreByDay[date]=Number(row.auc_score);
  });

  // The analysis clock stops at the last available measurement. Opening an
  // older device payload later must not create empty days or advance its week.
  var activeDate=latestAvailableMeasurementDate(allPoints);
  if(!activeDate){
    var scoreDates=Object.keys(scoreByDay).sort();
    activeDate=scoreDates.length?scoreDates[scoreDates.length-1]:null;
  }
  var completedWithScore=0;
  var classified=[];
  Object.keys(readingsByDay).sort().forEach(function(date){
    if(date===activeDate || !scoreByDay[date]) return;
    completedWithScore++;
    var pts=readingsByDay[date].sort(function(a,b){return a.minute-b.minute;});
    var span=pts.length>1?pts[pts.length-1].minute-pts[0].minute:0;
    if(pts.length<3 || span<360) return;
    var vals=pts.map(function(p){return p.value;});
    var range=Math.max.apply(null,vals)-Math.min.apply(null,vals);
    var score=scoreByDay[date];
    var level=score<=60?'low':score<=120?'medium':'high';
    var episode=responseByDay[date]||null;
    var movement=episode?'responsive':'steady';
    classified.push({
      date:date,score:score,level:level,movement:movement,
      key:level+'-'+movement,range:range,count:pts.length,span:span,
      responseAmplitude:episode?episode.amplitude:0,responseEpisode:episode
    });
  });
  return {days:classified,completedWithScore:completedWithScore,episodes:responseEpisodes,points:allPoints,activeDate:activeDate};
}

function fox2CsvCell(value){
  if(value===null||value===undefined) return '';
  return '"'+String(value).replace(/"/g,'""')+'"';
}

function fox2CorrectedScores(scoreRows){
  var corrected=(scoreRows||[]).filter(function(row){
    return row.day_date&&isFinite(Number(row.auc_score));
  }).map(function(row){
    var copy={};
    Object.keys(row).forEach(function(key){copy[key]=row[key];});
    copy.day_date=String(row.day_date)<SCORE_DATE_FIX_CUTOFF?addIsoDays(String(row.day_date),1):String(row.day_date);
    return copy;
  });
  var byDay={};
  corrected.forEach(function(row){byDay[row.day_date]=row;});
  return Object.keys(byDay).sort().map(function(day){return byDay[day];});
}

function dailyScoreSeries(scoreRows,activeDate){
  return fox2CorrectedScores(scoreRows).filter(function(row){
    return !activeDate||row.day_date<activeDate;
  }).map(function(row){return {date:row.day_date,score:Number(row.auc_score)};});
}

function scoreWindowSummary(scoreDays,startDate,endDate){
  var days=(scoreDays||[]).filter(function(day){return day.date>=startDate&&day.date<=endDate;});
  var scores=days.map(function(day){return Number(day.score);});
  return {
    startDate:startDate,endDate:endDate,classifiableDays:days.length,days:days,
    metrics:{
      meanScore:scores.length?Math.round(scores.reduce(function(sum,score){return sum+score;},0)/scores.length*10)/10:null,
      medianScore:scores.length?Math.round(analysisMedian(scores)*10)/10:null
    }
  };
}

function dayToDayScoreMovement(scoreDays,startDate,endDate){
  var days=(scoreDays||[]).filter(function(day){
    return day.date>=startDate&&day.date<=endDate&&isFinite(Number(day.score));
  }).slice().sort(function(a,b){return a.date.localeCompare(b.date);});
  var values=days.map(function(day){return Number(day.score);});
  var deltas=[];
  for(var i=1;i<days.length;i++){
    // Missing days are not zeros and are not bridged as if the observations
    // were consecutive.
    if(addIsoDays(days[i-1].date,1)!==days[i].date) continue;
    deltas.push(Number(days[i].score)-Number(days[i-1].score));
  }
  var absoluteChanges=deltas.map(function(delta){return Math.abs(delta);});
  return {
    startDate:startDate,endDate:endDate,dayCount:days.length,pairCount:deltas.length,
    days:days,mean:values.length?Math.round(values.reduce(function(sum,value){return sum+value;},0)/values.length*10)/10:null,
    low:values.length?Math.min.apply(null,values):null,
    high:values.length?Math.max.apply(null,values):null,
    range:values.length?Math.max.apply(null,values)-Math.min.apply(null,values):null,
    medianAbsoluteChange:absoluteChanges.length?Math.round(analysisMedian(absoluteChanges)*10)/10:null,
    meaningfulMoves:deltas.filter(function(delta){return Math.abs(delta)>=15;}).length,
    upwardMoves:deltas.filter(function(delta){return delta>=15;}).length,
    downwardMoves:deltas.filter(function(delta){return delta<=-15;}).length
  };
}

function dayToDayScoreInsight(current,previous){
  if(!current||current.dayCount<2) return null;
  if(previous&&current.dayCount>=4&&previous.dayCount>=4&&
      current.mean>=previous.mean+10&&current.range<=Math.max(0,previous.range-10)){
    return {
      question:'Is the change lasting longer?',
      answer:'Your body may be drawing on fat for energy for more of the day. Look at what your stronger days had in common and choose one safe part to keep.',
      evidence:'Your average Daily Fuel Score went up from '+previous.mean+' to '+current.mean+', and your scores landed in a closer range.',
      tone:'is-change',icon:'↑'
    };
  }
  if(current.range>=15){
    return {
      question:'Is this shift showing up on more days?',
      answer:'Some days suggest your body draws on fat for energy more often than others. Look at what happened before your stronger days and choose one safe part to test again.',
      evidence:'This week, your Daily Fuel Scores ranged from '+current.low+' to '+current.high+'.',
      tone:'is-change',icon:'↑'
    };
  }
  if(current.dayCount>=4){
    return {
      question:'What can I learn from this week?',
      answer:'We’re not seeing a clear shift toward fat for energy yet. Choose one small change you can repeat and tag it each time you try it.',
      evidence:'Your Daily Fuel Scores stayed within a similar range this week.',
      tone:'is-change',icon:'→'
    };
  }
  return null;
}

function analysisAverageScore(days){
  if(!days||!days.length) return null;
  return Math.round(days.reduce(function(sum,day){return sum+Number(day.score);},0)/days.length*10)/10;
}

function analysisRecentProgressInsight(recentScores,previousScores,recentMeasured,previousMeasured){
  var recentAverage=analysisAverageScore(recentScores);
  var previousAverage=analysisAverageScore(previousScores);
  var scoreDelta=recentAverage!==null&&previousAverage!==null?Math.round((recentAverage-previousAverage)*10)/10:null;
  var recentHigher=(recentScores||[]).filter(function(day){return Number(day.score)>120;}).length;
  var recentResponses=(recentMeasured||[]).filter(function(day){return day.movement==='responsive';}).length;
  var previousResponses=(previousMeasured||[]).filter(function(day){return day.movement==='responsive';}).length;
  var scoreEvidence=recentAverage===null?'FOX2 needs a few saved days before it can show how your metabolism is changing.'
    :previousAverage===null?'FOX2 is still building your starting point for a longer-term comparison.'
    :scoreDelta>=8?'Over the last two weeks, your results suggest your body has been using more fat for energy across the day than before.'
    :scoreDelta<=-8?'Over the last two weeks, your results suggest your body has been using less fat for energy across the day than before.'
    :'Your overall fat-use pattern has stayed fairly steady over the last two weeks.';
  if(recentHigher>0) scoreEvidence+=' Some recent days reached the range where body-fat loss may become more likely.';
  if(recentMeasured&&recentMeasured.length&&recentResponses>previousResponses){
    scoreEvidence+=' Your Fat Zone is also rising during more well-measured days than it did before.';
  }

  if(recentAverage===null){
    return {tier:'unknown',headline:'FOX2 is still building your starting point.',answer:'Keep measuring so FOX2 can show where your recent pattern sits and what may help it change.',detail:scoreEvidence,tone:'is-change',icon:'→'};
  }
  if(recentAverage<=60){
    return {
      tier:'low',headline:scoreDelta!==null&&scoreDelta>=5?'You’re beginning to move toward balanced fuel use.':'You’re building toward balanced fuel use.',
      answer:scoreDelta!==null&&scoreDelta>=5?'Your recent results are going up.':'Your body appears to be using relatively little fat for energy across the day.',
      detail:scoreEvidence,tone:'is-change',icon:scoreDelta!==null&&scoreDelta>=5?'↑':'→'
    };
  }
  if(recentAverage<=120){
    var closeToHigher=recentAverage>=105||recentHigher>=2;
    if(closeToHigher){
      return {
        tier:'balanced-near-higher',headline:'You’re getting close to a higher fat-use range.',
        answer:recentHigher?'You’re already reaching it on some days.':'Your recent results are moving toward it.',
        detail:scoreEvidence,tone:'is-change',icon:'↑'
      };
    }
    var balancedDirection=scoreDelta!==null&&scoreDelta>=5?' Your recent results are also beginning to move higher.'
      :scoreDelta!==null&&scoreDelta<=-10?' Your recent results are lower than they were in the two weeks before.'
      :'';
    return {
      tier:'balanced',headline:'You’ve built a steady, balanced fuel pattern.',
      answer:'Your body appears to be using fat regularly for part of its energy needs.'+balancedDirection,
      detail:scoreEvidence,tone:balancedDirection?'is-change':'',icon:balancedDirection?'↑':'✓'
    };
  }
  if(recentAverage<=180){
    return {
      tier:'higher',headline:'You’re spending more time in a higher fat-use range.',
      answer:'This is the range where FOX2 data suggests body-fat loss may become more likely.',
      detail:scoreEvidence,tone:'',icon:'✓'
    };
  }
  return {
    tier:'strong',headline:'Your fat-use pattern is staying very high.',
    answer:'More is not always better. Make sure your routine includes enough food and protein.',
    detail:scoreEvidence,tone:'is-watch',icon:'!'
  };
}

function analysisProgressExplanation(currentWeek,previousWeek,recentMeasured,previousMeasured){
  var sentences=[];
  if(currentWeek&&currentWeek.dayCount&&previousWeek&&previousWeek.dayCount){
    var delta=Number(currentWeek.mean)-Number(previousWeek.mean);
    if(currentWeek.dayCount===1){
      sentences.push(delta>=8
        ?'Your first day this week suggests your body used more fat for energy across the day than it usually did last week.'
        :delta<=-8
          ?'Your first day this week suggests your body used less fat for energy across the day than it usually did last week.'
          :'Your first day this week looks close to your usual pattern from last week.');
      sentences.push('It is still early, so the next few days will show whether that direction lasts.');
    }else{
      sentences.push(delta>=8
        ?'So far this week, your results suggest your body is using more fat for energy across the day than last week.'
        :delta<=-8
          ?'So far this week, your results suggest your body is using less fat for energy across the day than last week.'
          :'So far this week, your body appears to be using about the same amount of fat for energy across the day as last week.');
    }
  }else if(currentWeek&&currentWeek.dayCount){
    sentences.push('FOX2 is still building enough history to show how this week compares with your usual pattern.');
  }

  var recentResponses=(recentMeasured||[]).filter(function(day){return day.movement==='responsive';}).length;
  var previousResponses=(previousMeasured||[]).filter(function(day){return day.movement==='responsive';}).length;
  var recentRate=recentMeasured&&recentMeasured.length?recentResponses/recentMeasured.length:0;
  var previousRate=previousMeasured&&previousMeasured.length?previousResponses/previousMeasured.length:0;
  if(recentResponses&&recentRate>previousRate+.15){
    sentences.push('The encouraging part is that your Fat Zone is rising during more days than before. That suggests your metabolism is responding to something in your routine.');
  }else if(recentResponses){
    sentences.push('The encouraging part is that your Fat Zone still rises during the day. That shows your metabolism can respond, even if the higher results are not lasting as long yet.');
  }else if(sentences.length){
    sentences.push('The next sign of progress would be higher Fat Zones showing up more often or lasting longer.');
  }
  return sentences.join(' ');
}

function analysisRecentScoreOpportunity(scoreDays,referenceDate,tagRows,recentAverage){
  if(!referenceDate||!scoreDays||!scoreDays.length||recentAverage===null) return null;
  var oldestDate=addIsoDays(referenceDate,-5);
  var candidates=scoreDays.filter(function(day){return day.date>=oldestDate&&day.date<referenceDate;}).slice().sort(function(a,b){
    return Number(b.score)-Number(a.score)||b.date.localeCompare(a.date);
  });
  if(!candidates.length) return null;
  var best=candidates[0];
  if(Number(best.score)<=120&&Number(best.score)<recentAverage+10) return null;
  var tag=null;
  var names={'🍎':'Snack','🍽️':'Meal','🥩':'Protein','💧':'Hydration','🍳':'Low carb','🍕':'High carb','🍷':'Alcohol','🚶':'Walk','🏃':'Run','🏋️':'Workout','⏱️':'Fasting','😴':'Poor sleep','🧠':'Stress','💉':'GLP-1'};
  (tagRows||[]).filter(function(row){return String(row.day_date||'')===best.date;}).some(function(row){
    var event=(Array.isArray(row.events)?row.events:[]).filter(function(item){return item.name!=='Note'&&item.icon!=='✏️';})[0];
    if(event){tag={icon:event.icon||'',name:event.name||names[event.icon]||'tagged choice'};return true;}
    var icon=(Array.isArray(row.tray_tags)?row.tray_tags:[]).filter(function(item){return item!=='✏️';})[0];
    if(icon){tag={icon:icon,name:names[icon]||'tagged choice'};return true;}
    return false;
  });
  var label=analysisRelativeDay(best.date,referenceDate);
  var answer=Number(best.score)>120
    ?'Your result reached a higher fat-use range that day. '
    :'Your result moved closer to a higher fat-use range that day. ';
  if(tag){
    answer+='You tagged '+(tag.icon?tag.icon+' ':'')+tag.name+'. We don’t know yet if it helped. If it is safe to repeat, try it again and tag it.';
  }else{
    answer+='Think about what was different beforehand. Choose one safe part of that routine to repeat and tag it next time.';
  }
  return {
    date:best.date,title:label+' was one of your stronger days.',answer:answer,
    detail:'The Daily Fuel Score on '+analysisWeekday(best.date)+', '+analysisShortDate(best.date)+' was '+best.score+', compared with a recent average of '+recentAverage+'.',
    tag:tag
  };
}

function analysisEscape(value){
  return String(value===null||value===undefined?'':value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function compactEvidenceLine(items,ariaLabel,leftLabel,rightLabel,options){
  if(!items||items.length<2) return '';
  options=options||{};
  var values=items.map(function(item){return Number(item.value);}).filter(function(value){return isFinite(value);});
  if(values.length<2) return '';
  var w=280,h=62,left=5,right=5,top=13,bottom=7;
  var min=Math.min.apply(null,values),max=Math.max.apply(null,values);
  var pad=Math.max(1,(max-min)*.18);
  var low=min-pad,high=max+pad;
  var xMin=Number(items[0].x),xMax=Number(items[items.length-1].x);
  if(xMax===xMin) xMax=xMin+1;
  var x=function(value){return left+(Number(value)-xMin)*(w-left-right)/(xMax-xMin);};
  var y=function(value){return top+(high-Number(value))*(h-top-bottom)/(high-low);};
  var points=items.map(function(item){return x(item.x).toFixed(1)+','+y(item.value).toFixed(1);}).join(' ');
  var labels=items.length<=7?items.map(function(item){
    return '<text x="'+x(item.x).toFixed(1)+'" y="'+Math.max(9,y(item.value)-6).toFixed(1)+'" text-anchor="middle" font-size="8.5" font-weight="800" fill="rgba(255,255,255,.68)">'+Math.round(Number(item.value)*10)/10+'</text>';
  }).join(''):'';
  var comparisonSplit=isFinite(Number(options.comparisonSplit))?Number(options.comparisonSplit):null;
  var dots=items.map(function(item,index){
    var latest=comparisonSplit!==null&&index>=comparisonSplit;
    var color=latest?'#FFD23C':'#22D3EE';
    var ring=comparisonSplit===null?'':'<circle cx="'+x(item.x).toFixed(1)+'" cy="'+y(item.value).toFixed(1)+'" r="6" fill="none" stroke="'+color+'" stroke-width="1.7" opacity=".9"/>';
    return ring+'<circle cx="'+x(item.x).toFixed(1)+'" cy="'+y(item.value).toFixed(1)+'" r="2.9" fill="'+color+'"><title>'+analysisEscape(item.title||item.value)+'</title></circle>';
  }).join('');
  var meta=comparisonSplit===null
    ?'<div class="analysis-mini-meta"><span>'+analysisEscape(leftLabel)+'</span><span>'+analysisEscape(rightLabel)+'</span></div>'
    :'<div class="analysis-mini-meta"><span style="color:#22D3EE">◯ '+analysisEscape(leftLabel)+'</span><span style="color:#FFD23C">◯ '+analysisEscape(rightLabel)+'</span></div>';
  return '<div class="analysis-insight-visual"><svg class="analysis-mini-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+analysisEscape(ariaLabel)+'">'
    +'<line x1="'+left+'" y1="'+(h-bottom)+'" x2="'+(w-right)+'" y2="'+(h-bottom)+'" stroke="rgba(255,255,255,.08)"/>'
    +'<polyline points="'+points+'" fill="none" stroke="'+(comparisonSplit===null?'#22D3EE':'rgba(255,255,255,.34)')+'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
    +dots+labels+'</svg>'+meta+'</div>';
}

function dailyScoreEvidenceSvg(days,label){
  var recent=(days||[]).slice(-7);
  if(recent.length<2) return '';
  var items=recent.map(function(day,index){
    return {x:index,value:Number(day.score),title:day.date+': Daily Fuel Score '+day.score};
  });
  return compactEvidenceLine(items,label||'Recent Daily Fuel Scores',recent[0].date.slice(5),recent[recent.length-1].date.slice(5));
}

function dailyScoreRecoveryEvidenceSvg(days,label){
  var recent=(days||[]).slice(-7);
  if(recent.length<3) return dailyScoreEvidenceSvg(recent,label);
  var items=recent.map(function(day,index){
    return {x:index,value:Number(day.score),title:day.date+': Daily Fuel Score '+day.score};
  });
  return compactEvidenceLine(items,label||'Daily Fuel Scores this week','Earlier days','Latest two days',{comparisonSplit:recent.length-2});
}

function withinDayEvidenceSvg(days,points){
  var responsive=(days||[]).filter(function(day){return day.movement==='responsive';});
  var pool=responsive.slice().sort(function(a,b){return b.date.localeCompare(a.date);});
  var chosen=null,sameDay=null,baseline=null;
  for(var candidateIndex=0;candidateIndex<pool.length;candidateIndex++){
    var candidateBaseline=pool[candidateIndex].responseEpisode&&Number(pool[candidateIndex].responseEpisode.baseline);
    if(!isFinite(candidateBaseline)) continue;
    var candidatePoints=(points||[]).filter(function(point){return point.date===pool[candidateIndex].date;}).sort(function(a,b){return a.minute-b.minute;});
    if(candidatePoints.length<2) continue;
    var candidatePeak=Math.max.apply(null,candidatePoints.map(function(point){return Number(point.value);}));
    if(candidatePeak>=Number(candidatePoints[0].value)+.5&&candidatePeak>=candidateBaseline+2){
      chosen=pool[candidateIndex];
      sameDay=candidatePoints;
      baseline=candidateBaseline;
      break;
    }
  }
  if(!chosen||!sameDay) return '';
  function timeLabel(minute){
    var hour=Math.floor(minute/60),minutes=Math.round(minute%60);
    var suffix=hour>=12?'pm':'am';
    var shown=hour%12||12;
    return shown+':'+String(minutes).padStart(2,'0')+suffix;
  }
  var peak=sameDay.reduce(function(best,point){return point.value>best.value?point:best;},sameDay[0]);
  var values=sameDay.map(function(point){return Number(point.value);}).concat([baseline]);
  var min=Math.min.apply(null,values),max=Math.max.apply(null,values);
  var pad=Math.max(.75,(max-min)*.22);
  var low=min-pad,high=max+pad;
  var w=300,h=126,left=8,right=8,top=25,bottom=22;
  var xMin=sameDay[0].minute,xMax=sameDay[sameDay.length-1].minute;
  var x=function(value){return left+(Number(value)-xMin)*(w-left-right)/(xMax-xMin);};
  var y=function(value){return top+(high-Number(value))*(h-top-bottom)/(high-low);};
  var coords=sameDay.map(function(point){return {x:x(point.minute),y:y(point.value),point:point};});
  var path='M '+coords[0].x.toFixed(1)+' '+coords[0].y.toFixed(1);
  if(coords.length===2){
    path+=' L '+coords[1].x.toFixed(1)+' '+coords[1].y.toFixed(1);
  }else{
    for(var curveIndex=1;curveIndex<coords.length-1;curveIndex++){
      var midX=(coords[curveIndex].x+coords[curveIndex+1].x)/2;
      var midY=(coords[curveIndex].y+coords[curveIndex+1].y)/2;
      path+=' Q '+coords[curveIndex].x.toFixed(1)+' '+coords[curveIndex].y.toFixed(1)+' '+midX.toFixed(1)+' '+midY.toFixed(1);
    }
    path+=' Q '+coords[coords.length-2].x.toFixed(1)+' '+coords[coords.length-2].y.toFixed(1)+' '+coords[coords.length-1].x.toFixed(1)+' '+coords[coords.length-1].y.toFixed(1);
  }
  var baselineY=y(baseline);
  var bandTop=y(baseline+.25),bandBottom=y(baseline-.25);
  var clipId='fox2-rise-'+chosen.date.replace(/-/g,'');
  var dots=coords.map(function(coord){
    var raised=Number(coord.point.value)>baseline+.5;
    return '<circle cx="'+coord.x.toFixed(1)+'" cy="'+coord.y.toFixed(1)+'" r="4" fill="'+(raised?'#FFD23C':'#22D3EE')+'" stroke="#08090b" stroke-width="2"><title>'+timeLabel(coord.point.minute)+': level '+coord.point.value+'</title></circle>';
  }).join('');
  var peakX=x(peak.minute),peakY=y(peak.value);
  var calloutX=Math.max(72,Math.min(w-72,peakX));
  var aria='Fat Zone measurements across '+chosen.date+' rose from a usual level of '+baseline+' to '+peak.value;
  return '<div class="analysis-insight-visual"><svg class="analysis-mini-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+analysisEscape(aria)+'">'
    +'<defs><clipPath id="'+clipId+'"><rect x="0" y="0" width="'+w+'" height="'+Math.max(0,baselineY)+'"/></clipPath></defs>'
    +'<rect x="'+left+'" y="'+top+'" width="'+(w-left-right)+'" height="'+Math.max(0,baselineY-top)+'" rx="10" fill="rgba(255,210,60,.045)"/>'
    +'<rect x="'+left+'" y="'+Math.min(bandTop,bandBottom).toFixed(1)+'" width="'+(w-left-right)+'" height="'+Math.max(8,Math.abs(bandBottom-bandTop)).toFixed(1)+'" rx="4" fill="rgba(34,211,238,.1)"/>'
    +'<text x="'+(left+7)+'" y="'+(baselineY+4).toFixed(1)+'" font-size="11" font-weight="800" fill="rgba(255,255,255,.48)">Your usual level</text>'
    +'<path d="'+path+'" fill="none" stroke="#22D3EE" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    +'<path d="'+path+'" fill="none" stroke="#FFD23C" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#'+clipId+')"/>'
    +'<line x1="'+calloutX.toFixed(1)+'" y1="18" x2="'+peakX.toFixed(1)+'" y2="'+Math.max(22,peakY-6).toFixed(1)+'" stroke="rgba(255,210,60,.55)" stroke-width="1.2"/>'
    +'<rect x="'+(calloutX-68).toFixed(1)+'" y="2" width="136" height="20" rx="10" fill="rgba(255,210,60,.14)" stroke="rgba(255,210,60,.38)"/>'
    +'<text x="'+calloutX.toFixed(1)+'" y="15.5" text-anchor="middle" font-size="10.5" font-weight="900" fill="#FFD23C">Your Fat Zone went up</text>'
    +dots
    +'<text x="'+left+'" y="'+(h-4)+'" font-size="10.5" fill="rgba(255,255,255,.4)">'+timeLabel(sameDay[0].minute)+'</text>'
    +'<text x="'+(w-right)+'" y="'+(h-4)+'" text-anchor="end" font-size="10.5" fill="rgba(255,255,255,.4)">'+timeLabel(sameDay[sameDay.length-1].minute)+'</text>'
    +'</svg><div class="analysis-response-caption">One-day example · '+analysisShortDate(chosen.date)+' · These measurements rose above your usual level.</div></div>';
}

function tagEvidenceHtml(insight){
  var evidence=insight&&insight.evidence;
  if(!evidence) return '';
  if(evidence.kind==='immediate'){
    var pct=Math.round(evidence.rate*100);
    return '<div class="analysis-insight-visual analysis-mini-bar"><div class="analysis-mini-bar-track"><div class="analysis-mini-bar-fill" style="width:'+pct+'%"></div></div><div class="analysis-mini-meta"><span>'+analysisEscape(evidence.stat.name)+' tags followed by more fat use</span><span>'+evidence.stat.rises+' of '+evidence.stat.eligible+'</span></div></div>';
  }
  if(!isFinite(Number(evidence.comparisonMedian))||!isFinite(Number(evidence.taggedMedian))) return '';
  return compactEvidenceLine([
    {x:0,value:evidence.comparisonMedian,title:'Other days: '+evidence.comparisonMedian},
    {x:1,value:evidence.taggedMedian,title:'Tagged days: '+evidence.taggedMedian}
  ],'How the tagged days compared with other recent days','Other days',analysisEscape(evidence.stat.name)+' days');
}

function tagInsightTimeframe(insight){
  var evidence=insight&&insight.evidence;
  if(!evidence) return 'Building your history';
  if(evidence.kind==='immediate') return 'Repeated choice · '+evidence.stat.eligible+' occasions';
  return 'Repeated choice · '+evidence.count+' days';
}

function analysisWhyHtml(detail,visual){
  if(!detail&&!visual) return '';
  return '<details class="analysis-why"><summary>Why FOX2 says this</summary>'
    +(detail?'<p>'+analysisEscape(detail)+'</p>':'')
    +(visual||'')+'</details>';
}

function analysisTierGuideHtml(insight,recentAverage,timeframe){
  if(!insight||!isFinite(Number(recentAverage))) return '';
  var average=Number(recentAverage);
  var markerPct=average<=60?average/60*25
    :average<=120?25+(average-60)/60*25
    :average<=180?50+(average-120)/60*25
    :75+Math.min(1,(average-180)/60)*25;
  markerPct=Math.max(2,Math.min(98,markerPct));
  var activeTier=insight.tier==='balanced-near-higher'?'balanced':insight.tier;
  var tierHeadline=activeTier==='low'?'Your recent pattern is in low fuel use.'
    :activeTier==='balanced'?'Your recent pattern is in balanced fuel use.'
    :activeTier==='higher'?'Your recent pattern is in higher fat use.'
    :'Your recent pattern is in strong fat use.';
  var positionCopy=insight.tier==='balanced-near-higher'
    ?'Your recent pattern is in balanced fuel use and close to the higher range.'
    :activeTier==='low'?'Your recent pattern is building toward balanced fuel use.'
    :activeTier==='balanced'?'Your recent pattern is in balanced fuel use.'
    :activeTier==='higher'?'Your recent pattern is in higher fat use.'
    :'Your recent pattern is in strong fat use.';
  var ranges=[
    {key:'low',name:'Low',copy:'Building toward balanced fuel use.'},
    {key:'balanced',name:'Balanced',copy:'Uses fat regularly and may support maintenance.'},
    {key:'higher',name:'Higher',copy:'Body-fat loss may become more likely.'},
    {key:'strong',name:'Strong',copy:'High and sustained; more is not always better.'}
  ];
  var definitions=ranges.map(function(range){
    return '<div class="analysis-tier-definition '+(range.key===activeTier?'is-active':'')+'"><strong>'+range.name+'</strong><span>'+range.copy+'</span></div>';
  }).join('');
  return '<section class="analysis-card analysis-tier-card analysis-hero">'
    +(timeframe?'<div class="analysis-eyebrow">'+analysisEscape(timeframe)+'</div>':'')
    +'<h1 class="analysis-title">'+tierHeadline+'</h1>'
    +'<p class="analysis-section-copy">'+positionCopy+'</p>'
    +'<div class="analysis-tier-scale" role="img" aria-label="Your recent Daily Fuel Score is in the '+analysisEscape(activeTier)+' fuel-use range">'
      +'<div class="analysis-tier-marker" style="left:'+markerPct.toFixed(1)+'%"><span>'+(insight.tier==='balanced-near-higher'?'Close to higher':'You are here')+'</span></div>'
      +'<div class="analysis-tier-segment is-low"></div><div class="analysis-tier-segment is-balanced"></div><div class="analysis-tier-segment is-higher"></div><div class="analysis-tier-segment is-strong"></div>'
    +'</div>'
    +'<div class="analysis-tier-names"><span>Low</span><span>Balanced</span><span>Higher</span><span>Strong</span></div>'
    +'<details class="analysis-why"><summary>How FOX2 defines these ranges</summary>'
      +'<p>FOX2 places you here using the average of your saved Daily Fuel Scores from the 14 completed calendar days before your latest measurement. Days without a saved score are left out.</p>'
      +'<div class="analysis-tier-definitions">'+definitions+'</div>'
      +'<p>Low is 0–60. Balanced is above 60 through 120. Higher is above 120 through 180. Strong is above 180. These are FOX2 probability ranges, not clinical cutoffs or guarantees.</p>'
    +'</details>'
  +'</section>';
}

function fox2DownloadCsv(filename,rows){
  var blob=new Blob(['\ufeff'+rows.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var link=document.createElement('a');
  link.href=url;
  link.download=filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
}

function fox2ExportContext(){
  var data=window._fox2ExportData||{readings:[],scores:[]};
  var deviceId=(new URLSearchParams(window.location.search).get('id')||'device').replace(/[^A-Za-z0-9_-]/g,'');
  var latest=data.readings.reduce(function(value,row){
    var date=row.reading_ts?String(row.reading_ts).slice(0,10):'';
    return date>value?date:value;
  },'')||new Date().toISOString().slice(0,10);
  return {data:data,deviceId:deviceId,latest:latest,scores:fox2CorrectedScores(data.scores)};
}

function openExportModal(){
  document.getElementById('export-modal-overlay').classList.add('open');
}

function closeExportModal(){
  document.getElementById('export-modal-overlay').classList.remove('open');
}

function downloadFox2MeasurementsCsv(){
  var context=fox2ExportContext();
  var scoreByDay={};
  context.scores.forEach(function(row){scoreByDay[row.day_date]=row;});
  var header=['row_type','device_id','patient_id','clinic_id','reading_timestamp','day_date','ppm','daily_auc','target_auc','reading_payload_version','auc_payload_version'];
  var rows=[header.map(fox2CsvCell).join(',')];
  context.data.readings.slice().sort(function(a,b){return String(a.reading_ts).localeCompare(String(b.reading_ts));}).forEach(function(row){
    var day=String(row.reading_ts||'').slice(0,10);
    var daily=scoreByDay[day]||{};
    rows.push([
      'measurement',context.deviceId,row.patient_id||daily.patient_id||'',row.clinic_id||daily.clinic_id||'',
      row.reading_ts||'',day,row.ppm,daily.auc_score,
      row.target_auc||daily.target_auc||'',row.payload_ver||'',daily.payload_ver||''
    ].map(fox2CsvCell).join(','));
  });
  fox2DownloadCsv('fox2_'+context.deviceId+'_data_'+context.latest+'.csv',rows);
  closeExportModal();
}

function downloadFox2DailyScoresCsv(){
  var context=fox2ExportContext();
  var rows=[[fox2CsvCell('day_date'),fox2CsvCell('daily_auc')].join(',')];
  context.scores.forEach(function(row){rows.push([row.day_date,row.auc_score].map(fox2CsvCell).join(','));});
  fox2DownloadCsv('fox2_'+context.deviceId+'_daily_auc_'+context.latest+'.csv',rows);
  closeExportModal();
}

function analysisRate(days){
  if(!days.length) return 0;
  return days.filter(function(d){return d.movement==='responsive';}).length/days.length;
}

function analysisDominantLevel(days){
  var counts={low:0,medium:0,high:0};
  days.forEach(function(d){counts[d.level]++;});
  var best=days.length?days[days.length-1].level:'medium';
  ['low','medium','high'].forEach(function(level){
    if(counts[level]>counts[best]) best=level;
  });
  return {level:best,count:counts[best],counts:counts};
}

function analysisMovementLabel(rate){
  if(rate>=.65) return 'Responsive';
  if(rate<=.35) return 'Steady';
  return 'Mixed';
}

function analysisPct(rate){return Math.round(rate*100)+'%';}

function measurementResponseSvg(points,episodes){
  var w=360,h=178,left=29,right=8,top=13,bottom=28;
  var pw=w-left-right,ph=h-top-bottom;
  if(!points.length) return '';
  var minT=points[0].time,maxT=points[points.length-1].time;
  var maxV=Math.max.apply(null,points.map(function(p){return p.value;}).concat([8]));
  var yMax=Math.ceil(maxV/2)*2;
  var x=function(t){return left+(maxT===minT?pw/2:(t-minT)/(maxT-minT)*pw);};
  var y=function(v){return top+ph-(v/yMax)*ph;};
  var paths=[];
  var current=[];
  points.forEach(function(p,i){
    if(i&&p.time-points[i-1].time>4*86400000){if(current.length)paths.push(current);current=[];}
    current.push(x(p.time).toFixed(1)+','+y(p.value).toFixed(1));
  });
  if(current.length) paths.push(current);
  var peakTimes={};
  var returnTimes={};
  episodes.forEach(function(e){peakTimes[e.peakTime]=true;returnTimes[e.returnTime]=true;});
  var lines=paths.map(function(path){return '<polyline points="'+path.join(' ')+'" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';}).join('');
  var dots=points.map(function(p){
    var isPeak=peakTimes[p.time],isReturn=returnTimes[p.time];
    var fill=isPeak?'#FFD23C':isReturn?'#22D3EE':'rgba(255,255,255,.58)';
    var r=isPeak||isReturn?3.2:1.7;
    return '<circle cx="'+x(p.time).toFixed(1)+'" cy="'+y(p.value).toFixed(1)+'" r="'+r+'" fill="'+fill+'"><title>'+p.date+': level '+p.value+(isPeak?' response peak':isReturn?' return':'')+'</title></circle>';
  }).join('');
  return '<svg class="analysis-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Individual FOX2 measurements with confirmed response peaks and returns">'
    +'<line x1="'+left+'" y1="'+y(4)+'" x2="'+(left+pw)+'" y2="'+y(4)+'" stroke="rgba(255,255,255,.08)" stroke-dasharray="3 4"/>'
    +'<text x="'+(left-6)+'" y="'+(y(4)+4)+'" text-anchor="end" font-size="10" fill="rgba(255,255,255,.35)">4</text>'
    +lines+dots
    +'<text x="'+left+'" y="'+(h-7)+'" font-size="10" fill="rgba(255,255,255,.4)">'+points[0].date.slice(5)+'</text>'
    +'<text x="'+(left+pw)+'" y="'+(h-7)+'" text-anchor="end" font-size="10" fill="rgba(255,255,255,.4)">'+points[points.length-1].date.slice(5)+'</text>'
    +'</svg>';
}

function scoreTrendSvg(days,recentStartDate){
  var w=360,h=190,left=34,right=8,top=13,bottom=28;
  var pw=w-left-right,ph=h-top-bottom;
  var maxScore=Math.max.apply(null,days.map(function(d){return d.score;}).concat([180]));
  var maxY=Math.ceil(maxScore/30)*30;
  var x=function(i){return left+(days.length===1?pw/2:i*pw/(days.length-1));};
  var y=function(v){return top+ph-(Math.min(v,maxY)/maxY)*ph;};
  var recentStart=recentStartDate?days.findIndex(function(day){return day.date>=recentStartDate;}):Math.max(0,days.length-14);
  if(recentStart<0) recentStart=0;
  var recentX=x(recentStart);
  var path=days.map(function(d,i){return x(i).toFixed(1)+','+y(d.score).toFixed(1);}).join(' ');
  var circles=days.map(function(d,i){
    var level=d.level||(Number(d.score)<=60?'low':Number(d.score)<=120?'medium':'high');
    var fill=level==='low'?'#22D3EE':level==='medium'?'#4ADE80':'#C084FC';
    return '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(d.score).toFixed(1)+'" r="'+(i===days.length-1?3.8:2.2)+'" fill="'+fill+'"><title>'+d.date+': '+d.score+'</title></circle>';
  }).join('');
  return '<svg class="analysis-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Daily Fuel Score across complete saved history">'
    +'<rect x="'+left+'" y="'+y(60)+'" width="'+pw+'" height="'+(y(0)-y(60))+'" fill="rgba(34,211,238,.07)"/>'
    +'<rect x="'+left+'" y="'+y(120)+'" width="'+pw+'" height="'+(y(60)-y(120))+'" fill="rgba(74,222,128,.08)"/>'
    +'<rect x="'+left+'" y="'+top+'" width="'+pw+'" height="'+(y(120)-top)+'" fill="rgba(168,85,247,.08)"/>'
    +'<rect x="'+recentX.toFixed(1)+'" y="'+top+'" width="'+(left+pw-recentX).toFixed(1)+'" height="'+ph+'" fill="rgba(255,210,60,.035)" stroke="rgba(255,210,60,.2)" stroke-width="1"/>'
    +'<line x1="'+left+'" y1="'+y(60)+'" x2="'+(left+pw)+'" y2="'+y(60)+'" stroke="rgba(255,255,255,.12)" stroke-dasharray="3 4"/>'
    +'<line x1="'+left+'" y1="'+y(120)+'" x2="'+(left+pw)+'" y2="'+y(120)+'" stroke="rgba(255,255,255,.12)" stroke-dasharray="3 4"/>'
    +'<text x="'+(left-7)+'" y="'+(y(60)+4)+'" text-anchor="end" font-size="10" fill="rgba(255,255,255,.38)">60</text>'
    +'<text x="'+(left-7)+'" y="'+(y(120)+4)+'" text-anchor="end" font-size="10" fill="rgba(255,255,255,.38)">120</text>'
    +'<polyline points="'+path+'" fill="none" stroke="rgba(255,255,255,.62)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    +circles
    +'<text x="'+left+'" y="'+(h-7)+'" font-size="10" fill="rgba(255,255,255,.4)">'+days[0].date.slice(5)+'</text>'
    +'<text x="'+(left+pw)+'" y="'+(h-7)+'" text-anchor="end" font-size="10" fill="rgba(255,255,255,.4)">'+days[days.length-1].date.slice(5)+'</text>'
    +'<text x="'+(left+pw-4)+'" y="'+(top+12)+'" text-anchor="end" font-size="10" fill="rgba(255,210,60,.68)">last 14 days</text>'
    +'</svg>';
}

function weeklyTrendSeries(scoreDays,classifiableDays,week,weekCount){
  if(!week||!week.startDate) return [];
  var count=weekCount||8;
  var result=[];
  for(var i=count-1;i>=0;i--){
    var startDate=addIsoDays(week.startDate,-7*i);
    var endDate=i===0?week.throughDate:addIsoDays(startDate,6);
    var scores=(scoreDays||[]).filter(function(day){return day.date>=startDate&&day.date<=endDate;});
    var values=scores.map(function(day){return Number(day.score);});
    var assessable=(classifiableDays||[]).filter(function(day){return day.date>=startDate&&day.date<=endDate;});
    var responsive=assessable.filter(function(day){return day.movement==='responsive';}).length;
    var dayToDay=dayToDayScoreMovement(scoreDays,startDate,endDate);
    result.push({
      startDate:startDate,endDate:endDate,current:i===0,days:values.length,
      mean:values.length?Math.round(values.reduce(function(sum,value){return sum+value;},0)/values.length*10)/10:null,
      low:values.length?Math.min.apply(null,values):null,
      high:values.length?Math.max.apply(null,values):null,
      assessableDays:assessable.length,responsiveDays:responsive,
      responseRate:assessable.length?responsive/assessable.length:null,
      consecutiveDayPairs:dayToDay.pairCount,medianDayToDayChange:dayToDay.medianAbsoluteChange
    });
  }
  return result;
}

function weeklyTrendSummary(weeks){
  if(!weeks||!weeks.length) return '';
  var current=weeks[weeks.length-1];
  var previous=null;
  for(var i=weeks.length-2;i>=0;i--){
    if(weeks[i].mean!==null){
      previous=weeks[i];
      break;
    }
  }
  if(current.mean!==null&&previous){
    var delta=Math.round((current.mean-previous.mean)*10)/10;
    var difference=Math.abs(delta);
    var comparison=difference<5
      ?'close to last week’s average of '+previous.mean
      :'about '+difference+' points '+(delta>0?'above':'below')+' last week’s average of '+previous.mean;
    return 'This week’s average is '+current.mean+' so far—'+comparison+'.';
  }
  if(current.mean!==null) return 'This week’s average is '+current.mean+' so far. More weeks will make the trend clearer.';
  if(previous) return 'This week does not yet have a completed Daily Fuel Score. The latest completed week averaged '+previous.mean+'.';
  return 'More completed Daily Fuel Scores are needed to show a weekly trend.';
}

function weeklyTrendHtml(scoreDays,classifiableDays,week){
  var weeks=weeklyTrendSeries(scoreDays,classifiableDays,week,8);
  var plotted=weeks.filter(function(item){return item.mean!==null;});
  if(!plotted.length) return '';
  var values=[];
  plotted.forEach(function(item){values.push(item.low,item.high,item.mean);});
  var w=360,h=210,left=32,right=9,top=22,bottom=38;
  var pw=w-left-right,ph=h-top-bottom;
  var maxY=Math.ceil(Math.max.apply(null,values.concat([180]))/30)*30;
  var x=function(index){return left+index*pw/(weeks.length-1);};
  var y=function(value){return top+ph-(Math.min(value,maxY)/maxY)*ph;};
  var responseColor=function(rate){
    if(rate===null) return '#64748B';
    if(rate<.34) return '#22D3EE';
    if(rate<.67) return '#4ADE80';
    return '#C084FC';
  };
  var segments='';
  for(var i=1;i<weeks.length;i++){
    if(weeks[i-1].mean===null||weeks[i].mean===null) continue;
    segments+='<line x1="'+x(i-1).toFixed(1)+'" y1="'+y(weeks[i-1].mean).toFixed(1)+'" x2="'+x(i).toFixed(1)+'" y2="'+y(weeks[i].mean).toFixed(1)+'" stroke="rgba(255,255,255,.62)" stroke-width="2"/>';
  }
  var marks=weeks.map(function(item,index){
    var cx=x(index);
    var label=Number(item.startDate.slice(5,7))+'/'+Number(item.startDate.slice(8,10));
    var dateLabel='<text x="'+cx.toFixed(1)+'" y="'+(h-8)+'" text-anchor="middle" font-size="8.5" fill="rgba(255,255,255,.42)">'+label+'</text>';
    if(item.mean===null){
      return '<circle cx="'+cx.toFixed(1)+'" cy="'+(top+ph+1)+'" r="1.8" fill="rgba(255,255,255,.16)"><title>'+item.startDate+': no completed scores</title></circle>'+dateLabel;
    }
    var cy=y(item.mean),lowY=y(item.low),highY=y(item.high);
    var color=responseColor(item.responseRate);
    var status=item.current?' · incomplete week':'';
    var responsiveness=item.assessableDays?item.responsiveDays+' of '+item.assessableDays+' well-measured days had a clear rise and return':'not enough readings to compare changes within the day';
    var dayToDay=item.medianDayToDayChange===null?'day-to-day change not available':'typical day-to-day change '+item.medianDayToDayChange;
    var title=item.startDate+' to '+item.endDate+': average '+item.mean+', range '+item.low+'–'+item.high+', '+dayToDay+', '+responsiveness+status;
    var outer=item.current?'<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="6.7" fill="none" stroke="#FFD23C" stroke-width="1.5"/>':'';
    return '<line x1="'+cx.toFixed(1)+'" y1="'+highY.toFixed(1)+'" x2="'+cx.toFixed(1)+'" y2="'+lowY.toFixed(1)+'" stroke="rgba(255,255,255,.45)" stroke-width="1.4"/>'
      +'<line x1="'+(cx-4).toFixed(1)+'" y1="'+highY.toFixed(1)+'" x2="'+(cx+4).toFixed(1)+'" y2="'+highY.toFixed(1)+'" stroke="rgba(255,255,255,.45)"/>'
      +'<line x1="'+(cx-4).toFixed(1)+'" y1="'+lowY.toFixed(1)+'" x2="'+(cx+4).toFixed(1)+'" y2="'+lowY.toFixed(1)+'" stroke="rgba(255,255,255,.45)"/>'
      +outer+'<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="4.2" fill="'+color+'"><title>'+title+'</title></circle>'
      +'<text x="'+cx.toFixed(1)+'" y="'+Math.max(10,cy-9).toFixed(1)+'" text-anchor="middle" font-size="9" font-weight="800" fill="rgba(255,255,255,.82)">'+item.mean+'</text>'+dateLabel;
  }).join('');
  return '<section class="analysis-card"><h2 class="analysis-section-title">Your last 8 weeks</h2>'
    +'<p class="analysis-section-copy">'+weeklyTrendSummary(weeks)+' Each point is a weekly average. The lines show the lowest and highest day. Color shows how often your Fat Zone clearly went up and came back down during a day.</p>'
    +'<svg class="analysis-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Eight-week Daily Fuel Score trend with weekly ranges and within-day changes">'
      +'<rect x="'+left+'" y="'+y(60)+'" width="'+pw+'" height="'+(y(0)-y(60))+'" fill="rgba(34,211,238,.05)"/>'
      +'<rect x="'+left+'" y="'+y(120)+'" width="'+pw+'" height="'+(y(60)-y(120))+'" fill="rgba(74,222,128,.055)"/>'
      +'<rect x="'+left+'" y="'+top+'" width="'+pw+'" height="'+(y(120)-top)+'" fill="rgba(168,85,247,.055)"/>'
      +'<line x1="'+left+'" y1="'+y(60)+'" x2="'+(left+pw)+'" y2="'+y(60)+'" stroke="rgba(255,255,255,.1)"/><line x1="'+left+'" y1="'+y(120)+'" x2="'+(left+pw)+'" y2="'+y(120)+'" stroke="rgba(255,255,255,.1)"/>'
      +'<text x="'+(left-6)+'" y="'+(y(60)+3)+'" text-anchor="end" font-size="9" fill="rgba(255,255,255,.35)">60</text><text x="'+(left-6)+'" y="'+(y(120)+3)+'" text-anchor="end" font-size="9" fill="rgba(255,255,255,.35)">120</text>'
      +segments+marks
    +'</svg>'
    +'<div class="analysis-legend"><span class="analysis-legend-item"><span class="analysis-legend-dot" style="background:#22D3EE"></span>Little within-day movement</span><span class="analysis-legend-item"><span class="analysis-legend-dot" style="background:#4ADE80"></span>Some within-day movement</span><span class="analysis-legend-item"><span class="analysis-legend-dot" style="background:#C084FC"></span>Frequent within-day movement</span><span class="analysis-legend-item"><span class="analysis-legend-dot" style="background:#64748B"></span>Not enough readings</span><span class="analysis-legend-item"><span class="analysis-legend-dot" style="background:#FFD23C"></span>Current week</span></div>'
  +'</section>';
}

function renderAnalysisBar(label,days){
  var rate=analysisRate(days);
  return '<div><div class="analysis-bar-head"><span>'+label+'</span><strong>'+analysisPct(rate)+'</strong></div>'
    +'<div class="analysis-bar-track"><div class="analysis-bar-fill" style="width:'+analysisPct(rate)+'"></div></div></div>';
}

function scoreRangeDistributionHtml(days){
  var bands=[
    {label:'60 or below',color:'#22D3EE',count:0},
    {label:'61–120',color:'#4ADE80',count:0},
    {label:'121–180',color:'#C084FC',count:0},
    {label:'Above 180',color:'#F472B6',count:0}
  ];
  days.forEach(function(day){
    var score=Number(day.score);
    if(score<=60) bands[0].count++;
    else if(score<=120) bands[1].count++;
    else if(score<=180) bands[2].count++;
    else bands[3].count++;
  });
  return bands.map(function(band){
    var pct=days.length?Math.round(band.count/days.length*100):0;
    return '<div class="analysis-range-row">'
      +'<div class="analysis-range-label">'+band.label+'</div>'
      +'<div class="analysis-range-track"><div class="analysis-range-fill" style="width:'+pct+'%;background:'+band.color+'"></div></div>'
      +'<div class="analysis-range-count">'+band.count+' / '+days.length+'</div>'
      +'</div>';
  }).join('');
}

function weeklyStateHistoryHtml(states,week,scoreDays){
  var completed=states.filter(function(state){return state.classifiableDays>0;}).slice().reverse();
  var current=week&&week.current?week.current:null;
  if(!completed.length&&(!current||!current.classifiableDays)) return '';
  var labels={low:'Lower Daily Fuel Scores',moderate:'Balanced Daily Fuel Scores',higher:'Higher Daily Fuel Scores',strong:'Strong Daily Fuel Scores',quiet:'few clear increases',intermittent:'some clear increases',active:'frequent increases'};
  function bandsFor(state){
    var bands=state.metrics.bandDays;
    return bands.low+' low · '+bands.moderate+' balanced · '+bands.higher+' higher · '+bands.strong+' strong';
  }
  function dayCountLabel(count){return count+' '+(count===1?'day':'days');}
  function completedRow(state){
    var scoreSummary=scoreWindowSummary(scoreDays,state.startDate,state.endDate);
    var transition=state.transition||{};
    var changeLabel=transition.scoreDirection==='rising'?'higher Daily Fuel Scores than the prior week'
      :transition.scoreDirection==='falling'?'lower Daily Fuel Scores than the prior week'
      :transition.responseDirection==='rising'?'more days with clear increases'
      :transition.responseDirection==='falling'?'fewer days with clear increases'
      :transition.kind==='same_state'?'similar to the prior week':'starting reference';
    return '<div class="analysis-week">'
      +'<div class="analysis-week-state">'+labels[state.level]+' <span class="analysis-week-badge is-complete">Completed</span></div>'
      +'<div class="analysis-week-score"><span>Average score</span>'+(scoreSummary.classifiableDays?scoreSummary.metrics.meanScore:'—')+'</div>'
      +'<div class="analysis-week-dates">'+state.startDate.slice(5)+' – '+state.endDate.slice(5)+' · '+dayCountLabel(scoreSummary.classifiableDays)+' with scores</div>'
      +'<div class="analysis-week-detail">'+dayCountLabel(state.metrics.responsiveDays)+' with a clear rise and return from '+dayCountLabel(state.classifiableDays)+' well-measured days · '+changeLabel+'</div>'
      +'<div class="analysis-week-bands">'+bandsFor(state)+'</div>'
      +'</div>';
  }
  var rows='';
  if(current){
    var hasCurrent=current.classifiableDays>0;
    var currentScoreSummary=scoreWindowSummary(scoreDays,current.startDate,week.throughDate);
    var comparison=week.comparison||{};
    var currentChange=comparison.scoreDirection==='rising'?'higher than the same point last week'
      :comparison.scoreDirection==='falling'?'lower than the same point last week'
      :comparison.scoreDirection==='stable'?'similar to the same point last week':'comparison still developing';
    rows='<div class="analysis-week is-current">'
      +'<div class="analysis-week-state">'+(hasCurrent?labels[current.level]:'Not enough readings yet')+' <span class="analysis-week-badge">Incomplete</span></div>'
      +'<div class="analysis-week-score"><span>'+(currentScoreSummary.classifiableDays===1?'Daily score':'Average score')+'</span>'+(currentScoreSummary.classifiableDays?currentScoreSummary.metrics.meanScore:'—')+'</div>'
      +'<div class="analysis-week-dates">'+current.startDate.slice(5)+' – '+week.throughDate.slice(5)+' · '+dayCountLabel(currentScoreSummary.classifiableDays)+' with scores so far</div>'
      +'<div class="analysis-week-detail">'+(hasCurrent?dayCountLabel(current.metrics.responsiveDays)+' with a clear rise and return from '+dayCountLabel(current.classifiableDays)+' well-measured days · '+currentChange:'Add measurements to begin this week’s comparison')+'</div>'
      +(hasCurrent?'<div class="analysis-week-bands">'+bandsFor(current)+'</div>':'')
      +'</div>';
  }
  rows+=completed.map(completedRow).join('');
  return '<section class="analysis-card"><h2 class="analysis-section-title">Compare your weeks</h2>'
    +'<p class="analysis-section-copy">This week so far is shown first and remains incomplete until Sunday ends. Completed Monday–Sunday weeks follow from most recent to oldest.</p>'
    +'<div class="analysis-week-list">'+rows+'</div></section>';
}

function weekToDateCopy(week,lastOfficial,allDays,previousCalendarWeek){
  if(!week||!week.current||!week.current.classifiableDays){
    return {title:'Start with one repeatable experiment.',summary:'Choose one change and tag it each time you try it so FOX2 can build a useful comparison.',question:'What should I test next?',answer:'Choose one change you can repeat and tag each attempt. Once enough examples build up, FOX2 can show whether your body tends to respond in a similar way.',tone:'is-change',icon:'→'};
  }
  var count=week.current.classifiableDays;
  var priorCount=week.previous&&week.previous.classifiableDays||0;
  var movementDays=week.current.days.filter(function(day){return day.movement==='responsive'||Number(day.range)>=2;}).length;
  var hasMovement=movementDays>0;
  var dayWord=count===1?'day':'days';
  var copy={
    early:{title:hasMovement?'There is an early sign of change.':'This week is just getting started.',summary:hasMovement?'Your body may be drawing on fat for energy at times, but it is too early to know if the change will last.':'One day cannot tell us how the week is going yet.',question:'Are my efforts starting to work?',answer:hasMovement?'Possibly. Look back at what happened before the change and choose one safe part to test again.':'It is too early to know. Choose one safe change and tag it each time while FOX2 builds a fair comparison.',tone:'is-change',icon:'→'},
    establishing:{title:hasMovement?'There are early signs of a shift toward fat for energy.':'We’re building your starting point.',summary:hasMovement?'The shift is still brief. Look at what happened before your stronger readings and choose one safe part to try again.':'FOX2 is still learning what is normal for you.',question:'Are my efforts starting to work?',answer:hasMovement?'There are encouraging signs, but the change has not lasted yet. Repeat one safe part of a stronger day and tag it.':'Choose one safe change you can repeat and tag each attempt.',tone:'is-change',icon:'↑'},
    building:{title:'This shift toward fat for energy is showing up more this week.',summary:hasMovement?'It is happening more often than it did at the same point last week. Look at what your stronger days had in common.':'Your results are stronger than they were at the same point last week.',question:'Are my efforts starting to work?',answer:'Yes, something in your recent routine may be helping. Choose one safe part of your stronger '+dayWord+' to repeat and tag.',tone:'is-change',icon:'↑'},
    maintaining:{title:hasMovement?'The shift toward fat for energy is still showing up.':'This week looks much like last week.',summary:hasMovement?'Your body may still be drawing on fat for energy at times. Look for what happens before those periods.':'Your recent pattern has stayed about the same.',question:'Are my efforts still working?',answer:hasMovement?'The shift is still present. Keep testing one safe part of the routine that comes before it.':'Your results are holding. Try one small change and tag it so FOX2 can watch what happens.',tone:'',icon:'✓'},
    fading:{title:'This week is a little behind last week.',summary:hasMovement?'The shift toward fat for energy is still showing up at times. Look back at what happened before your stronger periods.':'We’re seeing less of a shift toward fat for energy this week.',question:hasMovement?'Am I still making progress?':'Have I lost momentum?',answer:hasMovement?'There is still something useful to build on. Choose one safe part of a stronger day to repeat.':'A lower week does not erase earlier progress. Try one safe part of a stronger week again and tag it.',tone:'is-change',icon:'→'},
    recovering:{title:'This week got stronger after a slower start.',summary:'Your later results were stronger than your earlier results.',question:'Am I getting back on track?',answer:'Your later results improved. Look at what was different before your stronger days.',tone:'is-change',icon:'↑'},
    still_quiet:{title:'We’re not seeing a clear shift toward fat for energy yet.',summary:'This gives you a starting point for one small test.',question:'What can I improve?',answer:'Choose one safe change you can repeat and tag it each time. FOX2 will watch what happens next.',tone:'is-change',icon:'→'},
    possibly_overextended:{title:'This shift toward fat for energy may be lasting too long.',summary:'More is not always better when your results stay very high without coming back down.',question:'Could I be pushing too hard?',answer:'Possibly. Rather than trying to push higher, make sure you are eating enough and getting enough protein.',tone:'is-watch',icon:'!'}
  }[week.trajectory]||null;
  if(!copy) copy={title:'Your results give you something to build on.',summary:'Try one small change and watch what happens next.',question:'What should I try next?',answer:'Tag one choice and FOX2 will look for how your body responds.',tone:'is-change',icon:'→'};
  if(count===1){
    var onlyDay=week.current.days[0];
    var isYesterday=onlyDay.date===week.throughDate;
    var dayLabel=isYesterday?'Yesterday':'Your latest measured day';
    var previousDate=addIsoDays(onlyDay.date,-1);
    var previousDay=(allDays||[]).filter(function(day){return day.date===previousDate;})[0]||null;
    var fullWeek=previousCalendarWeek&&previousCalendarWeek.classifiableDays?previousCalendarWeek:null;
    var fullWeekAverage=fullWeek?fullWeek.metrics.meanScore:null;
    var weeklyDelta=fullWeek?onlyDay.score-fullWeekAverage:null;
    copy.title=!fullWeek?dayLabel+' gives you a useful starting point.'
      :weeklyDelta>=10?dayLabel+' stood out from last week.'
      :weeklyDelta<=-10?dayLabel+' was below last week—but one day does not define the week.'
      :dayLabel+' was close to your usual result last week.';
    copy.summary=weeklyDelta===null?'Keep measuring so FOX2 can begin showing what changes.'
      :weeklyDelta>=10?'Think about what was different the night before and that morning. Choose one safe part to try again.'
      :weeklyDelta<=-10?'There is still time to change how this week develops.'
      :'This gives you a steady result to build on.';
    copy.question='What should I watch next?';
    copy.answer='One day cannot tell you how the whole week is going. Tag what you change next so FOX2 can watch whether the same shift happens again.';
  }else if(week.trajectory==='fading'&&priorCount){
    copy.title='This week is a little behind last week.';
    copy.summary=hasMovement?'The shift toward fat for energy is still showing up at times. Look at what happened before your stronger periods and choose one safe part to repeat.':'Try one small, safe change and tag it so FOX2 can watch what happens before the week ends.';
  }
  copy.detail=count+' well-measured day'+(count===1?'':'s')+' this week'+(priorCount?' compared with '+priorCount+' from the same weekdays last week':'')+'.';
  copy.lastOfficial=lastOfficial||null;
  return copy;
}

function analysisWeekEvidence(week){
  if(!week||!week.current||!week.current.classifiableDays) return {detail:'',visual:''};
  var currentDays=(week.current.days||[]).filter(function(day){return isFinite(Number(day.score));}).slice().sort(function(a,b){return a.date.localeCompare(b.date);});
  if(week.trajectory==='recovering'&&currentDays.length>=3){
    var latest=currentDays.slice(-2);
    var earlier=currentDays.slice(0,-2);
    var earlierTypical=Math.round(analysisMedian(earlier.map(function(day){return Number(day.score);})) * 10) / 10;
    var latestTypical=Math.round(analysisMedian(latest.map(function(day){return Number(day.score);})) * 10) / 10;
    return {
      detail:'FOX2 compared your latest two saved Daily Fuel Scores this week with the earlier saved days. The typical result went from '+earlierTypical+' earlier in the week to '+latestTypical+' on the latest two days. Days without a saved score were left out.',
      visual:dailyScoreRecoveryEvidenceSvg(currentDays,'Daily Fuel Scores this week, comparing the earlier days with the latest two days')
    };
  }
  var previous=week.previous;
  if(previous&&previous.classifiableDays&&isFinite(Number(previous.metrics&&previous.metrics.medianScore))&&isFinite(Number(week.current.metrics&&week.current.metrics.medianScore))){
    var previousTypical=Number(previous.metrics.medianScore);
    var currentTypical=Number(week.current.metrics.medianScore);
    return {
      detail:'FOX2 compared your saved Daily Fuel Scores this week with the same weekdays last week. The typical result was '+previousTypical+' last week and '+currentTypical+' this week. Days without a saved score were left out.',
      visual:compactEvidenceLine([
        {x:0,value:previousTypical,title:'Same weekdays last week: typical Daily Fuel Score '+previousTypical},
        {x:1,value:currentTypical,title:'This week: typical Daily Fuel Score '+currentTypical}
      ],'Typical Daily Fuel Score this week compared with the same weekdays last week','Last week','This week')
    };
  }
  return {
    detail:'FOX2 used the saved Daily Fuel Scores from this week. Days without a saved score were left out.',
    visual:dailyScoreEvidenceSvg(currentDays,'Daily Fuel Scores this week')
  };
}

function weekToDateEvidenceHtml(week,lastOfficial,allDays,previousCalendarWeek,currentScoreWeek){
  if(!week||!week.current||!week.current.classifiableDays) return '';
  var current=week.current;
  var previous=week.previous;
  var levelLabels={low:'Lower',medium:'Balanced',moderate:'Balanced',high:'Higher',higher:'Higher',strong:'Strong',unknown:'Not enough data'};
  if(current.classifiableDays===1){
    var onlyDay=current.days[0];
    var previousDate=addIsoDays(onlyDay.date,-1);
    var previousDay=(allDays||[]).filter(function(day){return day.date===previousDate;})[0]||null;
    var fullWeek=previousCalendarWeek&&previousCalendarWeek.classifiableDays?previousCalendarWeek:null;
    var onlyDayLevel=levelLabels[onlyDay.level]||levelLabels[Fox2StateEngine.levelForScore(Number(onlyDay.score))]||'Not enough data';
    return '<section class="analysis-card"><h2 class="analysis-section-title">Yesterday in context</h2>'
      +'<p class="analysis-section-copy">One day is shown as a daily result, not as a typical weekly score. Missing days are not included.</p>'
      +'<div class="analysis-kpis">'
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">Daily Fuel Score range</div><div class="analysis-kpi-value">'+onlyDayLevel+'</div></div>'
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">Yesterday’s score</div><div class="analysis-kpi-value">'+onlyDay.score+'</div></div>'
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">Day before</div><div class="analysis-kpi-value">'+(previousDay?previousDay.score:'No comparable day')+'</div></div>'
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">Previous week average</div><div class="analysis-kpi-value">'+(fullWeek?fullWeek.metrics.meanScore+' · '+fullWeek.classifiableDays+' days':'Not enough data')+'</div></div>'
      +'</div></section>';
  }
  var official=lastOfficial?levelLabels[lastOfficial.level]+' · score '+lastOfficial.metrics.medianScore:'Not enough data';
  var scoreWeek=currentScoreWeek&&currentScoreWeek.classifiableDays?currentScoreWeek:null;
  return '<section class="analysis-card"><h2 class="analysis-section-title">This week so far</h2>'
    +'<p class="analysis-section-copy">Daily-score averages use every day with a saved score. Changes within a day are checked separately when there are enough measurements across that day.</p>'
    +'<div class="analysis-kpis">'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Daily Fuel Score range</div><div class="analysis-kpi-value">'+levelLabels[current.level]+'</div></div>'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Average daily score</div><div class="analysis-kpi-value">'+(scoreWeek?scoreWeek.metrics.meanScore:'Not enough data')+'</div></div>'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Previous week average</div><div class="analysis-kpi-value">'+(previousCalendarWeek&&previousCalendarWeek.classifiableDays?previousCalendarWeek.metrics.meanScore:'Not enough data')+'</div></div>'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Days with enough readings</div><div class="analysis-kpi-value">'+current.classifiableDays+' of '+(scoreWeek?scoreWeek.classifiableDays:0)+' score days</div></div>'
    +'</div></section>';
}

function buildTagInsights(tagRows,history,options){
  options=options||{};
  var excludedPositive={Note:true,Meal:true,Snack:true,'High carb':true,Alcohol:true,'Poor sleep':true,Stress:true};
  var dayByDate={};
  history.days.forEach(function(day){dayByDate[day.date]=day;});
  var pointsByDate={};
  history.points.forEach(function(point){
    if(!pointsByDate[point.date]) pointsByDate[point.date]=[];
    pointsByDate[point.date].push(point);
  });
  Object.keys(pointsByDate).forEach(function(date){pointsByDate[date].sort(function(a,b){return a.minute-b.minute;});});
  var stats={};
  function statFor(icon,name){
    var key=icon||name;
    if(!stats[key]) stats[key]={icon:icon||'•',name:name||'Tagged choice',dates:{},events:[],eligible:0,rises:0,deltas:[]};
    return stats[key];
  }
  (tagRows||[]).forEach(function(row){
    var date=String(row.day_date||'');
    var seen={};
    var events=Array.isArray(row.events)?row.events:[];
    events.forEach(function(event){
      var name=event.name||event.icon||'Tagged choice';
      if(name==='Note'||event.icon==='✏️') return;
      var stat=statFor(event.icon,name);
      stat.dates[date]=true;
      seen[event.icon]=true;
      if(isFinite(Number(event.minute))) stat.events.push({date:date,minute:Number(event.minute)});
    });
    (Array.isArray(row.tray_tags)?row.tray_tags:[]).forEach(function(icon){
      if(icon==='✏️'||seen[icon]) return;
      var names={'🍎':'Snack','🍽️':'Meal','🥩':'Protein','💧':'Hydration','🍳':'Low carb','🍕':'High carb','🍷':'Alcohol','🚶':'Walk','🏃':'Run','🏋️':'Workout','⏱️':'Fasting','😴':'Poor sleep','🧠':'Stress','💉':'GLP-1'};
      statFor(icon,names[icon]||'Tagged choice').dates[date]=true;
    });
  });

  var allDates=Object.keys(dayByDate);
  var immediateCandidates=[];
  var sustainedCandidates=[];
  var statKeys=Object.keys(stats).sort(function(a,b){
    return Object.keys(stats[b].dates).length-Object.keys(stats[a].dates).length;
  }).slice(0,options.maxTags||3);
  statKeys.forEach(function(key){
    var stat=stats[key];
    stat.events.forEach(function(event){
      var points=pointsByDate[event.date]||[];
      var before=points.filter(function(point){return point.minute<=event.minute&&event.minute-point.minute<=360;}).slice(-1)[0];
      var after=points.filter(function(point){return point.minute>event.minute&&point.minute<=event.minute+480;});
      if(!before||!after.length) return;
      var peak=Math.max.apply(null,after.map(function(point){return point.value;}));
      var delta=peak-before.value;
      stat.eligible++;
      stat.deltas.push(delta);
      if(delta>=1.5) stat.rises++;
    });
    var taggedDates=Object.keys(stat.dates).filter(function(date){return dayByDate[date];});
    var taggedScores=taggedDates.map(function(date){return Number(dayByDate[date].score);});
    var untaggedScores=allDates.filter(function(date){return !stat.dates[date];}).map(function(date){return Number(dayByDate[date].score);});
    var sameDelta=taggedScores.length>=3&&untaggedScores.length>=5?analysisMedian(taggedScores)-analysisMedian(untaggedScores):null;
    var following={};
    taggedDates.forEach(function(date){following[addIsoDays(date,1)]=true;});
    var nextScores=allDates.filter(function(date){return following[date];}).map(function(date){return Number(dayByDate[date].score);});
    var otherNextScores=allDates.filter(function(date){return !following[date];}).map(function(date){return Number(dayByDate[date].score);});
    var nextDelta=nextScores.length>=3&&otherNextScores.length>=5?analysisMedian(nextScores)-analysisMedian(otherNextScores):null;
    var rate=stat.eligible?stat.rises/stat.eligible:0;
    var medianDelta=stat.deltas.length?analysisMedian(stat.deltas):null;
    if(!excludedPositive[stat.name]&&stat.eligible>=5&&rate>=.50&&medianDelta>=1.5){
      immediateCandidates.push({kind:'immediate',rank:rate*20+Math.min(stat.eligible,40)/100,stat:stat,rate:rate,medianDelta:medianDelta});
    }
    if(!excludedPositive[stat.name]&&taggedScores.length>=5&&sameDelta!==null&&sameDelta>=5){
      sustainedCandidates.push({kind:'same_day',rank:70+Math.min(sameDelta,40),stat:stat,delta:sameDelta,count:taggedScores.length,taggedMedian:analysisMedian(taggedScores),comparisonMedian:analysisMedian(untaggedScores)});
    }
    if(!excludedPositive[stat.name]&&nextDelta!==null&&nextDelta>=10){
      sustainedCandidates.push({kind:'next_day',rank:60+Math.min(nextDelta,40),stat:stat,delta:nextDelta,count:nextScores.length,taggedMedian:analysisMedian(nextScores),comparisonMedian:analysisMedian(otherNextScores)});
    }
  });
  immediateCandidates.sort(function(a,b){
    return Object.keys(b.stat.dates).length-Object.keys(a.stat.dates).length||b.rank-a.rank;
  });
  sustainedCandidates.sort(function(a,b){
    return Object.keys(b.stat.dates).length-Object.keys(a.stat.dates).length||b.rank-a.rank;
  });
  var selected=[];
  if(immediateCandidates.length){
    var immediateBest=immediateCandidates[0];
    immediateBest.supporting=immediateCandidates.filter(function(candidate){
      return candidate.stat!==immediateBest.stat&&candidate.rate>=immediateBest.rate-.10;
    })[0]||null;
    selected.push(immediateBest);
  }
  if(sustainedCandidates.length){
    var different=sustainedCandidates.filter(function(candidate){return !selected.length||candidate.stat!==selected[0].stat;})[0];
    selected.push(different||sustainedCandidates[0]);
  }
  if(!selected.length){
    return [];
  }
  return selected.slice(0,2).map(function(best){
    var label=best.stat.icon+' '+best.stat.name;
    if(best.kind==='immediate'){
      var immediateEvidence='On '+best.stat.rises+' of '+best.stat.eligible+' recent times you used the '+best.stat.name+' tag, your results suggested your body was using more fat for energy afterward.';
      var immediateAnswer='We’ve seen this pattern after several recent times you tagged '+best.stat.name+'.';
      if(best.supporting){
        immediateEvidence+=' The '+best.supporting.stat.name+' tag showed a similar pattern on '+best.supporting.stat.rises+' of '+best.supporting.stat.eligible+' recent occasions.';
      }
      return {question:'What may be helping?',headline:label+' may be helping your body use more fat for energy.',answer:immediateAnswer,detail:immediateEvidence,tone:'is-change',icon:best.stat.icon,evidence:best};
    }
    if(best.kind==='same_day'){
      return {question:'What may be helping?',headline:'On days tagged '+label+', you may use fat for energy for more of the day.',answer:'This pattern has appeared across several recent tagged days.',detail:'Across '+best.count+' recent days with the '+best.stat.name+' tag, your results suggested your body used fat for energy for more of the day than on other recent days.',tone:'is-change',icon:best.stat.icon,evidence:best};
    }
    return {question:'What may be helping?',headline:label+' may support more fat use into the following day.',answer:'This pattern has appeared after several recent tagged days.',detail:'Across '+best.count+' recent days after the '+best.stat.name+' tag, your results suggested your body used more fat for energy than on other recent days.',tone:'is-change',icon:best.stat.icon,evidence:best};
  });
}

function buildTagInsight(tagRows,history){
  return buildTagInsights(tagRows,history)[0];
}

function analysisWithinDayContext(history,scoreDays,referenceDate){
  var start=addIsoDays(referenceDate,-7);
  var recentScores=(scoreDays||[]).filter(function(day){return day.date>=start&&day.date<referenceDate;});
  var higherDays=recentScores.filter(function(day){return Number(day.score)>120;}).length;
  if(higherDays){
    return 'The encouraging part is that you reached the higher fat-use range on '+higherDays+' of these recent days. Your stronger days show that moving higher is within reach.';
  }
  var measured=(history.days||[]).filter(function(day){return day.date>=start&&day.date<referenceDate;});
  var changing=measured.filter(function(day){return day.movement==='responsive'||Number(day.range)>=2;}).length;
  if(measured.length>=3&&changing>=Math.ceil(measured.length/2)){
    return 'The encouraging part is that your Fat Zone still goes up and down on several days. There are times when your results can move higher, even though the daily total has not gone up yet.';
  }

  var byDate={};
  (history.points||[]).forEach(function(point){
    if(point.date<start||point.date>=referenceDate) return;
    if(!byDate[point.date]) byDate[point.date]={morning:[],afternoon:[],evening:[]};
    var part=point.minute<720?'morning':point.minute<1020?'afternoon':'evening';
    byDate[point.date][part].push(Number(point.value));
  });
  function mean(values){return values.length?values.reduce(function(sum,value){return sum+value;},0)/values.length:null;}
  var days=Object.keys(byDate).map(function(date){
    return {morning:mean(byDate[date].morning),afternoon:mean(byDate[date].afternoon),evening:mean(byDate[date].evening)};
  });
  var rebound=days.filter(function(day){return day.morning!==null&&day.afternoon!==null&&day.evening!==null&&day.morning-day.afternoon>=1&&day.evening-day.afternoon>=1;});
  if(rebound.length>=2&&rebound.length>=Math.ceil(days.length/2)){
    return 'The encouraging part is that your Fat Zone often comes back up later in the day. This is a recurring pattern for you—not one unusual day—and it gives you something specific to build on.';
  }
  var later=days.filter(function(day){return day.morning!==null&&day.evening!==null&&day.evening-day.morning>=1.5;});
  if(later.length>=2&&later.length>=Math.ceil(days.length/2)){
    return 'The encouraging part is that your Fat Zone often goes up later in the day. The increase is not yet lasting long enough to lift your daily results, but it gives you something specific to build on.';
  }
  var morning=days.filter(function(day){return day.morning!==null&&day.afternoon!==null&&day.morning-day.afternoon>=1.5;});
  if(morning.length>=2&&morning.length>=Math.ceil(days.length/2)){
    return 'You often begin the day with a higher Fat Zone, but it comes down later. Your body can reach the higher signal; the next step is learning what may help it last longer.';
  }
  return 'We are not seeing a clear increase in your daily results yet. That gives FOX2 a useful starting point for testing one repeatable change.';
}

function analysisStallInsight(scoreDays,history,referenceDate){
  if(!referenceDate) return null;
  var start=addIsoDays(referenceDate,-7);
  var recent=(scoreDays||[]).filter(function(day){return day.date>=start&&day.date<referenceDate;}).slice().sort(function(a,b){return a.date.localeCompare(b.date);});
  if(recent.length<4) return null;
  var average=analysisAverageScore(recent);
  if(average===null||average>=120) return null;
  var latestThree=recent.slice(-3);
  var threeDown=latestThree.length===3&&Number(latestThree[1].score)<=Number(latestThree[0].score)&&Number(latestThree[2].score)<Number(latestThree[1].score)&&Number(latestThree[0].score)-Number(latestThree[2].score)>=5;
  var midpoint=Math.ceil(recent.length/2);
  var early=analysisAverageScore(recent.slice(0,midpoint));
  var late=analysisAverageScore(recent.slice(midpoint));
  var delta=late-early;
  if(!threeDown&&delta>5) return null;
  var direction=threeDown||delta<=-8?'gone down':'stayed about the same';
  return {
    question:'Could I be stalled?',headline:direction==='gone down'?'Your recent progress may have slowed.':'Your recent progress may have leveled off.',tone:'is-watch',icon:'?',
    answer:'If you’re trying to reduce body fat, this may explain why progress feels stalled. Your daily results have '+direction+'.',
    detail:'FOX2 compared the '+recent.length+' days with saved scores from your latest week. Your later results '+(direction==='gone down'?'were lower than your earlier results':'stayed close to your earlier results')+' and remained below the range where body-fat loss becomes more likely. Days without a saved score were left out. '+analysisWithinDayContext(history,recent,referenceDate)
  };
}

function analysisOverextendedInsight(weekToDate,lastOfficial){
  var current=weekToDate&&weekToDate.current;
  var currentFlag=weekToDate&&weekToDate.trajectory==='possibly_overextended'&&current&&current.classifiableDays>=3;
  var completedFlag=lastOfficial&&lastOfficial.safetyFlag==='persistent_high_steady';
  if(!currentFlag&&!completedFlag) return null;
  var state=currentFlag?current:lastOfficial;
  var period=currentFlag?'this week':'your latest completed week';
  return {
    question:'Could I be pushing too hard?',headline:'Your Fat Zone has stayed high for a long time.',tone:'is-watch',icon:'!',priority:100,
    answer:'More is not always better. Rather than trying to push higher, focus on a routine you can sustain and make sure you’re eating enough, including protein.',
    detail:'Across '+state.classifiableDays+' measured day'+(state.classifiableDays===1?'':'s')+' in '+period+', your Daily Fuel Scores stayed in a higher range while your well-measured days showed little movement back down.',
    visual:dailyScoreEvidenceSvg(state.days||[],'Daily Fuel Scores during '+period)
  };
}

function analysisLastingChangeInsight(weeklyStates){
  var usable=(weeklyStates||[]).filter(function(state){return state.coverage==='sufficient'&&state.metrics&&isFinite(Number(state.metrics.medianScore));});
  if(usable.length<3) return null;
  var recent=usable.slice(-3);
  if(addIsoDays(recent[0].endDate,1)!==recent[1].startDate||addIsoDays(recent[1].endDate,1)!==recent[2].startDate) return null;
  var starting=Number(recent[0].metrics.medianScore);
  var later=[Number(recent[1].metrics.medianScore),Number(recent[2].metrics.medianScore)];
  if(Math.min.apply(null,later)<starting+8||(later[0]+later[1])/2<starting+10) return null;
  var visual=compactEvidenceLine(recent.map(function(state,index){
    return {x:index,value:Number(state.metrics.medianScore),title:state.startDate+' to '+state.endDate+': typical score '+state.metrics.medianScore};
  }),'Typical Daily Fuel Score across the latest three completed weeks',analysisShortDate(recent[0].startDate),analysisShortDate(recent[2].endDate));
  return {
    question:'Is the change lasting?',headline:'This improvement has lasted for several weeks.',tone:'is-change',icon:'✓',priority:70,
    answer:'Your higher results have carried across more than one completed week. That suggests the shift toward fat for energy is lasting beyond one strong day.',
    detail:'FOX2 compared your latest three completed weeks. Their typical Daily Fuel Scores were '+recent.map(function(state){return state.metrics.medianScore;}).join(', ')+'.',
    visual:visual
  };
}

function analysisStrongestPeriodInsight(weeklyStates){
  var usable=(weeklyStates||[]).filter(function(state){return state.coverage==='sufficient'&&state.metrics&&isFinite(Number(state.metrics.medianScore));});
  if(usable.length<3) return null;
  var latest=usable[usable.length-1];
  if(!latest.historical||!latest.historical.newHighestMedian) return null;
  var shown=usable.slice(-6);
  var visual=compactEvidenceLine(shown.map(function(state,index){
    return {x:index,value:Number(state.metrics.medianScore),title:state.startDate+' to '+state.endDate+': typical score '+state.metrics.medianScore};
  }),'Your latest completed week compared with earlier weeks',analysisShortDate(shown[0].startDate),analysisShortDate(latest.endDate));
  return {
    question:'Is this one of my strongest periods?',headline:'This is one of your strongest periods so far.',tone:'is-change',icon:'↑',priority:60,
    answer:'Your latest completed week was your strongest so far in FOX2. The higher pattern showed up across several days, not just once.',
    detail:'FOX2 compared the typical Daily Fuel Score from your latest completed week with '+(usable.length-1)+' earlier completed week'+(usable.length===2?'':'s')+'.',
    visual:visual
  };
}

function analysisStandoutQuestion(scoreDays,referenceDate){
  if(!referenceDate) return null;
  var recentStart=addIsoDays(referenceDate,-5);
  var recent=(scoreDays||[]).filter(function(day){return day.date>=recentStart&&day.date<referenceDate;});
  var earlier=(scoreDays||[]).filter(function(day){return day.date<recentStart;});
  if(!recent.length||earlier.length<10) return null;
  var earlierScores=earlier.map(function(day){return Number(day.score);}).filter(function(value){return isFinite(value);}).sort(function(a,b){return a-b;});
  if(earlierScores.length<10) return null;
  var percentileIndex=Math.max(0,Math.ceil(earlierScores.length*.9)-1);
  var threshold=earlierScores[percentileIndex];
  var typical=analysisMedian(earlierScores);
  var best=recent.slice().sort(function(a,b){return Number(b.score)-Number(a.score)||b.date.localeCompare(a.date);})[0];
  if(Number(best.score)<threshold||Number(best.score)<typical+15) return null;
  var label=analysisRelativeDay(best.date,referenceDate);
  var visualDays=(scoreDays||[]).filter(function(day){return day.date>=addIsoDays(best.date,-3)&&day.date<=addIsoDays(best.date,3);});
  return {
    date:best.date,question:'Did I have an unusually strong day?',headline:label+' was an unusually strong day.',tone:'is-change',icon:'↑',priority:50,
    answer:'Your body may have used fat for energy for more of that day. Think about what was different the night before and that morning.',
    detail:'The Daily Fuel Score on '+analysisWeekday(best.date)+', '+analysisShortDate(best.date)+' was '+best.score+'. That was higher than at least 90% of your earlier saved days.',
    visual:dailyScoreEvidenceSvg(visualDays,'Daily Fuel Scores around '+analysisShortDate(best.date))
  };
}

function analysisStandoutDayContext(insight,history,referenceDate){
  if(!insight||!insight.date||!history||!Array.isArray(history.points)) return insight;
  var bestDate=insight.date;
  var recentStart=addIsoDays(bestDate,-28);
  var parts=['morning','afternoon','evening'];
  function mean(values){return values.length?values.reduce(function(sum,value){return sum+value;},0)/values.length:null;}
  function partMeans(points){
    var grouped={morning:[],afternoon:[],evening:[]};
    (points||[]).forEach(function(point){
      var value=Number(point.value),minute=Number(point.minute);
      if(isFinite(value)&&isFinite(minute)) grouped[analysisDayPart(minute)].push(value);
    });
    var result={};
    parts.forEach(function(part){result[part]=mean(grouped[part]);});
    return result;
  }
  var dayPoints=history.points.filter(function(point){return point.date===bestDate;});
  if(dayPoints.length<2) return insight;
  var dayMeans=partMeans(dayPoints);
  var baseline={};
  parts.forEach(function(part){
    var daily={};
    history.points.forEach(function(point){
      if(point.date<recentStart||point.date>=bestDate||analysisDayPart(point.minute)!==part) return;
      if(!daily[point.date]) daily[point.date]=[];
      daily[point.date].push(Number(point.value));
    });
    var values=Object.keys(daily).map(function(date){return mean(daily[date]);}).filter(function(value){return value!==null;});
    baseline[part]=values.length>=3?analysisMedian(values):null;
  });
  var elevated=parts.filter(function(part){
    return dayMeans[part]!==null&&baseline[part]!==null&&dayMeans[part]>=baseline[part]+.75;
  });
  var focus=elevated[0]||parts.filter(function(part){return dayMeans[part]!==null;}).sort(function(a,b){return dayMeans[b]-dayMeans[a];})[0];
  if(!focus) return insight;
  var weekday=analysisWeekday(bestDate);
  var previousWeekday=analysisWeekday(addIsoDays(bestDate,-1));
  var change='Your results stood out most '+weekday+' '+focus+'.';
  if(elevated.indexOf('afternoon')>=0&&elevated.indexOf('evening')>=0){
    focus='afternoon';
    change='Your results went up '+weekday+' afternoon and stayed higher that evening.';
  }else if(elevated.indexOf('morning')>=0&&(elevated.indexOf('afternoon')>=0||elevated.indexOf('evening')>=0)){
    focus='morning';
    change='Your results started higher '+weekday+' morning and stayed higher later in the day.';
  }
  var lookback=focus==='morning'
    ?previousWeekday+' afternoon and evening'
    :focus==='afternoon'
      ?previousWeekday+' evening and '+weekday+' morning'
      :weekday+' morning and afternoon';
  insight.answer=change+' Think back to '+lookback+': what was different?';
  insight.detail+=' FOX2 compared the morning, afternoon, and evening measurements from that day with the same parts of your earlier days. This points to a time to investigate, not a proven cause.';
  return insight;
}

function analysisSelectQuestions(candidates,limit){
  return (candidates||[]).filter(Boolean).sort(function(a,b){return Number(b.priority||0)-Number(a.priority||0);}).slice(0,limit||2);
}

function analysisQuestionCardHtml(insight,extraHtml){
  if(!insight) return '';
  return '<article class="analysis-conclusion '+(insight.tone||'')+'"><div class="analysis-conclusion-icon">'+(insight.icon||'?')+'</div><div>'
    +'<h2>'+analysisEscape(insight.headline||insight.question)+'</h2><p>'+insight.answer+'</p>'
    +analysisWhyHtml(insight.detail||'',insight.visual||'')
    +(extraHtml||'')
    +'</div></article>';
}

function analysisDaypartVisual(points,outcome,referenceDate,recurringEveningRise){
  var byDate={};
  (points||[]).forEach(function(point){
    var minute=Number(point.minute),value=Number(point.value);
    if(!isFinite(minute)||!isFinite(value)) return;
    if(!byDate[point.date]) byDate[point.date]=[];
    byDate[point.date].push({date:point.date,minute:minute,value:value});
  });
  function partMean(day,part){
    var values=day.filter(function(point){return analysisDayPart(point.minute)===part;}).map(function(point){return point.value;});
    return values.length?values.reduce(function(sum,value){return sum+value;},0)/values.length:null;
  }
  var candidates=Object.keys(byDate).map(function(date){
    var day=byDate[date].slice().sort(function(a,b){return a.minute-b.minute;});
    if(day.length<3||day[day.length-1].minute-day[0].minute<360) return null;
    var morning=partMean(day,'morning'),afternoon=partMean(day,'afternoon'),evening=partMean(day,'evening');
    var strength=null;
    if(outcome==='afternoon'&&morning!==null&&afternoon!==null&&evening!==null) strength=(morning+evening)/2-afternoon;
    else if(outcome==='morning'&&morning!==null&&(afternoon!==null||evening!==null)) strength=Math.max(afternoon===null?-Infinity:afternoon,evening===null?-Infinity:evening)-morning;
    else if(outcome==='evening'&&evening!==null&&(morning!==null||afternoon!==null)){
      strength=recurringEveningRise&&afternoon!==null?evening-afternoon:Math.max(morning===null?-Infinity:morning,afternoon===null?-Infinity:afternoon)-evening;
    }
    return strength===null||!isFinite(strength)?null:{date:date,points:day,strength:strength};
  }).filter(Boolean).sort(function(a,b){return b.strength-a.strength||b.date.localeCompare(a.date);});
  if(!candidates.length) return '';
  var chosen=candidates[0],day=chosen.points;
  var target=day.filter(function(point){return analysisDayPart(point.minute)===outcome;}).reduce(function(best,point){
    if(!best) return point;
    if(outcome==='evening'&&recurringEveningRise) return point.value>best.value?point:best;
    return point.value<best.value?point:best;
  },null);
  if(!target) return '';
  function timeLabel(minute){
    var hour=Math.floor(minute/60),minutes=Math.round(minute%60),suffix=hour>=12?'pm':'am';
    return (hour%12||12)+(minutes?':'+String(minutes).padStart(2,'0'):'')+suffix;
  }
  var values=day.map(function(point){return point.value;});
  var min=Math.min.apply(null,values),max=Math.max.apply(null,values),pad=Math.max(.8,(max-min)*.22);
  var low=min-pad,high=max+pad,w=320,h=150,left=12,right=12,top=32,bottom=27;
  var xMin=day[0].minute,xMax=day[day.length-1].minute;
  var x=function(value){return left+(Number(value)-xMin)*(w-left-right)/(xMax-xMin);};
  var y=function(value){return top+(high-Number(value))*(h-top-bottom)/(high-low);};
  var coords=day.map(function(point){return {x:x(point.minute),y:y(point.value),point:point};});
  var path='M '+coords[0].x.toFixed(1)+' '+coords[0].y.toFixed(1);
  for(var index=1;index<coords.length-1;index++){
    var midX=(coords[index].x+coords[index+1].x)/2,midY=(coords[index].y+coords[index+1].y)/2;
    path+=' Q '+coords[index].x.toFixed(1)+' '+coords[index].y.toFixed(1)+' '+midX.toFixed(1)+' '+midY.toFixed(1);
  }
  if(coords.length===2) path+=' L '+coords[1].x.toFixed(1)+' '+coords[1].y.toFixed(1);
  else path+=' Q '+coords[coords.length-2].x.toFixed(1)+' '+coords[coords.length-2].y.toFixed(1)+' '+coords[coords.length-1].x.toFixed(1)+' '+coords[coords.length-1].y.toFixed(1);
  var targetX=x(target.minute),targetY=y(target.value),arrowId='fox2-daypart-arrow-'+chosen.date.replace(/-/g,'');
  var callout=outcome==='afternoon'?'Midday dip':outcome==='morning'?'Lower morning':recurringEveningRise?'Evening rise':'Evening drop';
  var labelX=Math.max(67,Math.min(w-67,targetX)),labelY=10;
  var dots=coords.map(function(coord){
    var active=coord.point===target;
    return '<circle cx="'+coord.x.toFixed(1)+'" cy="'+coord.y.toFixed(1)+'" r="'+(active?5:3.8)+'" fill="'+(active?'#FFD23C':'#22D3EE')+'" stroke="#08090b" stroke-width="2"><title>'+timeLabel(coord.point.minute)+': Fat Zone '+coord.point.value+'</title></circle>';
  }).join('');
  var relative=analysisRelativeDay(chosen.date,referenceDate);
  var caption=outcome==='afternoon'
    ?relative+', your Fat Zone fell around midday and then came back up later.'
    :outcome==='morning'
      ?relative+', your Fat Zone started lower and went up later in the day.'
      :recurringEveningRise
        ?relative+', your Fat Zone went up from afternoon into the evening.'
        :relative+', your Fat Zone was higher earlier and fell by evening.';
  var aria=caption+' The chart uses the actual measurements saved that day.';
  return '<div class="analysis-daypart-visual">'
    +'<div class="analysis-daypart-label">A recent day that shows this pattern</div>'
    +'<svg class="analysis-daypart-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+analysisEscape(aria)+'">'
      +'<defs><marker id="'+arrowId+'" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#FFD23C"/></marker></defs>'
      +'<line x1="'+left+'" y1="'+(h-bottom)+'" x2="'+(w-right)+'" y2="'+(h-bottom)+'" stroke="rgba(255,255,255,.09)" stroke-width="1"/>'
      +'<path d="'+path+'" fill="none" stroke="#22D3EE" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
      +'<rect x="'+(labelX-55).toFixed(1)+'" y="'+labelY+'" width="110" height="22" rx="11" fill="rgba(255,210,60,.14)" stroke="rgba(255,210,60,.38)"/>'
      +'<text x="'+labelX.toFixed(1)+'" y="25" text-anchor="middle" font-size="11" font-weight="900" fill="#FFD23C">'+callout+'</text>'
      +'<line x1="'+labelX.toFixed(1)+'" y1="32" x2="'+targetX.toFixed(1)+'" y2="'+Math.max(38,targetY-7).toFixed(1)+'" stroke="#FFD23C" stroke-width="1.6" marker-end="url(#'+arrowId+')"/>'
      +dots
      +'<text x="'+left+'" y="'+(h-7)+'" font-size="11" font-weight="800" fill="rgba(255,255,255,.5)">'+timeLabel(day[0].minute)+'</text>'
      +'<text x="'+(w-right)+'" y="'+(h-7)+'" text-anchor="end" font-size="11" font-weight="800" fill="rgba(255,255,255,.5)">'+timeLabel(day[day.length-1].minute)+'</text>'
    +'</svg>'
    +'<div class="analysis-daypart-caption"><strong>'+analysisEscape(relative)+'</strong> '+analysisEscape(caption.slice(relative.length+2))+' This is one real day from your measurements.</div>'
  +'</div>';
}

function analysisDaypartOpportunity(history,referenceDate){
  if(!history||!referenceDate) return null;
  var start=addIsoDays(referenceDate,-14);
  var byDay={};
  (history.points||[]).forEach(function(point){
    if(point.date<start||point.date>=referenceDate) return;
    var minute=Number(point.minute);
    var value=Number(point.value);
    if(!isFinite(minute)||!isFinite(value)) return;
    var part=minute<720?'morning':minute<1020?'afternoon':'evening';
    if(!byDay[point.date]) byDay[point.date]={morning:[],afternoon:[],evening:[]};
    byDay[point.date][part].push(value);
  });
  var parts=['morning','afternoon','evening'];
  var averages={};
  var counts={};
  parts.forEach(function(part){
    var daily=Object.keys(byDay).map(function(date){
      var values=byDay[date][part];
      return values.length?values.reduce(function(sum,value){return sum+value;},0)/values.length:null;
    }).filter(function(value){return value!==null;});
    counts[part]=daily.length;
    averages[part]=daily.length?daily.reduce(function(sum,value){return sum+value;},0)/daily.length:null;
  });
  var eligible=parts.filter(function(part){return counts[part]>=3;});
  if(eligible.length<2) return null;
  eligible.sort(function(a,b){return averages[a]-averages[b];});
  var lowest=eligible[0];
  var highest=eligible[eligible.length-1];
  var clearGap=averages[highest]-averages[lowest]>=.75;
  var afternoonEvening=[];
  Object.keys(byDay).forEach(function(date){
    var afternoon=byDay[date].afternoon;
    var evening=byDay[date].evening;
    if(!afternoon.length||!evening.length) return;
    var afternoonMean=afternoon.reduce(function(sum,value){return sum+value;},0)/afternoon.length;
    var eveningMean=evening.reduce(function(sum,value){return sum+value;},0)/evening.length;
    afternoonEvening.push(eveningMean-afternoonMean);
  });
  var eveningRiseCount=afternoonEvening.filter(function(change){return change>=.5;}).length;
  var recurringEveningRise=afternoonEvening.length>=5&&eveningRiseCount>=Math.ceil(afternoonEvening.length*.6);
  var answer='';
  if(!clearGap&&recurringEveningRise){
    answer='Your Fat Zone often goes up from afternoon to evening. Try one small change that morning or afternoon and see whether the rise starts sooner.';
  }else if(!clearGap){
    answer='No single time of day stands out yet. Change one thing, then watch the next two parts of the day.';
  }else if(lowest==='morning'){
    answer=(highest==='evening'
        ?'Your Fat Zone often goes up in the evening. Try one small change the afternoon or evening before and see whether your morning starts higher.'
        :'Your Fat Zone often goes up by the afternoon. Try one small change the afternoon or evening before and see whether your morning starts higher.');
  }else if(lowest==='afternoon'){
    answer='Your Fat Zone tends to dip in the middle of the day'
      +(highest==='evening'?' before going back up in the evening.':'.')
      +' Try one small change the night before or that morning.';
  }else{
    answer='Your Fat Zone is higher earlier and often falls by evening. Try one small change that morning or afternoon.';
  }
  var partName=lowest==='afternoon'?'the middle of the day':lowest==='evening'?'the later part of the day':'the morning';
  var outcome=clearGap?lowest:recurringEveningRise?'evening':null;
  var headline=!clearGap&&recurringEveningRise?'Your evening rise is something to build on.'
    :!clearGap?'One repeatable change could reveal your next opportunity.'
    :lowest==='morning'?'Your morning is your biggest opportunity.'
    :lowest==='afternoon'?'Your midday dip is your clearest opportunity.'
    :'Your evening is your biggest opportunity.';
  return {
    question:'What could I try?',headline:headline,
    answer:answer,
    visual:outcome?analysisDaypartVisual((history.points||[]).filter(function(point){return point.date>=start&&point.date<referenceDate;}),outcome,referenceDate,recurringEveningRise):'',
    detail:clearGap
      ?'FOX2 compared your morning, afternoon, and evening Fat Zones across recent completed days. '+partName.charAt(0).toUpperCase()+partName.slice(1)+' was the lowest part of your typical day, and '+highest+' was the highest.'
      :recurringEveningRise
        ?'FOX2 compared days with both afternoon and evening measurements. Your Fat Zone rose by at least half a level from afternoon to evening on '+eveningRiseCount+' of '+afternoonEvening.length+' comparable recent days.'
      :'FOX2 compared your morning, afternoon, and evening Fat Zones across recent completed days. They were close enough that one part of the day did not clearly stand out.'
  };
}

function analysisTagWindow(tagRows,history,startDate,endDate){
  return {
    rows:(tagRows||[]).filter(function(row){
      var date=String(row.day_date||'');
      return (!startDate||date>=startDate)&&(!endDate||date<=endDate);
    }),
    history:{
      days:(history.days||[]).filter(function(day){return (!startDate||day.date>=startDate)&&(!endDate||day.date<=endDate);}),
      points:(history.points||[]).filter(function(point){return (!startDate||point.date>=startDate)&&(!endDate||point.date<=endDate);})
    }
  };
}

function analysisSupportedTagInsight(tagRows,history){
  return buildTagInsights(tagRows||[],history,{maxTags:3}).filter(function(insight){
    return insight.evidence&&typeof insight.evidence==='object'&&insight.evidence.kind;
  })[0]||null;
}

function analysisExtendedStall(scoreDays,referenceDate){
  if(!referenceDate) return false;
  var start=addIsoDays(referenceDate,-21);
  var recent=(scoreDays||[]).filter(function(day){return day.date>=start&&day.date<referenceDate;}).slice().sort(function(a,b){return a.date.localeCompare(b.date);});
  if(recent.length<12||analysisAverageScore(recent)>=120) return false;
  var midpoint=Math.ceil(recent.length/2);
  return analysisAverageScore(recent.slice(midpoint))<=analysisAverageScore(recent.slice(0,midpoint))+5;
}

function analysisHistoricalTagInsight(tagRows,history,referenceDate){
  var recentStart=addIsoDays(referenceDate,-56);
  var older=analysisTagWindow(tagRows,history,null,addIsoDays(recentStart,-1));
  var insight=analysisSupportedTagInsight(older.rows,older.history);
  if(!insight) return null;
  var evidence=insight.evidence;
  var strong=evidence.kind==='immediate'?evidence.stat.eligible>=7&&evidence.rate>=.60
    :evidence.kind==='same_day'?evidence.count>=7&&evidence.delta>=8
    :evidence.count>=5&&evidence.delta>=12;
  if(!strong) return null;
  var dates=Object.keys(evidence.stat.dates||{}).sort();
  var label=evidence.stat.icon+' '+evidence.stat.name;
  var activity=evidence.stat.name.toLowerCase();
  var meaning=evidence.kind==='immediate'
    ?label+' may have helped your metabolism shift toward using more fat for energy afterward.'
    :evidence.kind==='same_day'
      ?'On days you tagged '+label+', your results suggested your body may have used fat for energy for more of the day.'
      :'After days tagged '+label+', your results suggested your body may have used more fat for energy the following day.';
  return {
    question:'What helped before?',icon:evidence.stat.icon,tone:'is-change',historical:true,evidence:evidence,
    answer:'Earlier in your history, '+meaning+' If '+activity+' still works for you, it may be worth trying again and using the same tag so FOX2 can see whether the pattern returns.',
    detail:(dates.length?'From '+analysisShortDate(dates[0])+' through '+analysisShortDate(dates[dates.length-1])+', ':'')+insight.detail
  };
}

function renderHistoricalAnalysis(readingRows,scoreRows,tagRows){
  var shell=document.getElementById('analysis-shell');
  if(!shell) return;
  var history=buildHistoricalAnalysis(readingRows,scoreRows);
  window._fox2ExportData={readings:(readingRows||[]).slice(),scores:(scoreRows||[]).slice()};
  var all=history.days;
  var scoreDays=dailyScoreSeries(scoreRows,history.activeDate);
  if(scoreDays.length<5){
    shell.innerHTML='<section class="analysis-card analysis-empty">More completed days are needed before FOX2 can build a historical analysis.</section>';
    return;
  }

  var measuredByDate={};
  all.forEach(function(day){measuredByDate[day.date]=day;});
  var analysisDays=scoreDays.map(function(scoreDay){
    var measured=measuredByDate[scoreDay.date];
    if(measured) return measured;
    return {
      date:scoreDay.date,score:scoreDay.score,
      level:scoreDay.score<=60?'low':scoreDay.score<=120?'medium':'high',
      movement:'unknown',range:null,count:0,span:0,responseAmplitude:0,responseEpisode:null
    };
  });

  var weeklyStates=[];
  var weekToDate=null;
  if(typeof Fox2StateEngine!=='undefined'){
    weeklyStates=Fox2StateEngine.buildCalendarWeekStates(analysisDays,{
      referenceDate:history.activeDate,
      minClassifiableDays:4
    });
    weekToDate=Fox2StateEngine.buildWeekToDate(analysisDays,{referenceDate:history.activeDate});
  }
  // Exposed read-only for development and validation in the browser console.
  window._fox2WeeklyStates=weeklyStates;
  window._fox2WeekToDate=weekToDate;
  var lastOfficial=typeof Fox2StateEngine!=='undefined'?Fox2StateEngine.currentState(weeklyStates):null;
  var previousCalendarWeek=weekToDate?scoreWindowSummary(scoreDays,addIsoDays(weekToDate.startDate,-7),addIsoDays(weekToDate.startDate,-1)):null;
  var weekCopy=weekToDateCopy(weekToDate,lastOfficial,scoreDays,previousCalendarWeek);
  var currentDayToDay=weekToDate?dayToDayScoreMovement(scoreDays,weekToDate.startDate,weekToDate.throughDate):null;
  var previousDayToDay=weekToDate?dayToDayScoreMovement(scoreDays,addIsoDays(weekToDate.startDate,-7),addIsoDays(weekToDate.startDate,-1)):null;
  var dayToDayInsight=dayToDayScoreInsight(currentDayToDay,previousDayToDay);
  window._fox2DayToDayMovement={current:currentDayToDay,previous:previousDayToDay,insight:dayToDayInsight};
  var tagHistory={days:analysisDays,points:history.points};
  var recentTagStart=addIsoDays(history.activeDate,-56);
  var recentTagWindow=analysisTagWindow(tagRows||[],tagHistory,recentTagStart,addIsoDays(history.activeDate,-1));
  var recentTagInsight=analysisSupportedTagInsight(recentTagWindow.rows,recentTagWindow.history);
  window._fox2TagInsights=recentTagInsight?[recentTagInsight]:[];
  window._fox2TagInsight=recentTagInsight;

  var recentStart=addIsoDays(history.activeDate,-14);
  var recentEnd=addIsoDays(history.activeDate,-1);
  var previousStart=addIsoDays(history.activeDate,-28);
  var previousEnd=addIsoDays(history.activeDate,-15);
  var recentScoreDays=scoreDays.filter(function(day){return day.date>=recentStart&&day.date<=recentEnd;});
  var previousScoreDays=scoreDays.filter(function(day){return day.date>=previousStart&&day.date<=previousEnd;});
  var recentMeasuredDays=all.filter(function(day){return day.date>=recentStart&&day.date<=recentEnd;});
  var previousMeasuredDays=all.filter(function(day){return day.date>=previousStart&&day.date<=previousEnd;});
  var progressInsight=analysisRecentProgressInsight(recentScoreDays,previousScoreDays,recentMeasuredDays,previousMeasuredDays);
  var recentAverage=analysisAverageScore(recentScoreDays);
  var stallInsight=analysisStallInsight(scoreDays,history,history.activeDate);
  var daypartOpportunity=analysisDaypartOpportunity(history,history.activeDate);
  var extendedStall=analysisExtendedStall(scoreDays,history.activeDate);
  var helpingInsight=recentTagInsight||((stallInsight&&extendedStall)?analysisHistoricalTagInsight(tagRows||[],tagHistory,history.activeDate):null);
  var recentTimeframe='Last 14 calendar days · '+analysisShortDate(recentStart)+'–'+analysisShortDate(recentEnd);
  var weekEvidence=analysisWeekEvidence(weekToDate);
  var positionHtml=analysisTierGuideHtml(progressInsight,recentAverage,recentTimeframe);
  var historyTrend=document.getElementById('history-score-trend');
  if(historyTrend){
    historyTrend.innerHTML=scoreDays.length?'<section class="analysis-card"><h2 class="analysis-section-title">Daily Fuel Score over time</h2>'
      +'<p class="analysis-section-copy">Every saved day from the beginning. The highlighted area is the latest 14 calendar days.</p>'
      +scoreTrendSvg(scoreDays,recentStart)+'</section>':'';
  }
  var helpingBlock=helpingInsight?'<div class="analysis-experiment"><h3>'+analysisEscape(helpingInsight.headline||helpingInsight.question)+'</h3><p>'+helpingInsight.answer+'</p>'+analysisWhyHtml(helpingInsight.detail,tagEvidenceHtml(helpingInsight))+'</div>':'';
  var openingHtml='<section class="analysis-card">'
    +'<h2 class="analysis-major-title">'+analysisEscape(weekCopy.title)+'</h2>'
    +'<p class="analysis-summary">'+weekCopy.summary+'</p>'
    +analysisWhyHtml(weekEvidence.detail,weekEvidence.visual)
    +helpingBlock
    +'</section>';
  var actionHeadline=daypartOpportunity&&daypartOpportunity.headline;
  var actionBlock=daypartOpportunity?'<div class="analysis-experiment"><h3>'+analysisEscape(actionHeadline)+'</h3><p>'+daypartOpportunity.answer+'</p>'+analysisWhyHtml(daypartOpportunity.detail,daypartOpportunity.visual||'')+'</div>':'';
  var overextendedInsight=analysisOverextendedInsight(weekToDate,lastOfficial);
  var lastingInsight=analysisLastingChangeInsight(weeklyStates);
  var strongestInsight=lastingInsight?null:analysisStrongestPeriodInsight(weeklyStates);
  var standoutInsight=analysisStandoutDayContext(analysisStandoutQuestion(scoreDays,history.activeDate),history,history.activeDate);
  var prioritizedStall=stallInsight?Object.assign({},stallInsight,{priority:90}):null;
  var nextStepInsight=!stallInsight&&!overextendedInsight&&daypartOpportunity?{
    question:daypartOpportunity.question,headline:actionHeadline,answer:daypartOpportunity.answer,detail:daypartOpportunity.detail,
    visual:daypartOpportunity.visual,tone:'is-change',icon:'→',priority:30
  }:null;
  var secondaryQuestions=analysisSelectQuestions([
    overextendedInsight,
    prioritizedStall,
    lastingInsight,
    strongestInsight,
    standoutInsight,
    nextStepInsight
  ],2);
  var secondaryHtml=secondaryQuestions.map(function(insight){
    return analysisQuestionCardHtml(insight,insight===prioritizedStall?actionBlock:'');
  }).join('');
  window._fox2SelectedQuestions=secondaryQuestions;
  shell.innerHTML=positionHtml+openingHtml
    +(secondaryHtml?'<section class="analysis-conclusion-list" aria-label="Questions answered">'+secondaryHtml+'</section>':'')
    +'<div class="analysis-footnote">Based on '+scoreDays.length+' completed days with scores, including '+all.length+' days with enough readings for within-day comparisons. A clear increase requires a rise at least two Fat Zone levels above your recent baseline and a return toward it within 72 hours. Days without enough readings are left out of within-day comparisons, but their saved Daily Fuel Scores still count in daily and weekly comparisons. Tags show patterns, not causes. FOX2 does not diagnose stalled metabolism, muscle loss, or under-fueling.</div>';
}
