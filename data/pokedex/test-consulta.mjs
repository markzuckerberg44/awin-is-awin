import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {consultarSeriesEspecie} from './consultar-series.mjs';
const catalog = JSON.parse(await readFile(new URL('./export/catalogo.json', import.meta.url)));
const mockFetch = async url => {
  const name=decodeURIComponent(url.split('/').pop());
  const data=JSON.parse(await readFile(new URL(`./export/${name}`,import.meta.url)));
  return {ok:true,json:async()=>data};
};
for (const species of catalog.species) {
  const result=await consultarSeriesEspecie({speciesId:species.id,fetchFn:mockFetch});
  const original=await (await mockFetch(`${species.id}.json`)).json();
  assert.equal(result.variables.length,original.survival_card.requirements.length);
  for(const variable of result.variables) {
    assert.ok(variable.series.every(r=>r.year<=2014 && typeof r.value==='number'));
    assert.equal(variable.source.provider,'NASA POWER');
    assert.ok(Array.isArray(variable.nasaParameters) && variable.nasaParameters.length>0);
  }
}
await assert.rejects(()=>consultarSeriesEspecie({speciesId:'melomys',locationId:'not-a-location',fetchFn:mockFetch}));
await assert.rejects(()=>consultarSeriesEspecie({speciesId:'melomys',endYear:2030,fetchFn:mockFetch}));
// The query must follow an expanded card, not a hardcoded three-variable list.
const expanded=await (await mockFetch('melomys.json')).json();
const card=expanded.survival_card;
card.requirements.push({...card.requirements[0],indicator_id:'fourth_test_indicator'});
for(const [lid,per] of Object.entries(card.comparison_series)) {
  per.fourth_test_indicator=per[card.requirements[0].indicator_id];
  card.comparisons[lid].fourth_test_indicator=card.comparisons[lid][card.requirements[0].indicator_id];
}
const four=await consultarSeriesEspecie({speciesId:'melomys',fetchFn:async()=>({ok:true,json:async()=>expanded})});
assert.equal(four.variables.length,4);
console.log('OK: 15 species, numeric series, invalid inputs and a four-indicator fixture.');
