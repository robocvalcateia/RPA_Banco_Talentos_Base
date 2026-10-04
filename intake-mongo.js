import { MongoClient } from 'mongodb';
const readCollections = ['clients','users','opportunities','selectedCandidates','candidateMovements','opportunityIntakes','intakeNotifications','intakeRuntime'];
const writeCollections = ['opportunities','selectedCandidates','candidateMovements','opportunityIntakes','intakeNotifications','intakeRuntime'];
const clean = ({_id,...row}) => row;
// This adapter never replaces an entire collection or deletes unrelated records.
export function createMongoIntakeAdapter({ env=process.env, loadTalent, searchCandidates }) {
  let connection;
  async function connect() {
    if (!connection) connection=(async()=>{
      const url=env.MONGODB_URL || env.MONGODB_URI;
      if(!url)throw Error('MongoDB obrigatório para solicitações DTT em produção.');
      const client=await new MongoClient(url,{serverSelectionTimeoutMS:10000}).connect();
      const db=client.db(env.MONGODB_DB || 'Banco_de_Talentos'); const prefix=env.MONGODB_APP_COLLECTION_PREFIX || '';
      const collection=name=>db.collection(prefix+name);
      for(const name of ['opportunityIntakes','intakeNotifications','intakeRuntime','intakeSearchResults'])await collection(name).createIndex({id:1},{unique:true});
      await collection('intakeLocks').updateOne({_id:'transactions'},{$setOnInsert:{version:0}},{upsert:true});
      return {client,collection};
    })().catch(e=>{connection=null;throw e;});
    return connection;
  }
  async function snapshot(collection,session) {
    const state={};
    for(const name of readCollections) state[name]=(await collection(name).find({},{session}).toArray()).map(clean);
    const results=(await collection('intakeSearchResults').find({},{session}).toArray()).map(clean);
    for(const draft of state.opportunityIntakes) if(draft.search) draft.search.candidates=results.filter(r=>r.draftId===draft.id).sort((a,b)=>a.position-b.position).map(r=>r.candidate);
    state.curriculums=await loadTalent([...new Set(results.map(r=>String(r.candidate.id)))]);
    return state;
  }
  function documents(state) {
    const output={};
    for(const name of writeCollections)output[name]=(state[name] || []).map(row=>structuredClone(row));
    output.intakeSearchResults=[];
    for(const draft of output.opportunityIntakes) if(draft.search) {
      for(const [position,candidate] of (draft.search.candidates || []).entries())output.intakeSearchResults.push({id:`${draft.id}:${candidate.id}`,draftId:draft.id,position,candidate});
      delete draft.search.candidates;
    }
    return output;
  }
  return {
    searchCandidates,
    async readRuntime(){const {collection}=await connect();const row=await collection('intakeRuntime').findOne({id:'hourly'});return row?clean(row):null;},
    async read(){const {collection}=await connect();return snapshot(collection);},
    async transaction(operation){
      const {client,collection}=await connect();const session=client.startSession();let result;
      try {await session.withTransaction(async()=>{
        // All DTT writes acquire the same transactional document before reading.
        await collection('intakeLocks').updateOne({_id:'transactions'},{$inc:{version:1}},{session});
        const state=await snapshot(collection,session), before=documents(state);
        result=await operation(state);const after=documents(state);
        for(const [name,rows] of Object.entries(after)) {
          const old=new Map(before[name].map(row=>[row.id,JSON.stringify(row)]));
          for(const row of rows)if(old.get(row.id)!==JSON.stringify(row))await collection(name).replaceOne({id:row.id},row,{upsert:true,session});
          if(name==='intakeSearchResults'){
            const ids=new Set(rows.map(row=>row.id));const removed=before[name].filter(row=>!ids.has(row.id)).map(row=>row.id);
            if(removed.length)await collection(name).deleteMany({id:{$in:removed}},{session});
          }
        }
      },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});return result;}finally{await session.endSession();}
    }
  };
}
