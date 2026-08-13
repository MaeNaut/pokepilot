import type {
  GameDescriptionCategory,
  GameTranslationCategory,
} from "../gameTranslations";

const koChampionsMegaStoneNames = {
  barbaracite: "거북손데스나이트",
  chandelurite: "샹델라나이트",
  chesnaughtite: "브리가론나이트",
  chimechite: "치렁나이트",
  clefablite: "픽시나이트",
  crabominite: "모단단게나이트",
  delphoxite: "마폭시나이트",
  dragalgite: "드래캄나이트",
  dragoninite: "망나뇽나이트",
  drampanite: "할비롱나이트",
  eelektrossite: "저리더프나이트",
  emboarite: "염무왕나이트",
  excadrite: "몰드류나이트",
  falinksite: "대여르나이트",
  feraligite: "장크로다일나이트",
  floettite: "플라엣테나이트",
  froslassite: "눈여아나이트",
  glimmoranite: "킬라플로르나이트",
  golurkite: "골루그나이트",
  greninjite: "개굴닌자나이트",
  hawluchanite: "루차불나이트",
  malamarite: "칼라마네로나이트",
  meganiumite: "메가니움나이트",
  meowsticite: "냐오닉스나이트",
  pyroarite: "화염레오나이트",
  raichunitex: "라이츄나이트X",
  raichunitey: "라이츄나이트Y",
  scolipite: "펜드라나이트",
  scovillainite: "스코빌런나이트",
  scraftinite: "곤율거니나이트",
  skarmorite: "무장조나이트",
  staraptite: "찌르호크나이트",
  starminite: "아쿠스타나이트",
  victreebelite: "우츠보트나이트",
} satisfies Record<string, string>;

const koChampionsMegaStoneDescriptions = Object.fromEntries(
  Object.keys(koChampionsMegaStoneNames).map((id) => [
    id,
    "대응하는 포켓몬에게 지니게 하면 배틀 중 메가진화할 수 있다.",
  ]),
) as Record<string, string>;

export const koGameOverrides: Partial<
  Record<GameTranslationCategory, Record<string, string>>
> = {
  // Keep intentional PokePilot terminology changes here so regenerating the
  // PokeAPI snapshot never overwrites them.
  abilities: {
    eelevate: "천정부지",
    firemane: "불꽃의갈기",
  },
  items: {
    ...koChampionsMegaStoneNames,
    fairyfeather: "요정의깃털",
  },
};

export const koGameDescriptionOverrides: Partial<
  Record<GameDescriptionCategory, Record<string, string>>
> = {
  // Description corrections use the same normalized canonical IDs as names.
  abilities: {
    armortail: "자신과 같은 편의 포켓몬은 상대의 우선도 기술을 받지 않는다.",
    cudchew:
      "나무열매를 먹으면 다음 턴이 끝날 때 같은 나무열매를 한 번 더 먹는다.",
    dragonize: "노말타입 기술이 드래곤타입이 되고 위력이 1.2배가 된다.",
    eartheater:
      "땅타입 기술을 받지 않고 최대 HP의 4분의 1만큼 회복한다.",
    eelevate:
      "땅타입 기술과 압정뿌리기, 독압정, 끈적끈적네트의 효과를 받지 않는다. 공격으로 상대를 쓰러뜨리면 가장 높은 능력이 1단계 올라간다.",
    electromorphosis: "공격 기술을 받으면 충전 상태가 된다.",
    firemane: "불꽃타입 기술의 위력이 1.5배가 된다.",
    goodasgold: "변화 기술의 효과를 받지 않는다.",
    hospitality:
      "등장했을 때 같은 편 포켓몬의 최대 HP를 4분의 1만큼 회복한다.",
    megasol: "자신이 사용하는 기술은 쾌청 상태인 것처럼 효과가 적용된다.",
    opportunist: "상대의 능력이 올라가면 자신도 똑같이 능력을 올린다.",
    piercingdrill:
      "상대가 방어 중이어도 접촉 기술이 적중하며 이때 데미지는 평소의 4분의 1이 된다.",
    purifyingsalt:
      "상태 이상이 되지 않으며 고스트타입 기술로 받는 데미지가 절반이 된다.",
    sharpness: "베기 기술의 위력이 1.5배가 된다.",
    spicyspray: "공격 기술을 받으면 공격한 상대를 화상 상태로 만든다.",
    supersweetsyrup:
      "배틀에서 처음 등장했을 때 한 번만 상대 전체의 회피율을 1단계 떨어뜨린다.",
    supremeoverlord:
      "쓰러진 같은 편 포켓몬 1마리마다 기술의 위력이 10%씩 올라간다. 최대 5마리까지 적용된다.",
    toxicdebris:
      "물리 기술로 데미지를 받으면 상대 진영에 독압정을 설치한다.",
    zerotohero:
      "나이브폼인 돌핀맨이 교체로 물러나면 마이티폼으로 변한다.",
  },
  items: {
    ...koChampionsMegaStoneDescriptions,
    fairyfeather: "지니게 하면 페어리타입 기술의 위력이 1.2배가 된다.",
  },
  moves: {
    alluringvoice:
      "이번 턴에 능력치가 오른 상대라면 반드시 혼란 상태로 만든다.",
    aquacutter: "급소에 맞기 쉽다.",
    aquastep: "자신의 스피드를 1단계 올린다.",
    armorcannon: "자신의 방어와 특수방어가 1단계 떨어진다.",
    axekick:
      "30% 확률로 상대를 혼란시킨다. 빗나가면 자신의 최대 HP의 절반만큼 데미지를 받는다.",
    barbbarrage:
      "50% 확률로 상대를 독 상태로 만든다. 상대가 이미 독 상태라면 위력이 2배가 된다.",
    bitterblade: "준 데미지의 절반만큼 자신의 HP를 회복한다.",
    bittermalice: "상대의 공격을 1단계 떨어뜨린다.",
    ceaselessedge: "상대 진영에 압정을 1번 설치한다.",
    chillingwater: "상대의 공격을 1단계 떨어뜨린다.",
    chillyreception: "눈이 내리게 하고 교대 포켓몬과 교체한다.",
    comeuppance:
      "그 턴에 공격 기술로 받은 데미지의 1.5배를 상대에게 되돌려준다.",
    direclaw:
      "50% 확률로 상대를 독, 마비, 잠듦 중 하나의 상태로 만든다.",
    dragoncheer:
      "같은 편의 급소율을 1단계 올린다. 대상이 드래곤타입이면 2단계 올린다.",
    electroshot:
      "특수공격을 1단계 올리고 다음 턴에 공격한다. 비가 내리면 바로 공격한다.",
    ficklebeam: "30% 확률로 위력이 2배가 된다.",
    flowertrick: "반드시 급소에 맞으며 명중률 검사를 하지 않는다.",
    gigatonhammer: "사용한 다음 턴에는 선택할 수 없다.",
    hardpress: "상대의 남은 HP가 많을수록 위력이 올라간다.",
    headlongrush: "자신의 방어와 특수방어가 1단계 떨어진다.",
    icespinner: "필드의 효과를 없앤다.",
    infernalparade:
      "30% 확률로 상대를 화상 상태로 만든다. 상대가 상태 이상이면 위력이 2배가 된다.",
    jetpunch: "우선도 +1로 공격한다.",
    kowtowcleave: "자신의 명중률과 상대의 회피율 변화에 관계없이 명중한다.",
    lastrespects: "쓰러진 같은 편 포켓몬 1마리마다 위력이 50씩 올라간다.",
    luminacrash: "상대의 특수방어를 2단계 떨어뜨린다.",
    makeitrain:
      "상대 전체를 공격하고 자신의 특수공격이 1단계 떨어진다.",
    matchagotcha:
      "20% 확률로 상대를 화상 상태로 만들고 준 데미지의 절반만큼 HP를 회복한다. 상대의 얼음 상태를 치료한다.",
    mortalspin:
      "상대 전체를 독 상태로 만들고 자신에게 설치된 함정과 조이기, 씨뿌리기 효과를 없앤다.",
    mountaingale: "30% 확률로 상대를 풀죽게 한다.",
    populationbomb: "최대 10번 공격하며 공격마다 명중 여부를 판정한다.",
    pounce: "상대의 스피드를 1단계 떨어뜨린다.",
    psychicnoise: "2턴 동안 상대가 HP를 회복할 수 없게 한다.",
    psyshieldbash: "자신의 방어를 1단계 올린다.",
    ragefist:
      "공격받은 횟수마다 위력이 50씩 올라간다. 최대 6번까지 적용된다.",
    ragingbull:
      "상대 진영의 장막을 없앤다. 사용자의 모습에 따라 타입이 바뀐다.",
    ragingfury:
      "2~3턴 동안 계속 사용한 뒤 자신이 혼란 상태가 된다.",
    saltcure:
      "매 턴 상대 최대 HP의 8분의 1만큼 데미지를 준다. 강철타입과 물타입에게는 4분의 1만큼 준다.",
    shedtail:
      "최대 HP의 절반을 소모해 대타출동을 만들고 교대 포켓몬에게 넘긴다.",
    shelter: "자신의 방어를 2단계 올린다.",
    snowscape:
      "5턴 동안 눈이 내리게 한다. 얼음타입 포켓몬의 방어가 1.5배가 된다.",
    spicyextract:
      "상대의 공격을 2단계 올리고 방어를 2단계 떨어뜨린다.",
    stoneaxe: "상대 진영에 스텔스록을 설치한다.",
    supercellslam:
      "빗나가면 자신의 최대 HP의 절반만큼 데미지를 받는다.",
    syrupbomb: "3턴 동안 매 턴 상대의 스피드를 1단계 떨어뜨린다.",
    temperflare: "직전에 사용한 기술이 실패했다면 위력이 2배가 된다.",
    terablast:
      "테라스탈 중에는 테라스탈타입이 되며 공격과 특수공격 중 높은 능력으로 공격한다.",
    tidyup:
      "자신의 공격과 스피드를 1단계 올리고 양쪽의 대타출동과 설치물을 모두 없앤다.",
    torchsong: "자신의 특수공격을 1단계 올린다.",
    trailblaze: "자신의 스피드를 1단계 올린다.",
    triplearrows:
      "급소에 맞기 쉽다. 50% 확률로 상대의 방어를 1단계 떨어뜨리고 30% 확률로 풀죽게 한다.",
    twinbeam: "한 턴에 2번 공격한다.",
    upperhand:
      "상대를 반드시 풀죽게 한다. 상대가 우선도 기술을 선택하지 않았다면 실패한다.",
    wavecrash: "준 데미지의 3분의 1만큼 반동 데미지를 받는다.",
  },
};
