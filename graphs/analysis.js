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
    result.push({
      startDate:startDate,endDate:endDate,current:i===0,days:values.length,
      mean:values.length?Math.round(values.reduce(function(sum,value){return sum+value;},0)/values.length*10)/10:null,
      low:values.length?Math.min.apply(null,values):null,
      high:values.length?Math.max.apply(null,values):null,
      assessableDays:assessable.length,responsiveDays:responsive,
      responseRate:assessable.length?responsive/assessable.length:null
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
    var responsiveness=item.assessableDays?item.responsiveDays+' of '+item.assessableDays+' assessable days responsive':'responsiveness not assessable';
    var title=item.startDate+' to '+item.endDate+': average '+item.mean+', range '+item.low+'–'+item.high+', '+responsiveness+status;
    var outer=item.current?'<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="6.7" fill="none" stroke="#FFD23C" stroke-width="1.5"/>':'';
    return '<line x1="'+cx.toFixed(1)+'" y1="'+highY.toFixed(1)+'" x2="'+cx.toFixed(1)+'" y2="'+lowY.toFixed(1)+'" stroke="rgba(255,255,255,.45)" stroke-width="1.4"/>'
      +'<line x1="'+(cx-4).toFixed(1)+'" y1="'+highY.toFixed(1)+'" x2="'+(cx+4).toFixed(1)+'" y2="'+highY.toFixed(1)+'" stroke="rgba(255,255,255,.45)"/>'
      +'<line x1="'+(cx-4).toFixed(1)+'" y1="'+lowY.toFixed(1)+'" x2="'+(cx+4).toFixed(1)+'" y2="'+lowY.toFixed(1)+'" stroke="rgba(255,255,255,.45)"/>'
      +outer+'<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="4.2" fill="'+color+'"><title>'+title+'</title></circle>'
      +'<text x="'+cx.toFixed(1)+'" y="'+Math.max(10,cy-9).toFixed(1)+'" text-anchor="middle" font-size="9" font-weight="800" fill="rgba(255,255,255,.82)">'+item.mean+'</text>'+dateLabel;
  }).join('');
  return '<section class="analysis-card"><h2 class="analysis-section-title">Your last 8 weeks</h2>'
    +'<p class="analysis-section-copy">'+weeklyTrendSummary(weeks)+' Each point is a weekly average; whiskers show the daily low-to-high range, and marker color shows how often readings moved meaningfully during the day.</p>'
    +'<svg class="analysis-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Eight-week Daily Fuel Score trend with weekly ranges and responsiveness">'
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
  var labels={low:'Lower fat use',moderate:'Balanced fat use',higher:'Higher fat use',strong:'Strong fat use',quiet:'few clear increases',intermittent:'some clear increases',active:'frequent increases'};
  function bandsFor(state){
    var bands=state.metrics.bandDays;
    return bands.low+' low · '+bands.moderate+' balanced · '+bands.higher+' higher · '+bands.strong+' strong';
  }
  function dayCountLabel(count){return count+' '+(count===1?'day':'days');}
  function completedRow(state){
    var scoreSummary=scoreWindowSummary(scoreDays,state.startDate,state.endDate);
    var transition=state.transition||{};
    var changeLabel=transition.scoreDirection==='rising'?'more fat use than the prior week'
      :transition.scoreDirection==='falling'?'less fat use than the prior week'
      :transition.responseDirection==='rising'?'more days with clear increases'
      :transition.responseDirection==='falling'?'fewer days with clear increases'
      :transition.kind==='same_state'?'similar to the prior week':'starting reference';
    return '<div class="analysis-week">'
      +'<div class="analysis-week-state">'+labels[state.level]+' <span class="analysis-week-badge is-complete">Completed</span></div>'
      +'<div class="analysis-week-score"><span>Average score</span>'+(scoreSummary.classifiableDays?scoreSummary.metrics.meanScore:'—')+'</div>'
      +'<div class="analysis-week-dates">'+state.startDate.slice(5)+' – '+state.endDate.slice(5)+' · '+dayCountLabel(scoreSummary.classifiableDays)+' with scores</div>'
      +'<div class="analysis-week-detail">'+dayCountLabel(state.metrics.responsiveDays)+' with increases from '+dayCountLabel(state.classifiableDays)+' usable for responsiveness · '+changeLabel+'</div>'
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
      +'<div class="analysis-week-state">'+(hasCurrent?labels[current.level]:'No classifiable days yet')+' <span class="analysis-week-badge">Incomplete</span></div>'
      +'<div class="analysis-week-score"><span>'+(currentScoreSummary.classifiableDays===1?'Daily score':'Average score')+'</span>'+(currentScoreSummary.classifiableDays?currentScoreSummary.metrics.meanScore:'—')+'</div>'
      +'<div class="analysis-week-dates">'+current.startDate.slice(5)+' – '+week.throughDate.slice(5)+' · '+dayCountLabel(currentScoreSummary.classifiableDays)+' with scores so far</div>'
      +'<div class="analysis-week-detail">'+(hasCurrent?dayCountLabel(current.metrics.responsiveDays)+' with increases from '+dayCountLabel(current.classifiableDays)+' usable for responsiveness · '+currentChange:'Add measurements to begin this week’s comparison')+'</div>'
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
    early:{title:hasMovement?'Your body is already showing some movement.':'Your first result gives you a useful starting point.',summary:hasMovement?'Your measurements changed across the day, even though there is not enough history yet to judge the week.':'One day does not determine the week, but it gives you something concrete to build from.',question:'Are my efforts starting to work?',answer:hasMovement?'Possibly. Your fat use moved during the day. Try repeating one choice that may have contributed and tag each attempt to see whether the increase happens again or lasts longer.':'It is too early to know. Choose one repeatable change and tag each attempt while FOX2 builds enough examples to compare.',tone:'is-change',icon:'→'},
    establishing:{title:hasMovement?'Your body is beginning to respond.':'You now have a starting point to improve from.',summary:hasMovement?'Your measurements reached higher fat use during parts of the day, but the effect is not sustained yet.':'FOX2 has enough information to begin learning what changes your fat use.',question:'Are my efforts starting to work?',answer:hasMovement?'There are encouraging signs. Repeat one choice from a day when your readings increased, tag each attempt, and see whether the effect lasts longer.':'Choose one change you can repeat and tag each attempt. FOX2 will compare the results as enough examples build up.',tone:'is-change',icon:'↑'},
    building:{title:hasMovement?'Yes—your body is responding.':'You are using more fat for energy this week.',summary:hasMovement?'Your fat use is higher than at the same point last week, and your measurements are moving during the day.':'Your daily fat-use totals are higher than they were at the same point last week.',question:'Are my efforts starting to work?',answer:hasMovement?'Yes. Something in your recent routine appears to be helping. Keep one helpful change going and see whether these periods of increased fat use happen more often or last longer.':'Yes. Try repeating one choice from these stronger '+dayWord+' and see whether the improvement continues.',tone:'is-change',icon:'↑'},
    maintaining:{title:hasMovement?'Your body is continuing to respond.':'Your fat use is holding steady.',summary:hasMovement?'Your readings continue to move into higher fat use during parts of the day.':'Your results are close to the same point last week.',question:'Are my efforts still working?',answer:hasMovement?'Yes, your body is still moving into greater fat use. Keep repeating what has been working and look for those periods to become more frequent or last longer.':'Your results are holding. Try one small, repeatable change and see whether it moves your daily total higher.',tone:'',icon:'✓'},
    fading:{title:hasMovement?'There is still something encouraging here.':'This week gives you something clear to work on.',summary:hasMovement?'Your daily total is lower than the same point last week, but your measurements still moved into greater fat use during the day.':'Your body has tapped into less fat for energy than it had at the same point last week.',question:hasMovement?'Am I still making progress?':'Have I lost momentum?',answer:hasMovement?'Your body is still responding, so you are not simply stuck at one level. Try repeating one choice from your stronger days and see whether the increases last longer.':'Your recent result is lower, but that does not erase your earlier progress. Try returning to one choice from a stronger day and see whether your fat use begins to rise again.',tone:'is-change',icon:'→'},
    recovering:{title:'Your efforts may be starting to work again.',summary:'The week began lower, but your latest days are moving back toward greater fat use.',question:'Am I getting back on track?',answer:'Yes, there are encouraging signs. Keep one recent helpful change going and see whether the improvement continues.',tone:'is-change',icon:'↑'},
    still_quiet:{title:'There is room to increase your fat use.',summary:'FOX2 is not seeing a clear increase yet, but this gives you a starting point for a simple experiment.',question:'What can I improve?',answer:'Choose one change you can repeat and tag each attempt. Once enough examples build up, FOX2 can compare whether your readings tend to rise afterward or your next daily score improves.',tone:'is-change',icon:'→'},
    possibly_overextended:{title:'Your fat-use signal is staying unusually elevated.',summary:'More is not necessarily better when the signal remains high without regularly coming back down.',question:'Could I be pushing too hard?',answer:'Possibly. Rather than trying to push the number higher, make sure you are adequately fueled and getting enough protein.',tone:'is-watch',icon:'!'}
  }[week.trajectory]||null;
  if(!copy) copy={title:'Your results give you something to build on.',summary:'Try one small change and watch what happens next.',question:'What should I try next?',answer:'Tag one choice and FOX2 will look for how your body responds.',tone:'is-change',icon:'→'};
  if(count===1){
    var onlyDay=week.current.days[0];
    var isYesterday=onlyDay.date===week.throughDate;
    var dayLabel=isYesterday?'Yesterday':'Your latest classifiable day';
    var previousDate=addIsoDays(onlyDay.date,-1);
    var previousDay=(allDays||[]).filter(function(day){return day.date===previousDate;})[0]||null;
    var fullWeek=previousCalendarWeek&&previousCalendarWeek.classifiableDays?previousCalendarWeek:null;
    var fullWeekAverage=fullWeek?fullWeek.metrics.meanScore:null;
    var weeklyDelta=fullWeek?onlyDay.score-fullWeekAverage:null;
    copy.title=!fullWeek?dayLabel+' gives you a useful starting point.'
      :weeklyDelta>=10?dayLabel+' was stronger than last week’s average.'
      :weeklyDelta<=-10?dayLabel+' was below last week’s average—but one day does not define the week.'
      :dayLabel+' was right in line with last week.';
    copy.summary=dayLabel+'’s Daily Fuel Score was '+onlyDay.score+'. '
      +(previousDay?'The day before was '+previousDay.score+'. ':'There was no classifiable score for the day before. ')
      +(fullWeek?'Last week averaged '+fullWeekAverage+' across '+fullWeek.classifiableDays+' day'+(fullWeek.classifiableDays===1?'':'s')+' with saved scores. ':'')
      +(weeklyDelta===null?'Keep measuring so FOX2 can begin showing what changes.':weeklyDelta>=10?'That is an encouraging result to try to repeat.':weeklyDelta<=-10?'There is still time to influence how this week develops.':'That is a steady result to build on as this week develops.');
    copy.question='What should I watch next?';
    copy.answer='One day cannot tell you how the whole week is going. Watch whether your next Daily Fuel Score moves higher, lower, or stays near this level—and tag what you changed so FOX2 can help connect the result to your choices.';
  }else if(week.trajectory==='fading'&&priorCount){
    var currentScore=week.current.metrics.medianScore;
    var previousScore=week.previous.metrics.medianScore;
    copy.title=hasMovement?'You’re behind last week—but your fat-use signal is still moving.':'You’re behind last week, but this gives you a clear next step.';
    copy.summary='Your typical Daily Fuel Score is '+currentScore+' so far, compared with '+previousScore+' at this point last week. '
      +(hasMovement?'Your readings still reached higher levels during the day, so there is something useful to build on.':'Try one small change and see whether you can move the signal higher before the week ends.');
  }
  copy.detail=count+' classifiable day'+(count===1?'':'s')+' this week'+(priorCount?' compared with '+priorCount+' from the same weekdays last week':'')+'.';
  copy.lastOfficial=lastOfficial||null;
  return copy;
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
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">Fat use yesterday</div><div class="analysis-kpi-value">'+onlyDayLevel+'</div></div>'
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">Yesterday’s score</div><div class="analysis-kpi-value">'+onlyDay.score+'</div></div>'
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">Day before</div><div class="analysis-kpi-value">'+(previousDay?previousDay.score:'No comparable day')+'</div></div>'
        +'<div class="analysis-kpi"><div class="analysis-kpi-label">Previous week average</div><div class="analysis-kpi-value">'+(fullWeek?fullWeek.metrics.meanScore+' · '+fullWeek.classifiableDays+' days':'Not enough data')+'</div></div>'
      +'</div></section>';
  }
  var official=lastOfficial?levelLabels[lastOfficial.level]+' · score '+lastOfficial.metrics.medianScore:'Not enough data';
  var scoreWeek=currentScoreWeek&&currentScoreWeek.classifiableDays?currentScoreWeek:null;
  return '<section class="analysis-card"><h2 class="analysis-section-title">This week so far</h2>'
    +'<p class="analysis-section-copy">Daily-score averages use every day with a saved score. Responsiveness is assessed separately only on days with enough measurements across the day.</p>'
    +'<div class="analysis-kpis">'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Fat use so far</div><div class="analysis-kpi-value">'+levelLabels[current.level]+'</div></div>'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Average daily score</div><div class="analysis-kpi-value">'+(scoreWeek?scoreWeek.metrics.meanScore:'Not enough data')+'</div></div>'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Previous week average</div><div class="analysis-kpi-value">'+(previousCalendarWeek&&previousCalendarWeek.classifiableDays?previousCalendarWeek.metrics.meanScore:'Not enough data')+'</div></div>'
      +'<div class="analysis-kpi"><div class="analysis-kpi-label">Usable for responsiveness</div><div class="analysis-kpi-value">'+current.classifiableDays+' of '+(scoreWeek?scoreWeek.classifiableDays:0)+' score days</div></div>'
    +'</div></section>';
}

function buildTagInsights(tagRows,history){
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
  Object.keys(stats).forEach(function(key){
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
      sustainedCandidates.push({kind:'same_day',rank:70+Math.min(sameDelta,40),stat:stat,delta:sameDelta,count:taggedScores.length});
    }
    if(!excludedPositive[stat.name]&&nextDelta!==null&&nextDelta>=10){
      sustainedCandidates.push({kind:'next_day',rank:60+Math.min(nextDelta,40),stat:stat,delta:nextDelta,count:nextScores.length});
    }
  });
  immediateCandidates.sort(function(a,b){return b.rank-a.rank;});
  sustainedCandidates.sort(function(a,b){return b.rank-a.rank;});
  var tagCount=Object.keys(stats).length;
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
    if(!tagCount){
      return [{question:'What should I test next?',answer:'Choose one change you can repeat and tag it each time you try it. As repeated examples build up, FOX2 can compare what tends to happen later that day and on the following day.',tone:'is-change',icon:'+'}];
    }
    return [{question:'What appears to be helping?',answer:'You are building useful history, but no tagged choice has repeated often enough to show a clear effect yet. Keep repeating one change and tagging it each time so FOX2 can separate a reliable response from a one-time result.',tone:'is-change',icon:'→'}];
  }
  return selected.slice(0,2).map(function(best){
    var label=best.stat.icon+' '+best.stat.name;
    if(best.kind==='immediate'){
      var immediateAnswer=label+' has been followed by an increase in your fat-use signal on '+best.stat.rises+' of '+best.stat.eligible+' measurable occasions. The typical increase was '+Math.round(best.medianDelta*10)/10+' levels.';
      if(best.supporting){
        immediateAnswer+=' '+best.supporting.stat.icon+' '+best.supporting.stat.name+' showed a similar short-term effect on '+best.supporting.stat.rises+' of '+best.supporting.stat.eligible+' measurable occasions.';
      }
      immediateAnswer+=' '+(best.supporting?'These activities appear':'This appears')+' to get your fat use moving; try repeating '+(best.supporting?'one':'it')+' and see what helps the effect last longer.';
      return {question:'What gets my fat use moving?',answer:immediateAnswer,tone:'is-change',icon:best.stat.icon,evidence:best};
    }
    if(best.kind==='same_day'){
      var activityWord={Walk:'walking',Run:'running',Workout:'workouts'}[best.stat.name]||best.stat.name.toLowerCase();
      return {question:'What appears to help it last?',answer:'Across '+best.count+' days when you tagged '+label+', your Daily Fuel Score has tended to be about '+Math.round(best.delta)+' points higher. That suggests '+activityWord+' may help the increase contribute more to the whole day; try it again as a one-change experiment.',tone:'is-change',icon:best.stat.icon,evidence:best};
    }
    return {question:'What may help tomorrow?',answer:'The day after you tagged '+label+', your Daily Fuel Score has typically been about '+Math.round(best.delta)+' points higher. Try it again and see whether the next-day effect repeats.',tone:'is-change',icon:best.stat.icon,evidence:best};
  });
}

function buildTagInsight(tagRows,history){
  return buildTagInsights(tagRows,history)[0];
}

function renderHistoricalAnalysis(readingRows,scoreRows,tagRows){
  var shell=document.getElementById('analysis-shell');
  if(!shell) return;
  var history=buildHistoricalAnalysis(readingRows,scoreRows);
  window._fox2ExportData={readings:(readingRows||[]).slice(),scores:(scoreRows||[]).slice()};
  var all=history.days;
  var scoreDays=dailyScoreSeries(scoreRows,history.activeDate);
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
  var previousCalendarWeek=weekToDate?scoreWindowSummary(scoreDays,addIsoDays(weekToDate.startDate,-7),addIsoDays(weekToDate.startDate,-1)):null;
  var weekCopy=weekToDateCopy(weekToDate,lastOfficial,scoreDays,previousCalendarWeek);
  var tagInsights=buildTagInsights(tagRows||[],history);
  window._fox2TagInsights=tagInsights;
  window._fox2TagInsight=tagInsights[0];

  var current=all.slice(-14);
  var measurementPoints=history.points.filter(function(p){return p.date!==history.activeDate;});
  var completedEpisodes=history.episodes.filter(function(e){return e.peakDate!==history.activeDate;});
  var recent=current.slice(-Math.min(5,current.length));
  var baseline=current.slice(0,Math.max(0,current.length-recent.length));
  if(!baseline.length) baseline=all.slice(0,Math.max(0,all.length-recent.length));
  var dominant=analysisDominantLevel(current);
  var currentRate=analysisRate(current);
  var movement=analysisMovementLabel(currentRate);
  var higherUseDays=current.filter(function(d){return d.score>120;}).length;
  var currentResponseDays=current.filter(function(d){return d.movement==='responsive';}).length;
  var stallPattern=dominant.level==='low' && movement==='Steady';
  var underfuelPattern=dominant.level==='high' && movement==='Steady';

  // Select questions from the evidence instead of showing a fixed checklist.
  var insights=[];
  function addInsight(question,answer,tone,icon){
    insights.push({question:question,answer:answer,tone:tone||'',icon:icon||'→'});
  }
  if(stallPattern){
    addInsight('Am I stalled?',
      'Your recent fat use has stayed low without a clear increase. That is a starting point, not a failure.',
      'is-change','→');
  }else if(underfuelPattern){
    addInsight('Could I be pushing too hard?',
      'Possibly. Your fat-use signal has stayed unusually elevated without regularly coming back down. More is not necessarily better—make sure you are adequately fueled and getting enough protein.',
      'is-watch','!');
  }else{
    if(higherUseDays===0&&currentResponseDays>0){
      addInsight('Am I making progress?',
        'Your body is moving into greater fat use during parts of the day, although the effect is not sustained yet.',
        'is-change','↑');
    }else if(higherUseDays===0){
      addInsight('What can I improve?',
        'FOX2 is not seeing a clear increase yet. Your recent results establish a useful baseline to improve from.',
        'is-change','→');
    }else if(higherUseDays<Math.ceil(current.length/2)){
      addInsight('Am I using more fat for energy?',
        'Yes, at times. '+higherUseDays+' of your last '+current.length+' classifiable days reached the Higher Fat-Use range. Repeat what worked on those days and see whether it happens more often.',
        'is-change','→');
    }else{
      addInsight('Am I sustaining greater fat use?',
        'Yes. '+higherUseDays+' of your last '+current.length+' classifiable days reached the Higher Fat-Use range. Keep doing what has been working.',
        '','✓');
    }
  }
  tagInsights.slice(0,1).forEach(function(tagInsight){
    if(tagInsight.question!==weekCopy.question){
      addInsight(tagInsight.question,tagInsight.answer,tagInsight.tone,tagInsight.icon);
    }
  });
  var insightHtml=insights.slice(0,2).map(function(insight){
    return '<article class="analysis-conclusion '+insight.tone+'"><div class="analysis-conclusion-icon">'+insight.icon+'</div><div><h2>'+insight.question+'</h2><p>'+insight.answer+'</p></div></article>';
  }).join('');
  shell.innerHTML=''
    +'<section class="analysis-card analysis-hero">'
      +'<div class="analysis-eyebrow">Your questions, answered</div>'
      +'<h1 class="analysis-title">'+weekCopy.title+'</h1>'
      +'<p class="analysis-summary">'+weekCopy.summary+'</p>'
    +'</section>'
    +'<section class="analysis-conclusion-list" aria-label="Your conclusions">'
      +insightHtml
    +'</section>'
    +weeklyTrendHtml(scoreDays,all,weekToDate)
    +'<section class="analysis-card"><h2 class="analysis-section-title">Is your body responding more often?</h2>'
      +'<p class="analysis-section-copy">These are days when your measurements rose clearly above your usual level and later returned toward it.</p>'
      +'<div class="analysis-bars">'+renderAnalysisBar('Latest '+recent.length+' days',recent)
        +renderAnalysisBar('Previous '+baseline.length+' days',baseline)
        +renderAnalysisBar('Complete history',all)+'</div></section>'
    +'<section class="analysis-card"><h2 class="analysis-section-title">When your fat use increased</h2>'
      +'<p class="analysis-section-copy">Gold marks a clear increase above your usual level; blue marks the return. These changes can be an early sign that your choices are having an effect.</p>'
      +measurementResponseSvg(measurementPoints,completedEpisodes)+'</section>'
    +'<section class="analysis-card"><h2 class="analysis-section-title">Daily Fuel Score over time</h2>'
      +'<p class="analysis-section-copy">Every classifiable day from the beginning. The highlighted area is your latest 14-day pattern.</p>'
      +scoreTrendSvg(all)+'</section>'
    +'<div class="analysis-footnote">Based on '+all.length+' of '+history.completedWithScore+' completed days. A clear increase requires a rise at least two signal levels above the recent personal baseline and a return toward that baseline within 72 hours. Days without enough readings across the day are left out of daily classification. Tag comparisons describe associations, not causes. FOX2 does not diagnose stalled metabolism, muscle loss, or under-fueling.</div>';
}
