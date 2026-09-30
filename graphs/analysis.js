// FOX2 complete-history interpretation and visualization.
// Loaded before the main page script; runtime data is supplied after the
// device payload and database history have been initialized.

// ── Complete-history analysis tab ────────────────────────────────────────
// Daily scores written before this web fix were saved one calendar day early.
// Keep this compatibility correction read-only; new rows are stored correctly.
var SCORE_DATE_FIX_CUTOFF='2026-09-29';

function addIsoDays(iso,amount){
  var d=new Date(iso+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()+amount);
  return d.toISOString().slice(0,10);
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
      amplitude:peak.value-baseline,peakTime:peak.time,returnTime:returned.time
    });
    i=returnIndex;
  }
  return episodes;
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

  // Only the browser's actual current calendar day is incomplete. A restored
  // device payload may end yesterday; that final saved day should still count.
  var now=new Date();
  var activeDate=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
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

function scoreTrendSvg(days){
  var w=360,h=190,left=34,right=8,top=13,bottom=28;
  var pw=w-left-right,ph=h-top-bottom;
  var maxScore=Math.max.apply(null,days.map(function(d){return d.score;}).concat([180]));
  var maxY=Math.ceil(maxScore/30)*30;
  var x=function(i){return left+(days.length===1?pw/2:i*pw/(days.length-1));};
  var y=function(v){return top+ph-(Math.min(v,maxY)/maxY)*ph;};
  var recentStart=Math.max(0,days.length-14);
  var recentX=x(recentStart);
  var path=days.map(function(d,i){return x(i).toFixed(1)+','+y(d.score).toFixed(1);}).join(' ');
  var circles=days.map(function(d,i){
    var fill=d.level==='low'?'#22D3EE':d.level==='medium'?'#4ADE80':'#C084FC';
    return '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(d.score).toFixed(1)+'" r="'+(i===days.length-1?3.8:2.2)+'" fill="'+fill+'"><title>'+d.date+': '+d.score+'</title></circle>';
  }).join('');
  return '<svg class="analysis-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Daily Fuel Score across complete classifiable history">'
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
    +'<text x="'+(left+pw-4)+'" y="'+(top+12)+'" text-anchor="end" font-size="10" fill="rgba(255,210,60,.68)">recent 14</text>'
    +'</svg>';
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

function weeklyStateHistoryHtml(states){
  var usable=states.filter(function(state){return state.coverage==='sufficient';});
  if(!usable.length) return '';
  var recent=usable.slice(-6);
  var labels={low:'Low',moderate:'Moderate',higher:'Higher',strong:'Strong',quiet:'Quiet',intermittent:'Intermittent',active:'Active'};
  var rows=recent.map(function(state,index){
    var current=index===recent.length-1;
    var changes=state.transition&&state.transition.changes||[];
    var changeLabel=changes.length
      ? changes.map(function(change){return change.replace(/_/g,' ');}).join(' · ')
      : (state.transition&&state.transition.kind==='same_state'?'same state':'baseline period');
    return '<div class="analysis-week'+(current?' is-current':'')+'">'
      +'<div class="analysis-week-state">'+labels[state.level]+' + '+labels[state.response]+'</div>'
      +'<div class="analysis-week-score">'+state.metrics.medianScore+'</div>'
      +'<div class="analysis-week-dates">'+state.startDate.slice(5)+' – '+state.endDate.slice(5)+' · '+state.classifiableDays+' days</div>'
      +'<div class="analysis-week-detail">'+state.metrics.responsiveDays+' responsive · '+changeLabel+'</div>'
      +'<div class="analysis-week-bands">'+state.metrics.bandDays.low+' low · '+state.metrics.bandDays.moderate+' moderate · '+state.metrics.bandDays.higher+' higher · '+state.metrics.bandDays.strong+' strong</div>'
      +'</div>';
  }).join('');
  return '<section class="analysis-card"><h2 class="analysis-section-title">Your completed weeks</h2>'
    +'<p class="analysis-section-copy">Each Monday–Sunday week combines the Daily Fuel Score with response patterns found in the individual measurements. Completed weeks do not change; the newest is highlighted.</p>'
    +'<div class="analysis-week-list">'+rows+'</div></section>';
}

function weekToDateCopy(week,lastOfficial){
  if(!week||!week.current||!week.current.classifiableDays){
    return {title:'This week is just getting started.',summary:'There is not enough information yet to describe this week’s fat-use pattern.',question:'How is this week going?',answer:'FOX2 will begin comparing this week once there are classifiable days to work with.',tone:'is-change',icon:'→'};
  }
  var count=week.current.classifiableDays;
  var priorCount=week.previous&&week.previous.classifiableDays||0;
  var comparable=priorCount?' compared with the same part of last week':'';
  var copy={
    early:{title:'This week is just getting started.',summary:'One classifiable day is not enough to call a direction yet.',answer:'It is too early to identify a weekly direction. Keep measuring and FOX2 will update as the week develops.',tone:'is-change',icon:'→'},
    establishing:{title:'This week is establishing a new pattern.',summary:'There is enough information to describe the week, but no comparable start from last week.',answer:'This week is beginning to take shape. FOX2 will use it as a reference for future Monday–Sunday comparisons.',tone:'is-change',icon:'→'},
    building:{title:'Your fat-use pattern is building this week.',summary:'Your signal is stronger or more responsive than it was at the same point last week.',answer:'Something in your recent routine appears to be working. This week shows more fat use or more movement'+comparable+'. Keep building on it.',tone:'is-change',icon:'↑'},
    maintaining:{title:'You are carrying your recent pattern forward.',summary:'This week is tracking close to the same point last week.',answer:'Your fat-use pattern is holding close to last week’s start. Continuing the choices that produced it may help make the pattern more consistent.',tone:'',icon:'✓'},
    fading:{title:'Your fat-use pattern is quieter this week.',summary:'The signal is lower or less responsive than it was at the same point last week.',answer:'This week has started more quietly than last week, but there is still time for the pattern to change.',tone:'is-watch',icon:'↓'},
    recovering:{title:'Your fat-use pattern is recovering.',summary:'The week started quietly, but your latest days are moving back toward a stronger pattern.',answer:'Your last two classifiable days are moving back toward your stronger pattern. Something in your recent routine may be helping.',tone:'is-change',icon:'↑'},
    still_quiet:{title:'Your fat-use pattern is still quiet.',summary:'The signal remains low and steady so far this week.',answer:'FOX2 is not seeing a meaningful increase in fat use yet. There is still time for this week’s pattern to change.',tone:'is-watch',icon:'!'},
    possibly_overextended:{title:'Your fat-use signal has stayed unusually high and quiet.',summary:'Higher readings without much movement can be a reason to check whether you are adequately fueled.',answer:'Your signal has stayed unusually high and quiet this week. Make sure you are adequately fueled, including enough protein—especially if this pattern continues.',tone:'is-watch',icon:'!'}
  }[week.trajectory]||null;
  if(!copy) copy={title:'This week is taking shape.',summary:'FOX2 is comparing it with the same part of last week.',answer:'Your current pattern is still developing.',tone:'is-change',icon:'→'};
  if(count===1){
    var firstDayCopy={
      building:{title:'Your week opened with a stronger fat-use signal.',summary:'Your first classifiable day was stronger or more responsive than the same weekday last week.',answer:'Your first classifiable day is an encouraging start compared with the same weekday last week. More days will show whether that improvement continues.',tone:'is-change',icon:'↑'},
      fading:{title:'Your week opened more quietly.',summary:'Your first classifiable day was lower or less responsive than the same weekday last week.',answer:'Your first classifiable day was quieter than the same weekday last week. It is an early signal, and there is plenty of time for the week to change.',tone:'is-watch',icon:'↓'},
      maintaining:{title:'Your first day is close to last week’s start.',summary:'The opening fat-use signal is similar to the same weekday last week.',answer:'Your week has started close to last week’s pattern. More days will show whether it holds or begins to move.',tone:'',icon:'→'},
      still_quiet:{title:'Your week opened with a quiet fat-use signal.',summary:'The first classifiable day was low and steady.',answer:'Your first day was low and steady. That is useful as a starting point, but it is too early to describe the whole week.',tone:'is-watch',icon:'→'},
      early:{title:'Your first day gives us a starting point.',summary:'FOX2 can describe the opening signal even though the weekly direction is not established yet.',answer:'Your first classifiable day establishes this week’s starting point. The next few days will show whether the signal builds, holds, or becomes quieter.',tone:'is-change',icon:'→'}
    }[week.trajectory];
    if(firstDayCopy) copy=firstDayCopy;
  }
  copy.question='How is this week going?';
  copy.detail=count+' classifiable day'+(count===1?'':'s')+' this week'+(priorCount?' compared with '+priorCount+' from the same weekdays last week':'')+'.';
  copy.lastOfficial=lastOfficial||null;
  return copy;
}

function weekToDateEvidenceHtml(week,lastOfficial){
  if(!week||!week.current||!week.current.classifiableDays) return '';
  var current=week.current;
  var previous=week.previous;
  var official=lastOfficial?lastOfficial.stateLabel+' · median '+lastOfficial.metrics.medianScore:'Not enough data';
  var prior=previous&&previous.classifiableDays?previous.stateLabel+' · median '+previous.metrics.medianScore:'No comparable start';
  return '<section class="analysis-card"><h2 class="analysis-section-title">This week so far</h2>'
    +'<p class="analysis-section-copy">A live view through '+week.throughDate+'. It compares only the same elapsed weekdays and remains provisional until Sunday ends.</p>'
    +'<div class="analysis-kpis">'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Current pattern</div><div class="analysis-kpi-value">'+current.stateLabel+'</div></div>'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Daily median</div><div class="analysis-kpi-value">'+current.metrics.medianScore+'</div></div>'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Same days last week</div><div class="analysis-kpi-value">'+prior+'</div></div>'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Last completed week</div><div class="analysis-kpi-value">'+official+'</div></div>'
    +'</div></section>';
}

function renderHistoricalAnalysis(readingRows,scoreRows){
  var shell=document.getElementById('analysis-shell');
  if(!shell) return;
  var history=buildHistoricalAnalysis(readingRows,scoreRows);
  window._fox2ExportData={readings:(readingRows||[]).slice(),scores:(scoreRows||[]).slice()};
  var all=history.days;
  if(all.length<5){
    shell.innerHTML='<section class="analysis-card analysis-empty">More completed days are needed before FOX2 can build a historical analysis.</section>';
    return;
  }

  var weeklyStates=[];
  var weekToDate=null;
  if(typeof Fox2StateEngine!=='undefined'){
    weeklyStates=Fox2StateEngine.buildCalendarWeekStates(all,{
      referenceDate:history.activeDate,
      minClassifiableDays:4
    });
    weekToDate=Fox2StateEngine.buildWeekToDate(all,{referenceDate:history.activeDate});
  }
  // Exposed read-only for development and validation in the browser console.
  window._fox2WeeklyStates=weeklyStates;
  window._fox2WeekToDate=weekToDate;
  var lastOfficial=typeof Fox2StateEngine!=='undefined'?Fox2StateEngine.currentState(weeklyStates):null;
  var weekCopy=weekToDateCopy(weekToDate,lastOfficial);

  var current=all.slice(-14);
  var measurementPoints=history.points.filter(function(p){return p.date!==history.activeDate;});
  var completedEpisodes=history.episodes.filter(function(e){return e.peakDate!==history.activeDate;});
  var recent=current.slice(-Math.min(5,current.length));
  var baseline=current.slice(0,Math.max(0,current.length-recent.length));
  if(!baseline.length) baseline=all.slice(0,Math.max(0,all.length-recent.length));
  var dominant=analysisDominantLevel(current);
  var currentRate=analysisRate(current);
  var recentRate=analysisRate(recent);
  var baselineRate=analysisRate(baseline);
  var lifetimeRate=analysisRate(all);
  var movement=analysisMovementLabel(currentRate);
  var delta=recentRate-baselineRate;
  var momentum=delta>=.20?'Increasing':delta<=-.20?'Decreasing':'Holding steady';
  var levelName={low:'Low',medium:'Moderate',high:'High'}[dominant.level];
  var higherUseDays=current.filter(function(d){return d.score>120;}).length;
  var above60Days=current.filter(function(d){return d.score>60;}).length;
  var above180Days=current.filter(function(d){return d.score>180;}).length;
  var currentResponseDays=current.filter(function(d){return d.movement==='responsive';}).length;
  var stallPattern=dominant.level==='low' && movement==='Steady';
  var underfuelPattern=dominant.level==='high' && movement==='Steady';
  var title,summary;
  if(underfuelPattern){
    title='You may be staying in fat use too continuously.';
    summary='Your fat-use signal is high, but it is not moving very much. That can be a reason to check whether you are eating enough.';
  }else if(higherUseDays===0 && currentResponseDays>0){
    title='Your body is tapping into fat for energy, but the effect is not yet sustained.';
    summary='Your measurements show brief increases in fat use, while your daily totals remain in the Moderate Fat-Use range.';
  }else if(higherUseDays===0){
    title='Your fat-use signal remains low and the effect is not yet sustained.';
    summary='Your recent scores have remained below the Higher Fat-Use range, with little movement in the signal.';
  }else if(higherUseDays<Math.ceil(current.length/2)){
    title='Your body is tapping into fat for energy more often, but the effect is not yet consistent.';
    summary='Some recent days reached the Higher Fat-Use range. The next step is making that pattern happen more often.';
  }else{
    title='Your higher fat-use pattern is becoming sustained.';
    summary='You are reaching the Higher Fat-Use range regularly while the signal continues to rise and return.';
  }

  var comparison=baseline.length
    ? Math.round(recentRate*recent.length)+' of '+recent.length+' recent days showed a rise and return, compared with '+Math.round(baselineRate*baseline.length)+' of the preceding '+baseline.length+'.'
    : Math.round(recentRate*recent.length)+' of '+recent.length+' recent days showed a rise and return.';
  var usingFatText;
  if(higherUseDays===0){
    usingFatText=currentResponseDays>0
      ? 'At times, yes. '+above60Days+' of your last '+current.length+' daily totals moved above the Low range, and your measurements contain '+currentResponseDays+' confirmed rises and returns. None of those daily totals exceeded 120.'
      : 'FOX2 is not seeing a strong or sustained fat-use signal in your recent measurements.';
  }else if(higherUseDays<Math.ceil(current.length/2)){
    usingFatText='Yes, at times. '+higherUseDays+' of your last '+current.length+' classifiable days reached a Daily Fuel Score above 120.';
  }else{
    usingFatText='Yes. Your fat-use signal has been both stronger and more sustained, with '+higherUseDays+' of your last '+current.length+' daily totals above 120.';
  }

  // Select questions from the evidence instead of showing a fixed checklist.
  var insights=[];
  function addInsight(question,answer,tone,icon){
    insights.push({question:question,answer:answer,tone:tone||'',icon:icon||'→'});
  }
  addInsight(weekCopy.question,weekCopy.answer,weekCopy.tone,weekCopy.icon);
  if(stallPattern){
    addInsight('Is my pattern stuck?',
      'It appears to be. Your recent pattern is both low and flat, so FOX2 is not seeing a meaningful increase in fat use yet.',
      'is-watch','!');
    addInsight('Is my body using fat for energy?',usingFatText,'is-watch','!');
    addInsight('What should I look for next?',
      'The first encouraging change would be readings rising above this flat range and returning to the same level or lower.',
      'is-change','↑');
  }else if(underfuelPattern){
    addInsight('Am I staying in fat use too continuously?',
      'Possibly. Your recent signal is predominantly High + Steady instead of rising and returning.',
      'is-watch','!');
    addInsight('Could I be eating too little?',
      'This pattern can raise that question. If it continues—especially on a GLP-1—consider whether you are eating enough and getting adequate protein.',
      'is-watch','!');
    addInsight('What should I watch next?',
      'Look for the signal to continue reaching higher levels while also returning toward a lower baseline.',
      'is-change','→');
  }else{
    if(momentum==='Increasing'){
      addInsight('Is something I’m doing working?',
        'Something in your recent routine appears to be helping. '+comparison+' Keep building on it.',
        'is-change','↑');
    }else if(momentum==='Decreasing'){
      addInsight('Has my pattern changed?',
        'Yes. The rise-and-return pattern is appearing less often than before. '+comparison,
        'is-watch','↓');
    }
    addInsight('Is my body using fat for energy?',usingFatText,higherUseDays===0?'is-watch':'',higherUseDays===0?'!':'✓');
    if(higherUseDays===0){
      addInsight('Is the effect sustained?',
        'Not yet. Your signal still rises and returns, but none of your last '+current.length+' daily totals exceeded 120.',
        'is-watch','!');
    }else if(higherUseDays<Math.ceil(current.length/2)){
      addInsight('Is the effect sustained?',
        'Only intermittently. '+higherUseDays+' of your last '+current.length+' classifiable days reached the Higher Fat-Use range.',
        'is-change','→');
    }else{
      addInsight('Is the effect sustained?',
        'Yes. '+higherUseDays+' of your last '+current.length+' classifiable days reached the Higher Fat-Use range.',
        '','✓');
    }
    if(momentum==='Holding steady'){
      addInsight('Is the pattern changing?',
        'Not clearly right now. '+comparison,
        'is-change','→');
    }
  }
  var insightHtml=insights.slice(0,3).map(function(insight){
    return '<article class="analysis-conclusion '+insight.tone+'"><div class="analysis-conclusion-icon">'+insight.icon+'</div><div><h2>'+insight.question+'</h2><p>'+insight.answer+'</p></div></article>';
  }).join('');
  var patternColors={
    'low-steady':'#155E75','low-responsive':'#22D3EE',
    'medium-steady':'#166534','medium-responsive':'#4ADE80',
    'high-steady':'#6B21A8','high-responsive':'#C084FC'
  };
  var strip=all.map(function(day){
    var label=day.date+' · '+day.level+' + '+day.movement+' · score '+day.score;
    return '<div class="analysis-pattern-day" style="background:'+patternColors[day.key]+'" title="'+label+'" aria-label="'+label+'"></div>';
  }).join('');
  var legend=[['#22D3EE','Low'],['#4ADE80','Medium'],['#C084FC','High'],['rgba(255,255,255,.28)','Darker = steady']]
    .map(function(item){return '<span class="analysis-legend-item"><span class="analysis-legend-dot" style="background:'+item[0]+'"></span>'+item[1]+'</span>';}).join('');

  shell.innerHTML=''
    +'<section class="analysis-card analysis-hero">'
      +'<div class="analysis-eyebrow">Your questions, answered</div>'
      +'<h1 class="analysis-title">'+weekCopy.title+'</h1>'
      +'<p class="analysis-summary">'+weekCopy.summary+'</p>'
    +'</section>'
    +'<section class="analysis-conclusion-list" aria-label="Your conclusions">'
      +insightHtml
    +'</section>'
    +weekToDateEvidenceHtml(weekToDate,lastOfficial)
    +'<section class="analysis-card">'
      +'<h2 class="analysis-section-title">Why FOX2 says this</h2>'
      +'<p class="analysis-section-copy">The recent pattern is read against every classifiable day in your history.</p>'
      +'<div class="analysis-kpis">'
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">Fuel-use level</div><div class="analysis-kpi-value">'+levelName+'</div></div>'
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">Responsiveness</div><div class="analysis-kpi-value">'+movement+'</div></div>'
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">Recent direction</div><div class="analysis-kpi-value">'+momentum+'</div></div>'
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">'+(above180Days?'Days above 180':higherUseDays?'Days above 120':'Days above 60')+'</div><div class="analysis-kpi-value">'+(above180Days||higherUseDays||above60Days)+' of '+current.length+'</div></div>'
      +'</div>'
      +'<div class="analysis-range-list">'+scoreRangeDistributionHtml(current)+'</div>'
    +'</section>'
    +'<section class="analysis-card"><h2 class="analysis-section-title">The recent change</h2>'
      +'<p class="analysis-section-copy">The share of days containing a confirmed rise above personal baseline followed by a return toward it.</p>'
      +'<div class="analysis-bars">'+renderAnalysisBar('Latest '+recent.length+' days',recent)
        +renderAnalysisBar('Previous '+baseline.length+' days',baseline)
        +renderAnalysisBar('Complete history',all)+'</div></section>'
    +'<section class="analysis-card"><h2 class="analysis-section-title">Your measurement response cycles</h2>'
      +'<p class="analysis-section-copy">Individual breath measurements from the beginning. Gold marks a higher excursion; blue marks its return toward your recent personal baseline.</p>'
      +measurementResponseSvg(measurementPoints,completedEpisodes)+'</section>'
    +'<section class="analysis-card"><h2 class="analysis-section-title">Daily Fuel Score over time</h2>'
      +'<p class="analysis-section-copy">Every classifiable day from the beginning. The highlighted area is your latest 14-day pattern.</p>'
      +scoreTrendSvg(all)+'</section>'
    +'<section class="analysis-card"><h2 class="analysis-section-title">Your pattern history</h2>'
      +'<p class="analysis-section-copy">Each block is one classifiable day, from earliest to latest.</p>'
      +'<div class="analysis-pattern-strip" role="img" aria-label="Daily pattern history from earliest to latest">'+strip+'</div>'
      +'<div class="analysis-legend">'+legend+'</div></section>'
    +weeklyStateHistoryHtml(weeklyStates)
    +'<div class="analysis-footnote">Based on '+all.length+' of '+history.completedWithScore+' completed days. A response requires a rise at least two signal levels above the recent personal baseline and a return toward that baseline within 72 hours. Days without enough readings across the day are left out of daily classification. FOX2 describes patterns; it does not diagnose stalled metabolism, muscle loss, or under-fueling.</div>';
}
