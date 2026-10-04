import { ObjectId } from 'mongodb';
import { getMongoTalentosCollection, mongoCandidateToCurriculum } from './mongo_talentos.js';
import { matchIntakeCandidates } from './opportunity-intake.js';

// Runtime and review operations load only current contact/eligibility data for
// candidates already found. Full CVs are streamed only for a new search.
export function createIntakeTalentReader({getCollection=getMongoTalentosCollection,convert=mongoCandidateToCurriculum}={}) {
  return {
    async loadTalent(ids) {
      if (!ids.length) return [];
      const values=[...ids,...ids.filter(id=>/^\d+$/.test(id)).map(Number)];
      const mongoIds=ids.filter(id=>/^mongo_[a-f0-9]{24}$/i.test(id)).map(id=>new ObjectId(id.slice(6)));
      const query={$or:[{id_controle:{$in:values}},{idControle:{$in:values}},{id:{$in:ids}},{_id:{$in:mongoIds}}]};
      const projection={_id:1,id_controle:1,idControle:1,id:1,nome:1,telefone:1,endereco:1,city:1,cidade:1,municipio:1,state:1,estado:1,uf:1,blackflag:1,blackFlag:1,black_flag:1,blacklist:1,blackList:1,black_list:1};
      const rows=[];
      for await (const row of (await getCollection()).find(query,{projection}).batchSize(25)) rows.push(convert(row));
      return rows;
    },
    async searchCandidates(fields) {
      const cursor=(await getCollection()).find({},{projection:{arquivo_base64:0,base64:0}}).batchSize(5);
      const candidates=[],seen=new Set();let totalEvaluated=0;
      for await (const row of cursor) {
        totalEvaluated++;
        const cv=convert(row),id=String(cv.id_controle||cv.id||'');
        if (!seen.has(id)) {seen.add(id);candidates.push(...matchIntakeCandidates([cv],fields));}
        if (totalEvaluated%10===0) await new Promise(resolve=>setImmediate(resolve));
      }
      candidates.sort((a,b)=>Number(b.location.allowed)-Number(a.location.allowed)||b.rankingScore-a.rankingScore||a.name.localeCompare(b.name,'pt-BR'));
      return {candidates,totalEvaluated};
    }
  };
}
