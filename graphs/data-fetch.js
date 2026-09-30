/* Paginated Supabase reads for tables that may exceed the API's row cap. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.Fox2DataFetch=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function fetchAllRows(baseUrl,path,headers,options){
    options=options||{};
    var pageSize=options.pageSize||1000;
    var fetchImpl=options.fetchImpl||(typeof fetch==='function'?fetch:null);
    if(!fetchImpl) return Promise.reject(new Error('fetch is unavailable'));
    var separator=path.indexOf('?')===-1?'?':'&';

    function readPage(offset){
      var url=baseUrl+path+separator+'limit='+pageSize+'&offset='+offset;
      return fetchImpl(url,{method:'GET',headers:headers}).then(function(response){
        if(!response.ok) throw new Error('FOX2 history request failed with '+response.status);
        return response.json();
      }).then(function(rows){
        rows=Array.isArray(rows)?rows:[];
        if(rows.length<pageSize) return rows;
        return readPage(offset+pageSize).then(function(nextRows){return rows.concat(nextRows);});
      });
    }

    return readPage(0);
  }

  return {fetchAllRows:fetchAllRows};
});
