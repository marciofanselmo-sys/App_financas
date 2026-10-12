/**
 * Palavras de nota de mercado, para corrigir o que o OCR leu errado
 * ("LTUG NISTA FINA" → "linguiça mista fina"). Só corrige quando a palavra
 * lida fica perto de UMA palavra da lista, pesando as letras que o OCR
 * costuma trocar (O/0/D, I/L/1/T, N/H/M…). Na dúvida, deixa como veio.
 */

const WORDS = `
abacate abacaxi abobora abobrinha acai acem achocolatado acucar adocante agua alcatra alface alho alho-poro
alimento almondega ameixa amendoim amido amaciante ameixa anchova apresuntado arroz atum aveia azeite azeitona
bacon bacalhau bala banana banha barra batata baunilha bebida beterraba bife biscoito bisnaguinha bolacha bolo
bombom brocolis cacau cafe caixa caju calabresa caldo camarao canela canjica capeletti carne carvao castanha
catchup cebola cebolinha cenoura cereal cereja cerveja champignon chantilly cha chiclete chocolate chuchu
coco coentro cogumelo colorau contrafile cookie copo costela couve coxa coxao cream creme creme-de-leite croissant
cuscuz damasco doce empanado energetico ervilha escarola espaguete espinafre extrato farinha farofa feijao fermento
figado file fraldinha framboesa frango fruta fuba gelatina geleia goiaba goiabada gordura granola grao grao-de-bico
groselha guarana hamburguer hortela inhame iogurte isotonico jilo ketchup kiwi lagarto laranja lasanha lata leite
legume lentilha limao linguica lombo louro maca macarrao maionese mamao mandioca manga manjericao manteiga maracuja
margarina massa mel melancia melao mexerica milho mingau miojo molho morango mortadela mostarda mucarela mussarela
nectar nhoque noz nuggets oleo oregano ovo paio palmito pao pao-de-queijo paprika patinho peito peixe pepino
pera pernil pessego picanha pimenta pimentao pipoca pizza polenta polpa presunto pudim queijo quiabo rabanete
ravioli refresco refrigerante repolho requeijao rucula sal salada salame salgadinho salmao salsa salsicha sardinha
sobrecoxa sorvete suco sucrilhos tapioca tempero tilapia tomate torrada torta toucinho trigo uva vagem vinagre vinho
whisky vodka cachaca espumante champanhe agua-de-coco cha-mate mate
aguardente bovina bovino suina suino frango-inteiro moida moido fatiado fatiada ralado ralada inteiro inteira
picado picada congelado congelada resfriado resfriada defumado defumada cozido cozida temperado temperada
integral desnatado desnatada semidesnatado semidesnatada zero light diet tradicional original natural sabor
morango chocolate baunilha limao laranja uva maracuja abacaxi coco amendoim caramelo leite mista misto fina fino
grosso grossa grande pequeno pequena medio media extra especial premium classico classica gourmet artesanal
ipa lager pilsen puro malte long neck garrafa lata pet unidade pacote fardo caixa bandeja pote sache
detergente sabao sabonete shampoo condicionador creme dental escova fio desodorante absorvente fralda
papel higienico toalha guardanapo saco lixo esponja palha aco alvejante agua-sanitaria desinfetante limpador
multiuso cloro vassoura rodo pano luva filtro aluminio filme plastico isqueiro fosforo pilha lampada
racao petisco areia gato cachorro
`.split(/\s+/).filter(Boolean)

// Marcas: saem com inicial maiúscula ("Bis Lacta").
const BRANDS = `
lacta nestle garoto sadia seara perdigao aurora quata italac piracanjuba parmalat elege itambe danone vigor
batavo tirolez president polenghi catupiry seara swift friboi maturatta tio joao camil kicaldo namorado
dona benta renata adria barilla piraque bauducco marilan vitarella panco pullman wickbold visconti
coca-cola coca cola pepsi fanta sprite guarana antarctica skol brahma heineken budweiser amstel stella artois
corona original itaipava spaten eisenbahn leopoldina colorado baden devassa patagonia becks
ype omo ariel brilhante comfort downy minuano veja pinho sol bombril scott neve personal sempre-livre
colgate sorriso oral-b close-up dove rexona nivea palmolive protex lux seda pantene elseve
`.split(/\s+/).filter(Boolean)

// Acentos de volta nas palavras comuns (a lista acima é sem acento para casar).
const ACCENT: Record<string, string> = {
  abobora: 'abóbora', acai: 'açaí', acem: 'acém', acucar: 'açúcar', adocante: 'adoçante', agua: 'água',
  almondega: 'almôndega', brocolis: 'brócolis', cafe: 'café', camarao: 'camarão', cha: 'chá', file: 'filé',
  coxao: 'coxão', feijao: 'feijão', figado: 'fígado', grao: 'grão', guarana: 'guaraná', hamburguer: 'hambúrguer',
  hortela: 'hortelã', jilo: 'jiló', limao: 'limão', linguica: 'linguiça', maca: 'maçã', macarrao: 'macarrão',
  mamao: 'mamão', manjericao: 'manjericão', maracuja: 'maracujá', melao: 'melão', mucarela: 'muçarela',
  nectar: 'néctar', oleo: 'óleo', oregano: 'orégano', pao: 'pão', pessego: 'pêssego', pimentao: 'pimentão',
  requeijao: 'requeijão', rucula: 'rúcula', salmao: 'salmão', sabao: 'sabão', higienico: 'higiênico',
  tilapia: 'tilápia', suina: 'suína', suino: 'suíno', moida: 'moída', moido: 'moído', isotonico: 'isotônico',
  energetico: 'energético', medio: 'médio', media: 'média', classico: 'clássico', classica: 'clássica',
  perdigao: 'perdigão', joao: 'joão', racao: 'ração', cachaca: 'cachaça', aluminio: 'alumínio', plastico: 'plástico',
  fosforo: 'fósforo', lampada: 'lâmpada', aco: 'aço', sache: 'sachê', sucrilhos: 'sucrilhos', cuscuz: 'cuscuz',
}

const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '')

const DICT = new Map<string, string>()
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
for (const w of WORDS) {
  for (const part of w.split('-')) {
    const key = norm(part)
    if (key.length >= 2 && !DICT.has(key)) DICT.set(key, ACCENT[part] ?? part)
  }
}
// Marca vence palavra comum só quando não é palavra comum ("original" segue minúsculo).
for (const w of BRANDS) {
  for (const part of w.split('-')) {
    const key = norm(part)
    if (key.length >= 2 && !DICT.has(key)) DICT.set(key, cap(ACCENT[part] ?? part))
  }
}
// Siglas que ficam em maiúsculas.
for (const s of ['IPA', 'APA', 'PET', 'UHT']) DICT.set(s, s)

/**
 * Abreviações da nota entram como palavras também — assim um "LTUG" mal lido
 * ainda chega em "LING" → linguiça.
 */
export function addAbbreviations(map: Record<string, string>) {
  for (const [k, v] of Object.entries(map)) if (k.length >= 4 && !DICT.has(k)) DICT.set(k, v)
}

// Letras que o OCR confunde entre si: trocar uma pela outra custa metade.
const CONFUSABLE = ['O0DQC', 'IL1TJ', 'NHM', 'UVY', 'CGO', 'EF', 'B8R', 'S5', 'G6', 'Z2', 'A4', 'UN']
function subCost(a: string, b: string): number {
  if (a === b) return 0
  return CONFUSABLE.some(g => g.includes(a) && g.includes(b)) ? 0.5 : 1
}

function distance(a: string, b: string, limit: number): number {
  const prev = new Array(b.length + 1).fill(0).map((_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + subCost(a[i - 1], b[j - 1]))
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > limit) return Infinity
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
  }
  return prev[b.length]
}

/** A palavra da lista mais perto da lida, ou null se não houver uma clara. */
export function correctWord(raw: string): string | null {
  const key = norm(raw)
  if (key.length < 3 || /\d/.test(key)) return null
  const exact = DICT.get(key)
  if (exact) return exact
  if (key.length < 4) return null
  const limit = key.length >= 7 ? 2 : 1
  let best: string | null = null, bestD = Infinity, tie = false
  for (const [k, v] of DICT) {
    if (Math.abs(k.length - key.length) > 1) continue
    const d = distance(key, k, limit)
    if (d < bestD) { best = v; bestD = d; tie = false }
    else if (d === bestD && v !== best) tie = true
  }
  return best && bestD <= limit && !tie ? best : null
}

/** Quantas palavras do nome são de mercado — mede quão "legível" saiu a leitura. */
export function knownWords(description: string): number {
  return description.split(/\s+/).filter(w => DICT.has(norm(w))).length
}
