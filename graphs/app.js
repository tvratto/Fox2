(function(){
  'use strict';

  var SUPABASE_URL='https://byysvwdsbpmbypflqcjs.supabase.co';
  var SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5eXN2d2RzYnBtYnlwZmxxY2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTEwNTYsImV4cCI6MjA5NDE4NzA1Nn0.uAKOkd9vNhtN7umEGrVLcQLNjWOnn33n-xKVT25mFzw';
  var params=new URLSearchParams(window.location.search);
  var deviceId=params.get('id')||'';
  var dailyByDate={};
  var payloadDays=[];
  var payloadMeta=null;
  var timeMeta=null;
  var localToday='';
  var trackingState={v:2,tracking:{active:null,history:[]}};
  var trackingRevision=0;
  var startMode='new';
  var shareToken=params.get('share')||'';
  var sharedSnapshot=null;
  var readOnlyShare=false;
  var handoffGeneration=3;
  var handoffChannel=null;
  var handoffExisting=false;
  var handoffNonce=String(Date.now())+Math.random();

  function headers(extra){
    return Object.assign({
      apikey:SUPABASE_KEY,
      Authorization:'Bearer '+SUPABASE_KEY,
      'Content-Type':'application/json'
    },extra||{});
  }

  async function loadFrozenShare(){
    if(!/^[0-9a-f]{40}$/.test(shareToken)) return true;
    try{
      try{ sharedSnapshot=JSON.parse(sessionStorage.getItem('fox2-frozen-share:'+shareToken)||'null'); }catch(error){ sharedSnapshot=null; }
      if(!sharedSnapshot){
        var response=await fetch(SUPABASE_URL+'/rest/v1/rpc/get_share_snapshot',{method:'POST',headers:headers(),body:JSON.stringify({p_token:shareToken})});
        if(!response.ok) throw new Error('Share lookup failed');
        sharedSnapshot=await response.json();
        if(!sharedSnapshot||sharedSnapshot.v!==1||!sharedSnapshot.payload) throw new Error('Share unavailable');
        sessionStorage.setItem('fox2-frozen-share:'+shareToken,JSON.stringify(sharedSnapshot));
      }
      readOnlyShare=true;
      Object.keys(sharedSnapshot.payload||{}).forEach(function(key){
        var value=sharedSnapshot.payload[key];
        if(value!==null&&value!==undefined&&value!=='') params.set(key,String(value));
      });
      // Some frozen links predate the final v2 x/m/r contract. Decode those
      // payloads through the preserved legacy path instead of rejecting them.
      if(params.get('x')&&(!params.get('m')||!params.get('r'))){params.delete('x');params.delete('m');params.delete('r');}
      document.getElementById('shared-banner').hidden=false;
      return true;
    }catch(error){
      document.getElementById('loading-card').hidden=true;
      document.getElementById('unsupported-state').hidden=false;
      document.getElementById('unsupported-state').querySelector('h1').textContent='This shared FOX2 snapshot is unavailable.';
      document.getElementById('unsupported-copy').textContent='Ask the owner for a new link.';
      return false;
    }
  }

  function handoffStorageKey(kind){
    return 'fox2-'+kind+':'+deviceId.replace(/[^A-Za-z0-9_-]/g,'');
  }

  function setupSyncHandoff(){
    if(!deviceId||readOnlyShare||typeof BroadcastChannel==='undefined') return;
    var presenceKey=handoffStorageKey('results-presence');
    var updateKey=handoffStorageKey('sync-update');
    var instanceId=String(Date.now())+Math.random();
    var incomingPayload=!!params.get('d')&&params.get('handoff')!=='1';
    window.name='fox2-results-'+deviceId.replace(/[^A-Za-z0-9_-]/g,'');
    handoffChannel=new BroadcastChannel('fox2-sync-'+deviceId.replace(/[^A-Za-z0-9_-]/g,''));

    function markPresent(){
      try{localStorage.setItem(presenceKey,JSON.stringify({instanceId:instanceId,generation:handoffGeneration,updatedAt:Date.now()}));}catch(error){}
    }
    function replaceWith(url){
      if(!url) return;
      try{localStorage.setItem(updateKey,JSON.stringify({url:url,updatedAt:Date.now()}));}catch(error){}
      window.location.replace(url);
    }
    function applyPendingUpdate(){
      try{
        var pending=JSON.parse(localStorage.getItem(updateKey)||'null');
        if(!pending||!pending.url) return;
        var next=new URL(pending.url,window.location.origin);
        var nextRevision=Number(next.searchParams.get('sync_rev')||pending.updatedAt||0);
        var currentRevision=Number(params.get('sync_rev')||0);
        if(nextRevision>currentRevision) window.location.replace(next.toString());
      }catch(error){}
    }
    handoffChannel.addEventListener('message',function(event){
      var incoming=event.data||{};
      if(incoming.deviceId!==deviceId) return;
      if(incoming.type==='probe'&&Number(incoming.generation||0)>=2){
        handoffChannel.postMessage({type:'present',deviceId:deviceId,nonce:incoming.nonce||'',generation:handoffGeneration});
      }else if(incoming.type==='present'&&incoming.nonce===handoffNonce&&Number(incoming.generation||0)>=2){
        handoffExisting=true;
      }else if(incoming.type==='updated'&&incoming.resultsUrl){
        replaceWith(incoming.resultsUrl);
      }else if(incoming.type==='focus'){
        window.focus();
      }
    });
    if(incomingPayload){
      handoffChannel.postMessage({type:'probe',deviceId:deviceId,nonce:handoffNonce,generation:handoffGeneration});
    }else{
      markPresent();
      setInterval(markPresent,30000);
      applyPendingUpdate();
      document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible') applyPendingUpdate();});
      window.addEventListener('storage',function(event){if(event.key===updateKey) applyPendingUpdate();});
    }
  }

  function finishSyncHandoff(ok){
    if(params.get('sync')==='1'&&window.parent!==window){
      window.parent.postMessage({type:'fox2-sync-complete',deviceId:deviceId,ok:!!ok},window.location.origin);
    }
    if(!ok||!handoffChannel) return;
    if(!handoffExisting){
      try{localStorage.setItem(handoffStorageKey('results-presence'),JSON.stringify({instanceId:String(Date.now())+Math.random(),generation:handoffGeneration,updatedAt:Date.now()}));}catch(error){}
      return;
    }
    var url=new URL(window.location.href);
    url.searchParams.delete('sync');
    url.searchParams.set('handoff','1');
    url.searchParams.set('sync_rev',String(Date.now()));
    handoffChannel.postMessage({type:'updated',deviceId:deviceId,resultsUrl:url.toString(),generation:handoffGeneration});
    handoffChannel.postMessage({type:'focus',deviceId:deviceId,generation:handoffGeneration});
    document.getElementById('nfc-sync-handoff').hidden=false;
    window.close();
  }

  function escapeHtml(value){
    return String(value==null?'':value).replace(/[&<>'"]/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];
    });
  }

  function isoDate(date){
    return date.getUTCFullYear()+'-'+String(date.getUTCMonth()+1).padStart(2,'0')+'-'+String(date.getUTCDate()).padStart(2,'0');
  }

  function addDays(iso,amount){
    var date=new Date(iso+'T00:00:00Z');
    date.setUTCDate(date.getUTCDate()+amount);
    return isoDate(date);
  }

  function daysBetween(start,end){
    return Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000);
  }

  function formatDate(iso,options){
    if(!iso) return '—';
    return new Intl.DateTimeFormat(undefined,options||{month:'short',day:'numeric'}).format(new Date(iso+'T12:00:00Z'));
  }

  function mean(values){
    return values.length?values.reduce(function(sum,value){return sum+value;},0)/values.length:null;
  }

  function tierClass(record){ return record&&record.tierKey?'tier-'+record.tierKey:''; }
  function tierColor(value){
    var tier=Fox2DailyRecord.tierForAverage(value);
    return !tier?'#555':tier.key==='low'?'#55d7eb':tier.key==='medium'?'#62e594':tier.key==='high'?'#d946c7':'#ff8c00';
  }

  async function restoreLatestPayload(){
    if(params.get('d')||!deviceId) return false;
    var select='last_t_param,last_d_param,last_a_param,last_s_param,last_ws_param,last_tz_param,last_x_param,last_m_param,last_r_param,time_zone,firmware_ver,patient_id';
    try{
      var response=await fetch(SUPABASE_URL+'/rest/v1/devices?device_id=eq.'+encodeURIComponent(deviceId)+'&select='+select+'&limit=1',{headers:headers()});
      var rows=response.ok?await response.json():[];
      if(!rows.length||!rows[0].last_d_param) return false;
      var row=rows[0];
      var url=new URL(window.location.href);
      [['t','last_t_param'],['d','last_d_param'],['a','last_a_param'],['s','last_s_param'],['ws','last_ws_param'],['tz','last_tz_param'],['x','last_x_param'],['m','last_m_param'],['r','last_r_param'],['z','time_zone'],['v','firmware_ver'],['p','patient_id']].forEach(function(pair){
        var value=row[pair[1]];
        if(value!==null&&value!==undefined&&value!=='') url.searchParams.set(pair[0],value);
        else url.searchParams.delete(pair[0]);
      });
      window.location.replace(url.toString());
      return true;
    }catch(error){ return false; }
  }

  function payloadWindowStart(dayCount,tzOffset){
    var ws=params.get('ws')||'';
    var wsDay=parseInt(ws,36);
    var fw=parseFloat(params.get('v')||'0');
    if(isFinite(wsDay)&&wsDay>0){
      if(fw>0&&fw<=3.042) wsDay-=dayCount-1;
      return wsDay*86400;
    }
    var shifted=new Date(Date.now()-tzOffset*60000);
    var day=Math.floor(Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate())/86400000);
    var daysToSaturday=(6-shifted.getUTCDay()+7)%7;
    return (day+daysToSaturday-(dayCount-1))*86400;
  }

  function parsePayload(){
    var dParam=params.get('d')||'';
    var blocks=dParam?dParam.split('|'):[];
    var dayCount=blocks.length||21;
    payloadMeta=Fox2PayloadCodec.decode(params,dayCount);
    if(!payloadMeta.supported) return [];
    timeMeta=Fox2TimeCodec.decode(params,payloadMeta);

    var tzRaw=params.get('tz');
    var tzOffset=tzRaw!==null&&tzRaw!==''?parseInt(tzRaw,10):new Date().getTimezoneOffset();
    if(!isFinite(tzOffset)) tzOffset=new Date().getTimezoneOffset();
    var shifted=new Date(Date.now()-tzOffset*60000);
    localToday=isoDate(shifted);
    var windowStart=payloadWindowStart(dayCount,tzOffset);
    var inferredToday=Math.floor((Date.parse(localToday+'T00:00:00Z')/1000-windowStart)/86400);
    var aParam=params.get('a')||'';
    var fixedAuc={};
    var legacyAuc={};
    if(aParam&&aParam.indexOf(':')<0&&aParam.indexOf(',')<0){
      for(var ai=0;ai*2+2<=aParam.length;ai++){
        var fixed=parseInt(aParam.slice(ai*2,ai*2+2),36);
        if(isFinite(fixed)) fixedAuc[ai]=fixed;
        if(fixed>0) legacyAuc[ai]=fixed;
      }
    }else if(aParam){
      aParam.split(',').forEach(function(part,index){
        var pair=part.split(':');
        var slot=pair.length===2?parseInt(pair[0],36):index;
        var value=parseFloat(pair.length===2?pair[1]:pair[0]);
        if(isFinite(slot)&&isFinite(value)&&value>0) legacyAuc[slot]=value;
      });
    }

    return blocks.map(function(block,index){
      var colon=block.indexOf(':');
      var encoded=colon>=0?block.slice(colon+1):'';
      var dayEpoch=windowStart+index*86400;
      var date=isoDate(new Date(dayEpoch*1000));
      var readings=[];
      for(var i=0;i+4<=encoded.length;i+=4){
        var minute=parseInt(encoded.slice(i,i+2),36);
        var value=parseInt(encoded.slice(i+2,i+4),36)/10;
        if(isFinite(minute)&&isFinite(value)) readings.push({minute:minute,value:value});
      }
      var metaDay=payloadMeta.days&&payloadMeta.days[index]||{};
      var measured=typeof metaDay.measured==='boolean'?metaDay.measured:(legacyAuc[index]!==undefined||readings.length>0);
      var future=payloadMeta.schemaVersion===2?!!metaDay.isFuture:index>inferredToday;
      var dayState=payloadMeta.schemaVersion===2?metaDay.dayState:(future?null:index===inferredToday?'provisional':'complete');
      if(!measured) dayState=null;
      var authoritative=payloadMeta.schemaVersion===2?measured&&fixedAuc[index]!==undefined:legacyAuc[index]!==undefined;
      var auc=payloadMeta.schemaVersion===2?fixedAuc[index]:legacyAuc[index];
      var represented=payloadMeta.schemaVersion===2?metaDay.representedMinutes:(dayState==='complete'?1440:null);
      var record=Fox2DailyRecord.normalizeDay({
        localDate:date,
        measured:measured,
        canonicalAuc:auc,
        aucAuthoritative:authoritative,
        representedMinutes:represented,
        dayState:dayState,
        scoreAlgorithm:payloadMeta.scoreAlgorithm,
        payloadSchema:payloadMeta.schemaLabel
      });
      record.readings=readings;
      record.isFuture=future;
      return record;
    });
  }

  async function loadDailyHistory(){
    if(!deviceId||readOnlyShare) return [];
    try{
      return await Fox2DataFetch.fetchAllRows(SUPABASE_URL,'/rest/v1/daily_scores?device_id=eq.'+encodeURIComponent(deviceId)+'&select=day_date,auc_score,represented_duration_minutes,score_algorithm,payload_ver&order=day_date.asc',headers());
    }catch(error){ return []; }
  }

  function mergeDailyHistory(rows){
    dailyByDate={};
    (rows||[]).forEach(function(row){
      if(!row||!row.day_date||!Number.isFinite(Number(row.auc_score))) return;
      var represented=Number(row.represented_duration_minutes)||null;
      if(!represented&&String(row.day_date)<localToday) represented=1440;
      var record=Fox2DailyRecord.normalizeDay({
        localDate:String(row.day_date),measured:true,canonicalAuc:Number(row.auc_score),
        aucAuthoritative:true,representedMinutes:represented,
        dayState:represented===1440?'complete':'provisional',
        scoreAlgorithm:row.score_algorithm,payloadSchema:row.payload_ver
      });
      dailyByDate[record.localDate]=record;
    });
    if(readOnlyShare&&sharedSnapshot&&Array.isArray(sharedSnapshot.days)){
      sharedSnapshot.days.forEach(function(day){
        if(!day||!day.date||!Number.isFinite(Number(day.score))) return;
        var record=Fox2DailyRecord.normalizeDay({
          localDate:String(day.date),measured:true,canonicalAuc:Number(day.score),
          aucAuthoritative:true,representedMinutes:1440,dayState:'complete',
          scoreAlgorithm:null,payloadSchema:'frozen_v1'
        });
        dailyByDate[record.localDate]=record;
      });
    }
    payloadDays.forEach(function(record){
      if(!record.measured||record.canonicalAuc===null) return;
      var existing=dailyByDate[record.localDate];
      var merged=existing?Fox2DailyRecord.mergeRecord(existing,record,{incomingIsNewer:true}):record;
      merged.readings=record.readings;
      dailyByDate[record.localDate]=merged;
    });
  }

  function formatTime(minute){
    var hour=Math.floor(minute/60),minutes=minute%60;
    var suffix=hour>=12?'PM':'AM';
    var display=hour%12||12;
    return display+':'+String(minutes).padStart(2,'0')+' '+suffix;
  }

  function renderDayChart(readings){
    var target=document.getElementById('day-chart');
    var empty=document.getElementById('today-empty');
    if(!readings||!readings.length){target.innerHTML='';empty.hidden=false;return;}
    empty.hidden=true;
    var width=640,height=250,left=24,right=12,top=24,bottom=35,base=height-bottom;
    var maxValue=Math.max.apply(null,readings.map(function(item){return item.value;}));
    var ceiling=maxValue<=5?5:maxValue<=8?8:maxValue<=10?10:20;
    var x=function(minute){return left+(minute/1440)*(width-left-right);};
    var y=function(value){return base-(Math.min(value,ceiling)/ceiling)*(base-top);};
    var line=readings.map(function(item,index){return (index?'L':'M')+x(item.minute).toFixed(1)+' '+y(item.value).toFixed(1);}).join(' ');
    var area='M'+x(readings[0].minute).toFixed(1)+' '+base+' '+line+' L'+x(readings[readings.length-1].minute).toFixed(1)+' '+base+' Z';
    var grid=[0,.25,.5,.75,1].map(function(fraction){var yy=base-(base-top)*fraction;return '<line class="chart-grid" x1="'+left+'" x2="'+(width-right)+'" y1="'+yy+'" y2="'+yy+'"/>';}).join('');
    var points=readings.map(function(item){
      var value=Math.round(item.value),color=tierColor(value);
      return '<g><circle class="chart-point" cx="'+x(item.minute)+'" cy="'+y(item.value)+'" r="6" fill="'+color+'"/><text class="chart-value" x="'+x(item.minute)+'" y="'+(y(item.value)-11)+'">'+value+'</text></g>';
    }).join('');
    target.innerHTML='<svg viewBox="0 0 '+width+' '+height+'" aria-hidden="true">'+grid+'<path class="chart-area" d="'+area+'"/><path class="chart-line" d="'+line+'"/>'+points+'<text class="chart-axis" x="'+left+'" y="'+(height-8)+'">12 AM</text><text class="chart-axis" x="'+(width/2)+'" y="'+(height-8)+'" text-anchor="middle">12 PM</text><text class="chart-axis" x="'+(width-right)+'" y="'+(height-8)+'" text-anchor="end">12 AM</text><text class="chart-axis" x="'+(left-5)+'" y="'+(top+3)+'" text-anchor="end">'+ceiling+'</text></svg>';
  }

  function renderToday(){
    document.getElementById('loading-card').hidden=true;
    document.getElementById('today-content').hidden=false;
    var displayDate=localToday;
    var record=dailyByDate[displayDate]||payloadDays.find(function(day){return day.localDate===displayDate;})||null;
    if(readOnlyShare&&!record){
      var sharedDates=Object.keys(dailyByDate).sort();
      displayDate=sharedDates.length?sharedDates[sharedDates.length-1]:localToday;
      record=dailyByDate[displayDate]||null;
    }
    document.getElementById('today-date').textContent=formatDate(displayDate,{weekday:'long',month:'long',day:'numeric'});
    var average=document.getElementById('today-average');
    var tier=document.getElementById('today-tier');
    average.className='';tier.className='';
    if(record&&record.displayDailyAverage!==null){
      average.textContent=record.displayDailyAverage.toFixed(1);
      tier.textContent=record.tierLabel+(record.dayState==='provisional'?' so far':'');
      average.classList.add(tierClass(record));tier.classList.add(tierClass(record));
    }else{
      average.textContent='—';
      tier.textContent=record&&record.measured?'Daily Average not available yet':'No measurement yet';
    }
    var readings=record&&record.readings||[];
    renderDayChart(readings);
    var latest=document.getElementById('latest-reading');
    if(readings.length){
      var reading=readings[readings.length-1];
      latest.hidden=false;
      document.getElementById('latest-zone').textContent=Math.round(reading.value);
      document.getElementById('latest-zone').style.color=tierColor(Math.round(reading.value));
      document.getElementById('latest-time').textContent=formatTime(reading.minute);
    }else latest.hidden=true;
  }

  function completedRecords(){
    return Object.keys(dailyByDate).sort().map(function(date){return dailyByDate[date];}).filter(function(record){return record&&record.eligibleForTracking;});
  }

  function beforeDatesFor(startDate){
    return completedRecords().filter(function(record){return record.localDate<startDate;}).slice(-3).map(function(record){return record.localDate;});
  }

  function emptyTrackingState(){ return {v:2,tracking:{active:null,history:[]}}; }

  function normalizeTrackingState(remote){
    if(remote&&remote.v===2&&remote.tracking){
      return {v:2,tracking:{active:remote.tracking.active||null,history:Array.isArray(remote.tracking.history)?remote.tracking.history:[]},legacy:remote.legacy||null};
    }
    var state=emptyTrackingState();
    if(remote&&remote.v===1) state.legacy=remote;
    return state;
  }

  function trackingStorageKey(){ return 'fox2-tracking-v2:'+(deviceId||'local'); }

  async function loadTracking(){
    if(readOnlyShare){
      var sharedTracking=sharedSnapshot&&sharedSnapshot.program&&sharedSnapshot.program.tracking;
      trackingState=normalizeTrackingState(sharedTracking||null);
      return;
    }
    try{ trackingState=normalizeTrackingState(JSON.parse(localStorage.getItem(trackingStorageKey())||'null')); }catch(error){ trackingState=emptyTrackingState(); }
    if(!deviceId) return;
    try{
      var response=await fetch(SUPABASE_URL+'/rest/v1/rpc/get_device_program_state',{method:'POST',headers:headers(),body:JSON.stringify({p_device_id:deviceId})});
      var remote=response.ok?await response.json():null;
      if(remote&&remote.state){trackingState=normalizeTrackingState(remote.state);trackingRevision=Number(remote.revision)||0;localStorage.setItem(trackingStorageKey(),JSON.stringify(trackingState));}
    }catch(error){}
  }

  async function saveTracking(){
    if(readOnlyShare) return false;
    localStorage.setItem(trackingStorageKey(),JSON.stringify(trackingState));
    if(!deviceId) return true;
    try{
      var response=await fetch(SUPABASE_URL+'/rest/v1/rpc/save_device_program_state',{method:'POST',headers:headers(),body:JSON.stringify({p_device_id:deviceId,p_state:trackingState,p_expected_revision:trackingRevision})});
      var result=response.ok?await response.json():null;
      if(result&&result.ok){trackingRevision=Number(result.revision)||trackingRevision+1;return true;}
      if(result&&result.conflict&&result.state){trackingState=normalizeTrackingState(result.state);trackingRevision=Number(result.revision)||0;localStorage.setItem(trackingStorageKey(),JSON.stringify(trackingState));renderTracking();renderHistory();}
    }catch(error){}
    return false;
  }

  function activeMetrics(active){
    var before=(active.beforeDates||[]).map(function(date){return dailyByDate[date];}).filter(function(record){return record&&record.eligibleForTracking;});
    var tracked=completedRecords().filter(function(record){return record.localDate>=active.startDate&&record.localDate<=active.endDate;});
    var beforeMean=mean(before.map(function(record){return record.dailyAverage;}));
    var currentMean=mean(tracked.map(function(record){return record.dailyAverage;}));
    var change=beforeMean&&currentMean!==null?(currentMean-beforeMean)/beforeMean*100:null;
    return {before:before,tracked:tracked,beforeMean:beforeMean,currentMean:currentMean,change:change};
  }

  async function finalizeExpiredTracking(){
    if(readOnlyShare) return;
    var active=trackingState.tracking.active;
    if(!active||localToday<=active.endDate) return;
    active.status='completed';active.actualEndDate=active.endDate;
    trackingState.tracking.history.unshift(active);
    trackingState.tracking.active=null;
    await saveTracking();
  }

  function renderTrackingIntro(){
    if(readOnlyShare) return '<article class="card tracking-intro"><p class="eyebrow">Shared snapshot</p><h1>No Tracking period</h1><p class="tracking-intro-copy">This frozen snapshot does not include a Tracking comparison.</p></article>';
    return '<article class="card tracking-intro"><p class="eyebrow">Optional</p><h1>Track a change</h1><p class="tracking-intro-copy">See whether a change affects your daily fat use. Choose something you want to try. For the next 30 days, FOX2 will compare your new daily averages with your earlier days.</p><div class="intro-diagram" aria-hidden="true"><i></i><i></i><i></i><span class="intro-start"><span>Start</span></span><i></i><i></i><i></i><i></i><i></i></div><button class="primary-button" id="start-tracking-main" type="button">Start tracking</button></article>';
  }

  function barHtml(record,isToday){
    if(!record||record.displayDailyAverage===null) return '<i class="tracking-bar is-missing"></i>';
    var height=Math.max(3,Math.min(100,record.dailyAverage/10*100));
    return '<i class="tracking-bar '+(isToday?'is-today':'')+'" style="height:'+height+'%;background:'+tierColor(record.dailyAverage)+'" title="'+escapeHtml(record.localDate+': '+record.displayDailyAverage.toFixed(1))+'"></i>';
  }

  function renderActiveTracking(active){
    var metrics=activeMetrics(active);
    var day=Math.max(1,Math.min(30,daysBetween(active.startDate,localToday)+1));
    var changeCopy=metrics.change===null?'Your comparison will appear after a completed day.':Math.round(Math.abs(metrics.change))+'% '+(metrics.change>=0?'higher':'lower')+' than before';
    var bars=[];
    for(var b=0;b<3;b++) bars.push(barHtml(metrics.before[b]||null,false));
    for(var i=0;i<30;i++){
      var date=addDays(active.startDate,i);
      var record=dailyByDate[date]||null;
      bars.push(barHtml(record,date===localToday&&record&&record.dayState==='provisional'));
    }
    var maxLine=Math.max(10,metrics.beforeMean||0,metrics.currentMean||0);
    var beforeBottom=metrics.beforeMean===null?null:Math.min(100,metrics.beforeMean/maxLine*100);
    var currentBottom=metrics.currentMean===null?null:Math.min(100,metrics.currentMean/maxLine*100);
    return '<section><header class="tracking-header"><div><p class="eyebrow">Day '+day+' of 30</p><div class="tracking-title-row"><h1>'+escapeHtml(active.name)+'</h1>'+(readOnlyShare?'':'<button class="info-button" id="tracking-info" aria-label="About and manage tracking">i</button>')+'</div></div><span class="tracking-day">'+formatDate(active.startDate)+'–'+formatDate(active.endDate)+'</span></header><div class="change-summary '+(metrics.change===null?'is-neutral':'')+'">'+escapeHtml(changeCopy)+'</div><p class="change-subtitle">Uses completed Daily Averages only.</p><div class="card tracking-chart-card"><div class="tracking-chart"><div class="tracking-plot">'+bars.join('')+'<span class="start-line"><span>Start</span></span>'+(beforeBottom===null?'':'<span class="average-line before" style="bottom:'+beforeBottom+'%"><span>Before '+metrics.beforeMean.toFixed(1)+'</span></span>')+(currentBottom===null?'':'<span class="average-line current" style="bottom:'+currentBottom+'%"><span>Current '+metrics.currentMean.toFixed(1)+'</span></span>')+'</div><div class="tracking-axis"><span>Before</span><span>Day 1</span><span>Day 30</span></div></div></div><div class="tracking-legend"><span style="color:#aaa">Before</span><span style="color:#eee">Current</span></div></section>';
  }

  function renderTracking(){
    var target=document.getElementById('tracking-content');
    var active=trackingState.tracking.active;
    target.innerHTML=active?renderActiveTracking(active):renderTrackingIntro();
    var start=document.getElementById('start-tracking-main');if(start) start.addEventListener('click',openStartDialog);
    var info=document.getElementById('tracking-info');if(info) info.addEventListener('click',openTrackingInfo);
  }

  function historyMetrics(item){ return activeMetrics(item); }
  function renderHistory(){
    var target=document.getElementById('history-content');
    var items=trackingState.tracking.history||[];
    if(!items.length){target.innerHTML='<div class="card history-empty">Completed and stopped tracking periods will appear here.</div>';return;}
    target.innerHTML='<div class="history-list">'+items.map(function(item){
      var metrics=historyMetrics(item);
      var result=metrics.change===null?'—':Math.round(Math.abs(metrics.change))+'% '+(metrics.change>=0?'higher':'lower');
      return '<article class="card history-card"><div class="history-card-head"><div><p class="eyebrow">'+(item.status==='stopped'?'Stopped':'Completed')+'</p><h2>'+escapeHtml(item.name)+'</h2></div><strong>'+escapeHtml(result)+'</strong></div><div class="history-meta"><span>'+formatDate(item.startDate)+'–'+formatDate(item.actualEndDate||item.endDate)+'</span><span>'+metrics.tracked.length+' measured '+(metrics.tracked.length===1?'day':'days')+'</span></div></article>';
    }).join('')+'</div>';
  }

  function switchView(view){
    document.querySelectorAll('.tab').forEach(function(tab){var active=tab.dataset.view===view;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',active?'true':'false');tab.tabIndex=active?0:-1;});
    document.querySelectorAll('.panel').forEach(function(panel){var active=panel.id==='panel-'+view;panel.hidden=!active;panel.inert=!active;panel.setAttribute('aria-hidden',active?'false':'true');panel.classList.toggle('is-active',active);});
  }

  function openStartDialog(){
    startMode='new';
    configureStartDialog('What change do you want to track?','Start tracking',true,true,true);
    document.getElementById('tracking-name').value='';
    document.getElementById('tracking-start').value=localToday;
    document.getElementById('start-dialog').showModal();
  }

  function configureStartDialog(title,button,showName,showStart,showNote){
    document.getElementById('start-dialog-title').textContent=title;
    document.getElementById('tracking-form-submit').textContent=button;
    document.getElementById('tracking-name-field').hidden=!showName;
    document.getElementById('tracking-start-field').hidden=!showStart;
    document.getElementById('tracking-form-note').hidden=!showNote;
    document.getElementById('tracking-name').required=showName;
    document.getElementById('tracking-start').required=showStart;
  }

  function openTrackingInfo(){
    var active=trackingState.tracking.active;if(!active) return;
    document.getElementById('info-start-date').textContent=formatDate(active.startDate,{year:'numeric',month:'long',day:'numeric'});
    document.getElementById('info-end-date').textContent=formatDate(active.endDate,{year:'numeric',month:'long',day:'numeric'});
    document.getElementById('tracking-info-dialog').showModal();
  }

  function confirmAction(title,copy,label){
    return new Promise(function(resolve){
      var dialog=document.getElementById('confirm-dialog');
      document.getElementById('confirm-title').textContent=title;
      document.getElementById('confirm-copy').textContent=copy;
      document.getElementById('confirm-action').textContent=label;
      dialog.addEventListener('close',function done(){dialog.removeEventListener('close',done);resolve(dialog.returnValue==='confirm');});
      dialog.showModal();
    });
  }

  async function handleInfoAction(action){
    var active=trackingState.tracking.active;if(!active) return;
    if(action==='edit-name'){
      startMode='edit-name';
      configureStartDialog('Edit name','Save name',true,false,false);
      document.getElementById('tracking-name').value=active.name;
      document.getElementById('start-dialog').showModal();
    }else if(action==='edit-start'){
      startMode='edit-start';
      configureStartDialog('Change start date','Change date',false,true,false);
      document.getElementById('tracking-start').value=active.startDate;
      document.getElementById('start-dialog').showModal();
    }else if(action==='stop'){
      var okay=await confirmAction('Stop tracking?','This will save the dates and results collected so far in History.','Stop tracking');
      if(okay){active.status='stopped';active.actualEndDate=localToday;trackingState.tracking.history.unshift(active);trackingState.tracking.active=null;await saveTracking();renderTracking();renderHistory();switchView('history');}
    }
  }

  async function saveStartForm(){
    var name=document.getElementById('tracking-name').value.trim();
    var start=document.getElementById('tracking-start').value;
    var current=trackingState.tracking.active;
    if(startMode==='edit-name'){
      if(!current||!name) return;
      current.name=name.slice(0,80);
      await saveTracking();renderTracking();renderHistory();
      return;
    }
    if(startMode==='edit-start'){
      if(!current||!start) return;
      var okay=await confirmAction('Change the start date?','This will choose new Before days and recalculate the comparison.','Change date');
      if(!okay) return;
      name=current.name;
    }
    if(!name||!start) return;
    var active=trackingState.tracking.active||{};
    trackingState.tracking.active={
      id:active.id||('tracking-'+Date.now()),name:name.slice(0,80),startDate:start,
      endDate:addDays(start,29),actualEndDate:null,status:'active',beforeDates:beforeDatesFor(start)
    };
    await saveTracking();renderTracking();renderHistory();switchView('tracking');
  }

  function latestMeasurementIso(){
    var latest=null;
    payloadDays.forEach(function(day){(day.readings||[]).forEach(function(reading){var value=day.localDate+'T'+String(Math.floor(reading.minute/60)).padStart(2,'0')+':'+String(reading.minute%60).padStart(2,'0')+':00.000Z';if(!latest||value>latest) latest=value;});});
    return latest;
  }

  async function savePayload(){
    var dParam=params.get('d')||'';
    if(readOnlyShare||!deviceId||!dParam||!payloadMeta||!payloadMeta.supported) return true;
    var status=document.getElementById('sync-status');
    try{
      var check=await fetch(SUPABASE_URL+'/rest/v1/devices?device_id=eq.'+encodeURIComponent(deviceId)+'&select=last_ws_param,last_measurement_at&limit=1',{headers:headers()});
      var rows=check.ok?await check.json():[];
      var stored=rows[0]||{};
      var incomingWs=parseInt(params.get('ws')||'0',36)||0;
      var storedWs=parseInt(stored.last_ws_param||'0',36)||0;
      var incomingLatest=latestMeasurementIso();
      var isCurrent=incomingWs>storedWs||(incomingWs===storedWs&&Date.parse(incomingLatest||0)>=Date.parse(stored.last_measurement_at||0));
      if(!isCurrent){status.textContent='Showing saved results';return true;}

      var patient=params.get('p')||null,clinic=params.get('c')||null;
      var readingRows=[];
      payloadDays.forEach(function(day){(day.readings||[]).forEach(function(reading){
        var localTs=day.localDate+'T'+String(Math.floor(reading.minute/60)).padStart(2,'0')+':'+String(reading.minute%60).padStart(2,'0')+':00.000Z';
        var utcTs=timeMeta&&timeMeta.utcCapable?Fox2TimeCodec.localToUtcIso(day.localDate,reading.minute,timeMeta.timeZone):null;
        readingRows.push({device_id:deviceId,patient_id:patient,clinic_id:clinic,reading_ts:localTs,reading_utc_ts:utcTs,local_date:day.localDate,local_minute:reading.minute,time_zone:timeMeta&&timeMeta.timeZone,time_basis:timeMeta&&timeMeta.timeBasis,ppm:reading.value,payload_ver:payloadMeta.schemaLabel});
      });});
      var scoreRows=payloadDays.filter(function(day){return day.measured&&day.canonicalAuc!==null;}).map(function(day){return Object.assign({device_id:deviceId,patient_id:patient,clinic_id:clinic,day_date:day.localDate,auc_score:day.canonicalAuc,time_zone:timeMeta&&timeMeta.timeZone,time_basis:timeMeta&&timeMeta.timeBasis,payload_ver:payloadMeta.schemaLabel},Fox2DailyRecord.persistenceFields(day));});
      var writes=[];
      if(readingRows.length) writes.push(fetch(SUPABASE_URL+'/rest/v1/readings?on_conflict=device_id,reading_ts',{method:'POST',headers:headers({Prefer:'resolution=ignore-duplicates,return=minimal'}),body:JSON.stringify(readingRows)}));
      if(scoreRows.length) writes.push(fetch(SUPABASE_URL+'/rest/v1/daily_scores?on_conflict=device_id,day_date',{method:'POST',headers:headers({Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(scoreRows)}));
      var utcRows=readingRows.filter(function(row){return !!row.reading_utc_ts;});
      var latestUtc=utcRows.length?utcRows.reduce(function(latest,row){return !latest||row.reading_utc_ts>latest?row.reading_utc_ts:latest;},null):null;
      var device={device_id:deviceId,patient_id:patient,clinic_id:clinic,last_scan_at:new Date().toISOString(),last_measurement_at:incomingLatest,last_measurement_utc_at:latestUtc,payload_ver:payloadMeta.schemaLabel,firmware_ver:params.get('v')||null,last_t_param:params.get('t')||null,last_d_param:dParam,last_a_param:params.get('a')||null,last_s_param:params.get('s')||null,last_ws_param:params.get('ws')||null,last_tz_param:params.get('tz')||null,last_x_param:params.get('x')||null,last_m_param:params.get('m')||null,last_r_param:params.get('r')||null,time_zone:timeMeta&&timeMeta.timeZone,time_basis:timeMeta&&timeMeta.timeBasis,current_utc_offset_minutes:timeMeta&&timeMeta.utcOffsetMinutes};
      writes.push(fetch(SUPABASE_URL+'/rest/v1/devices?on_conflict=device_id',{method:'POST',headers:headers({Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(device)}));
      var results=await Promise.all(writes);
      var ok=results.every(function(response){return response.ok;});
      status.textContent=ok?'Saved just now':'Saved on this phone';
      return ok;
    }catch(error){status.textContent='Saved on this phone';return false;}
  }

  function csvCell(value){
    var text=String(value===null||value===undefined?'':value);
    return /[",\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
  }

  function downloadCsv(filename,rows){
    var csv=rows.map(function(row){return row.map(csvCell).join(',');}).join('\n')+'\n';
    var link=document.createElement('a');
    link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    link.download=filename;
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(function(){URL.revokeObjectURL(link.href);},0);
  }

  async function exportMeasurements(){
    var rows=[['date','time','fat_use_zone']];
    if(deviceId&&!readOnlyShare){
      try{
        var history=await Fox2DataFetch.fetchAllRows(SUPABASE_URL,'/rest/v1/readings?device_id=eq.'+encodeURIComponent(deviceId)+'&select=local_date,local_minute,ppm&order=reading_ts.asc',headers());
        history.forEach(function(reading){rows.push([reading.local_date,formatTime(Number(reading.local_minute)||0),Number(reading.ppm).toFixed(1)]);});
      }catch(error){}
    }
    if(rows.length===1){
      payloadDays.forEach(function(day){(day.readings||[]).forEach(function(reading){rows.push([day.localDate,formatTime(reading.minute),reading.value.toFixed(1)]);});});
    }
    downloadCsv('fox2-measurements.csv',rows);
  }

  function exportDailyAverages(){
    var rows=[['date','daily_average','tier','status']];
    Object.keys(dailyByDate).sort().forEach(function(date){
      var record=dailyByDate[date];
      if(!record||record.displayDailyAverage===null) return;
      rows.push([date,record.displayDailyAverage.toFixed(1),record.tierLabel,record.dayState]);
    });
    downloadCsv('fox2-daily-averages.csv',rows);
  }

  function shareSnapshotPayload(){
    var payload={};
    ['ws','d','a','t','s','h','tz','v','p','c','x','m','r'].forEach(function(key){var value=params.get(key);if(value) payload[key]=value;});
    return {
      v:1,captured_at:new Date().toISOString(),
      program:{tracking:trackingState},payload:payload,
      days:Object.keys(dailyByDate).sort().slice(-60).map(function(date){return {date:date,score:dailyByDate[date].canonicalAuc};}).filter(function(day){return Number.isFinite(Number(day.score));}),
      analysis:{readings:[],scores:[]}
    };
  }

  function copyText(text){
    if(navigator.clipboard&&navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    var field=document.createElement('textarea');field.value=text;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();document.execCommand('copy');field.remove();return Promise.resolve();
  }

  async function shareResults(){
    var status=document.getElementById('utility-status');
    status.textContent='Preparing secure share link…';
    try{
      var token=readOnlyShare&&/^[0-9a-f]{40}$/.test(shareToken)?shareToken:'';
      if(!token){
        var response=await fetch(SUPABASE_URL+'/rest/v1/rpc/create_share_snapshot',{method:'POST',headers:headers(),body:JSON.stringify({p_snapshot:shareSnapshotPayload(),p_expires_at:null})});
        if(!response.ok) throw new Error('Snapshot creation failed');
        token=String(await response.json()).replace(/^"|"$/g,'');
        if(!/^[0-9a-f]{40}$/.test(token)) throw new Error('Invalid share token');
      }
      var url=new URL('/graphs/',window.location.origin);url.searchParams.set('share',token);
      if(navigator.share){await navigator.share({title:'FOX2 results',url:url.toString()});status.textContent='Shared.';}
      else{await copyText(url.toString());status.textContent='Share link copied.';}
    }catch(error){
      if(error&&error.name==='AbortError') status.textContent='';
      else status.textContent='Share link could not be created. Check your connection and try again.';
    }
  }

  function bindUi(){
    var tabs=Array.from(document.querySelectorAll('.tab'));
    tabs.forEach(function(tab,index){
      tab.addEventListener('click',function(){switchView(tab.dataset.view);});
      tab.addEventListener('keydown',function(event){
        var next=index;
        if(event.key==='ArrowLeft') next=(index+tabs.length-1)%tabs.length;
        else if(event.key==='ArrowRight') next=(index+1)%tabs.length;
        else if(event.key==='Home') next=0;
        else if(event.key==='End') next=tabs.length-1;
        else return;
        event.preventDefault();switchView(tabs[next].dataset.view);tabs[next].focus();
      });
    });
    document.getElementById('start-tracking-shortcut').addEventListener('click',function(){switchView('tracking');if(!trackingState.tracking.active) openStartDialog();});
    document.getElementById('start-dialog').addEventListener('close',function(){if(this.returnValue==='start') saveStartForm();});
    document.getElementById('tracking-info-dialog').addEventListener('close',function(){var action=this.returnValue;if(action&&action!=='cancel') handleInfoAction(action);});
    document.getElementById('utility-button').addEventListener('click',function(){document.getElementById('utility-status').textContent='';document.getElementById('utility-dialog').showModal();});
    document.getElementById('share-results').addEventListener('click',shareResults);
    document.getElementById('export-measurements').addEventListener('click',exportMeasurements);
    document.getElementById('export-daily').addEventListener('click',exportDailyAverages);
    document.getElementById('nfc-sync-return').addEventListener('click',function(){if(handoffChannel) handoffChannel.postMessage({type:'focus',deviceId:deviceId,generation:handoffGeneration});window.close();});
  }

  async function init(){
    bindUi();
    if(!await loadFrozenShare()) return;
    if(readOnlyShare) document.getElementById('start-tracking-shortcut').hidden=true;
    setupSyncHandoff();
    if(await restoreLatestPayload()) return;
    payloadDays=parsePayload();
    if(payloadMeta&&!payloadMeta.supported){
      document.getElementById('loading-card').hidden=true;
      document.getElementById('unsupported-state').hidden=false;
      document.getElementById('unsupported-copy').textContent=payloadMeta.reason;
      return;
    }
    if(!localToday) localToday=isoDate(new Date());
    var results=await Promise.all([loadDailyHistory(),loadTracking()]);
    mergeDailyHistory(results[0]);
    await finalizeExpiredTracking();
    renderToday();renderTracking();renderHistory();
    var saved=await savePayload();
    finishSyncHandoff(saved);
  }

  init();
})();
