import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import type { CopilotAnalysisRequest } from '../src/utils/copilotContracts';
import type { AiTeamFixture } from '../src/test/fixtures/aiTeamFixtureTypes';
import { createHash } from 'node:crypto';
import { installAiEvaluationRuntime } from '../scripts/aiEvaluationRuntime';
import { resolveOpenAiEvaluationApiKey } from '../server/openAiEnvironment';
import { analyzeWithOpenAiLuna, type LunaReasoningEffort } from '../server/openAiLuna';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { reviewHostedCopilotAnalysis } from '../server/pokepilotAnalysisValidation';
import { fetchPokemon } from '../src/api/pokeApi';
import { fetchPokemonIndex } from '../src/api/pokemonIndex';
import { fetchAbilityIndex, fetchItem, fetchItemIndex } from '../src/api/showdownCatalog';
import { loadShowdownData } from '../src/api/showdownData';
import { loadShowdownLegality } from '../src/api/showdownLegality';
import { createAiFixtureAnalysisContext, createAiPokemonRecommendationEvaluationCase } from '../src/test/evaluation/aiModelEvaluation';
import { createCopilotAnalysisRequest } from '../src/utils/copilotRequestBuilder';
import { loadPopularUsageSet } from '../src/api/battleUsage';
import { resolveUsageCalculatorItems } from '../src/calculator/calculatorUsageBuild';
import { createGeneralSetOptimizationPlan } from '../src/calculator/setOptimizer/generalPlan';

const argument=(name:string,fallback:string)=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const root=process.cwd(), restore=installAiEvaluationRuntime(root), dir=argument('output','.tmp/mc-evaluation');
mkdirSync(dir,{recursive:true});
try {
  const path=`${dir}/${argument('requests',(process.argv.includes('--after')||process.argv.includes('--final')||process.argv.includes('--expanded'))?'requests-after':'requests')}.json`;
  let requests:Record<string,CopilotAnalysisRequest>={};
  if(existsSync(path)) requests=JSON.parse(readFileSync(path,'utf8'));
  else {
    const pokemonIndex=await fetchPokemonIndex(),itemIndex=await fetchItemIndex(),abilityIndex=await fetchAbilityIndex(),showdownData=await loadShowdownData(),legality=await loadShowdownLegality();
    const options={pokemonIndex,itemIndex,abilityIndex,showdownData,legality,services:{fetchPokemon,fetchItem}};
    for(const fixture of JSON.parse(readFileSync(argument('fixtures','src/test/fixtures/aiMcPublishedTeams.json'),'utf8')) as AiTeamFixture[]) {
      const context=await createAiFixtureAnalysisContext(fixture,options);
      const expectedItemCount=fixture.showdownText.split('\n').filter(line=>line.includes(' @ ')).length;
      if(context.team.filter(Boolean).length!==6 || Object.values(context.buildState.itemBySlot).filter(Boolean).length!==expectedItemCount || context.validity.status!=='valid') {
        throw new Error(`Incomplete or invalid import for ${fixture.id}`);
      }
      console.log('Imported',fixture.id,context.team.map(p=>p?.name),JSON.stringify(context.validity));
      const slot=fixture.id==='mc-lloyd'?5:fixture.id==='mc-tagerau'?1:0;
      const member=context.team[slot]!,b=context.buildState,usageSet=await loadPopularUsageSet(member.id,fixture.battleFormat);
      if (!usageSet) throw new Error(`No usage sample for ${fixture.id}`);
      const plan=createGeneralSetOptimizationPlan({selectedSlot:slot,member,build:{item:b.itemBySlot[slot]??null,ability:b.abilityBySlot[slot]!,natureId:b.natureBySlot[slot]!,evs:b.evsBySlot[slot]!,moveIds:b.moveIdsBySlot[slot]!},reservedItemIds:context.team.flatMap((m,i)=>i!==slot&&m&&b.itemBySlot[i]?[b.itemBySlot[i]!.showdownId??b.itemBySlot[i]!.id]:[]),usageSet,usageItems:resolveUsageCalculatorItems(usageSet,itemIndex,4)});
      const rec=await createAiPokemonRecommendationEvaluationCase(fixture,5,options,{recommendationMode:'addition'});
      const five=await createAiFixtureAnalysisContext(fixture,options,5);
      for(const scope of ['team','pokemon','recommendation','optimization'] as const) {
        requests[`${fixture.id}-${scope}`]=createCopilotAnalysisRequest({scope,locale:'ko',battleFormat:fixture.battleFormat,teamName:fixture.title,...(scope==='recommendation'?five:context),pokemonIndex,abilityIndex,showdownData,selectedSlot:scope==='recommendation'?5:slot,...(scope==='recommendation'?{recommendationCandidates:rec.request.recommendationCandidates}:{}),...(scope==='optimization'?{optimizationPlan:plan}:{})});
      }
    }
    writeFileSync(path,JSON.stringify(requests));
  }
  if(process.argv.includes('--run')) {
    const effort=argument('effort','low');
    if(!['none','low','medium','high'].includes(effort)) throw new Error(`Invalid reasoning effort: ${effort}`);
    const adapterPath=argument('adapter','');
    const analyze:typeof analyzeWithOpenAiLuna=adapterPath
      ? (await import(pathToFileURL(resolve(adapterPath)).href)).analyzeWithOpenAiLuna
      : analyzeWithOpenAiLuna;
    const apiKey=resolveOpenAiEvaluationApiKey(root),phase=argument('phase',process.argv.includes('--expanded')?'expanded':process.argv.includes('--final')?'final':process.argv.includes('--after')?'after':'before');
    for(const [id,request] of Object.entries(requests)) {
      if(!id.startsWith(argument('only',''))) continue;
      const out=`${dir}/${phase}-${id}.json`;
      if(existsSync(out)) continue;
      const start=Date.now();console.log('Calling',phase,id);
      try {
        const result=await analyze(request,{apiKey,reasoningEffort:effort as LunaReasoningEffort,cacheNamespace:'evaluation',maxRetries:0,timeoutMs:240000});
        const reviewed=reviewHostedCopilotAnalysis(result.output,request);
        const record={id,phase,inputHash:createHash('sha256').update(JSON.stringify(request)).digest('hex'),durationMs:Date.now()-start,result,reviewed};
        writeFileSync(out,JSON.stringify(record,null,2));
        console.log('Saved',id,record.durationMs,result.usage.costUsd,JSON.stringify(reviewed.qualityWarnings));
      } catch(error) {writeFileSync(out,JSON.stringify({id,error:String(error),durationMs:Date.now()-start}));console.log('FAILED',id,String(error));}
    }
  }
} finally {restore();}
