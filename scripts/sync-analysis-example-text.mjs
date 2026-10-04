import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const publicRoot = new URL('../public/', import.meta.url);
for (const locale of ['ko', 'en']) {
  const ko = locale === 'ko';
  const path = new URL(`help/kabamanda-${locale}.html`, publicRoot);
  const d = new JSDOM(readFileSync(path, 'utf8')).window.document;
  const readResult = id => JSON.parse(readFileSync(new URL(`help/analysis-examples/${id}.json`, publicRoot), 'utf8'));
  const displayText = text => ko ? text.replace(/\b(\d+)\s+Stat Points?\b/gi, '노력치 $1').replace(/\bStat Points?\b/gi, '노력치') : text;
  const add = (parent, tag, value) => {
    const node = d.createElement(tag); node.textContent = value; parent.append(node); return node;
  };
  d.querySelectorAll('.analysis-accessible-text').forEach(node => node.remove());
  function attachText(parent, result, id) {
    const text = d.createElement('div');
    text.className = 'analysis-accessible-text'; text.id = id;
    text.dataset.source = result.id;
    add(text, 'h4', displayText(result.response.title));
    result.response.paragraphs.forEach(p => add(text, 'p', displayText(p)));
    for (const rec of result.response.recommendations) {
      add(text, 'h4', displayText(rec.title)); add(text, 'p', displayText(rec.reason));
      const candidate = result.response.optimizationCandidates?.find(c => c.id === rec.id);
      if (candidate) {
        add(text, 'p', `${candidate.natureDisplayName} · ${candidate.itemDisplayName}`);
        const labels = ko ? ['HP', '공격', '방어', '특수공격', '특수방어', '스피드'] : ['HP', 'Attack', 'Defense', 'Special Attack', 'Special Defense', 'Speed'];
        const keys = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'];
        add(text, 'p', `${ko ? '노력치' : 'Stat Points'}: ` + keys.map((key, i) => `${labels[i]} ${candidate.evs[key]}`).join(', '));
      }
    }
    const execution = result.execution;
    add(text, 'p', `${ko ? '소요 시간' : 'Time'}: ${(execution.durationMs / 1000).toFixed(1)}s · ${ko ? '총 토큰' : 'Total tokens'}: ${execution.totalTokens.toLocaleString('en-US')} · ${ko ? '추정 비용' : 'Estimated cost'}: $${execution.estimatedCostUsd.toFixed(5)}`);
    parent.append(text);
    return id;
  }
  const labels = ko
    ? { pokemon: '하마돈의 역할과 모래바람·기합의띠 주의점', team: '카바만다 팀의 메가진화별 선출과 운영', recommendation: '누리레느, 갸라도스, 워시로토무 추천', optimization: '메가보만다의 현재 샘플 검토', 'optimization-change': '미육성 메가보만다의 성격과 노력치 추천' }
    : { pokemon: 'Hippowdon’s role and sand timing for Focus Sash', team: 'Kabamanda’s Mega lineups and game plan', recommendation: 'Primarina, Gyarados, and Rotom-Wash recommendations', optimization: 'Review of Mega Salamence’s existing set', 'optimization-change': 'Nature and spread recommendation for untrained Mega Salamence' };
  for (const [scope, label] of Object.entries(labels)) {
    const result = readResult(`${locale}-${scope}-low`);
    const container = d.querySelector(`#${scope} > .analysis-showcase`);
    const figure = container.querySelector('.analysis-figure');
    figure.querySelector('img').alt = `PokePilot: ${label}.`;
    const id = attachText(container, result, `${scope}-accessible-result`);
    figure.querySelectorAll('a[data-analysis-image]').forEach(link => link.setAttribute('aria-details', id));
  }
  const columns = d.querySelectorAll('#comparison .example-model-pair > div');
  for (const [index, effort] of ['low', 'medium'].entries()) {
    const result = readResult(`${locale}-team-${effort}`);
    columns[index].querySelector('.example-output-quote p').textContent = result.response.recommendations[0].reason;
    const id = attachText(columns[index], result, `comparison-${effort}-accessible-result`);
    columns[index].querySelector('a').setAttribute('aria-details', id);
    const cells = d.querySelectorAll('#comparison tbody tr')[index].querySelectorAll('td');
    [ `${(result.execution.durationMs / 1000).toFixed(1)}s`, result.execution.totalTokens.toLocaleString('en-US'), `$${result.execution.estimatedCostUsd.toFixed(5)}` ].forEach((value, i) => { cells[i].textContent = value; });
  }
  d.querySelector('#comparison caption').textContent = ko ? '동일한 5마리 입력, 강도별로 고른 실제 응답 1건' : 'Identical five-member input, one selected response per effort';
  d.querySelector('#overview img').alt = ko ? '하마돈, 메가보만다, 메가루카리오Z, 브리두라스, 마스카나와 빈 슬롯 한 개' : 'Hippowdon, Mega Salamence, Mega Lucario Z, Archaludon, Meowscarada, and one empty slot';
  for (const img of d.querySelectorAll('img[src$=".png"]')) {
    const png = readFileSync(new URL(img.getAttribute('src').slice(1), publicRoot));
    img.width = png.readUInt32BE(16); img.height = png.readUInt32BE(20);
  }
  if (!ko) d.querySelector('meta[name="description"]').content = 'See real Pokemon, team, open-slot recommendations and set analysis for a Kabamanda team, with a Luna low versus medium comparison. No account or API key required.';
  writeFileSync(fileURLToPath(path), '<!doctype html>\n' + d.documentElement.outerHTML + '\n');
}
