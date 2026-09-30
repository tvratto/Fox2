const assert=require('assert');
const dataFetch=require('./data-fetch.js');

(async function(){
  const source=Array.from({length:2166},function(_,index){return {id:index};});
  const requested=[];
  function fakeFetch(url){
    const parsed=new URL(url);
    const limit=Number(parsed.searchParams.get('limit'));
    const offset=Number(parsed.searchParams.get('offset'));
    requested.push(offset);
    return Promise.resolve({
      ok:true,
      status:200,
      json:function(){return Promise.resolve(source.slice(offset,offset+limit));}
    });
  }
  const rows=await dataFetch.fetchAllRows('https://example.test','/rows?order=id.asc',{}, {fetchImpl:fakeFetch,pageSize:1000});
  assert.equal(rows.length,2166);
  assert.deepEqual(requested,[0,1000,2000]);
  assert.equal(rows[2165].id,2165);
  console.log('data-fetch tests passed');
})().catch(function(error){console.error(error);process.exit(1);});
