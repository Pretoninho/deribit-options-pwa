/**
 * data_processing/signals/onchain_signals.js
 *
 * Signaux basés sur les données on-chain Bitcoin.
 * Quatre fonctions indépendantes + un signal composite.
 *
 * Format des descriptions novice :
 *   { metaphor, situation, action, gain, risk }
 */

// ── Helpers ────────────────────────────────────────────────────────────────

/** Calcule une moyenne simple d'un tableau de nombres. */
function avg(arr) {
  if (!arr?.length) return null
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

// ── Signal 1 : Exchange Flow ──────────────────────────────────────────────────

/**
 * Détecte un signal directionnel à partir du flux net exchanges.
 *
 * @param {{ netflow: number|null, signal: string, strength: string }} flowData
 * @param {{ price: number|null }} [priceData]
 * @param {number[]} [history7d] — historique des netflows 7j pour calcul moyenne
 * @returns {{
 *   signal: 'ACCUMULATION'|'DISTRIBUTION'|'NEUTRAL',
 *   strength: 'weak'|'moderate'|'strong',
 *   description_expert: string,
 *   description_novice: { metaphor, situation, action, gain, risk }
 * }}
 */
export function detectExchangeFlowSignal(flowData, priceData, history7d) {
  const netflow = flowData?.netflow ?? null
  const avg7d   = avg(history7d)

  // Déterminer si le flux est anormal par rapport à la moyenne 7j
  let signal   = 'NEUTRAL'
  let strength = flowData?.strength ?? 'weak'

  if (netflow != null) {
    const multiplier = avg7d != null && avg7d !== 0
      ? Math.abs(netflow) / Math.abs(avg7d)
      : 1

    if (netflow < 0 && (avg7d == null || multiplier >= 1.5)) {
      // Outflow fort → accumulation haussière
      signal   = 'ACCUMULATION'
      strength = multiplier >= 2.5 ? 'strong' : multiplier >= 1.5 ? 'moderate' : 'weak'
    } else if (netflow > 0 && (avg7d == null || multiplier >= 1.5)) {
      // Inflow fort → distribution baissière
      signal   = 'DISTRIBUTION'
      strength = multiplier >= 2.5 ? 'strong' : multiplier >= 1.5 ? 'moderate' : 'weak'
    } else if (netflow < 0) {
      signal = 'ACCUMULATION'
    } else if (netflow > 0) {
      signal = 'DISTRIBUTION'
    }
  }

  const netflowFmt = netflow != null ? `${netflow > 0 ? '+' : ''}${Math.round(netflow).toLocaleString()} BTC` : 'N/A'

  const descriptionExpert = signal === 'ACCUMULATION'
    ? `Outflow net exchanges : ${netflowFmt}. Les holders retirent du BTC des plateformes, réduisant l'offre disponible à la vente. Contexte haussier structurel${strength === 'strong' ? ' — signal fort au-delà de 1,5× la moyenne 7j' : ''}.`
    : signal === 'DISTRIBUTION'
    ? `Inflow net exchanges : ${netflowFmt}. Mouvement massif vers les exchanges, pression vendeuse potentielle. Contexte baissier${strength === 'strong' ? ' — signal fort au-delà de 1,5× la moyenne 7j' : ''}.`
    : `Flux net exchanges équilibré (${netflowFmt}). Pas de signal directionnel clair.`

  const descriptionNovice = signal === 'ACCUMULATION'
    ? {
        metaphor:  'Comme des gens qui retirent leur argent de la banque pour le mettre sous leur matelas...',
        situation: `Les investisseurs bougent ${Math.abs(netflow ?? 0) > 1000 ? 'beaucoup de' : 'du'} Bitcoin hors des exchanges — ils ne veulent pas vendre.`,
        action:    'Tu peux envisager d\'acheter progressivement sur Binance (DCA) et de conserver en cold wallet.',
        gain:      `Signal ${strength === 'strong' ? 'fort' : 'modéré'} historiquement associé à des hausses dans les semaines suivantes.`,
        risk:      'Ce signal seul ne garantit rien — combine-le avec l\'analyse de prix avant d\'agir.',
      }
    : signal === 'DISTRIBUTION'
    ? {
        metaphor:  'Comme des gens qui apportent leur épargne en banque avant une grosse dépense...',
        situation: `Des investisseurs transfèrent ${Math.abs(netflow ?? 0) > 1000 ? 'beaucoup de' : 'du'} Bitcoin vers les exchanges — signe qu\'ils pourraient vendre.`,
        action:    'Sois prudent(e) : évite d\'acheter une grosse position maintenant. Sur Nexo, tu peux sécuriser en stablecoin temporairement.',
        gain:      'Protéger ton capital en période de distribution peut éviter de perdre 10-30%.',
        risk:      'Certains transferts exchanges sont dus aux institutionnels pour faire du collatéral, pas forcément pour vendre.',
      }
    : {
        metaphor:  'Comme un marché calme un dimanche matin...',
        situation: 'Les mouvements BTC vers/depuis les exchanges sont normaux — pas de signal fort.',
        action:    'Pas d\'action urgente. Continue ton plan d\'investissement habituel sur Binance.',
        gain:      'Économise les frais en n\'agissant pas sur des signaux faibles.',
        risk:      'L\'inaction peut faire manquer des opportunités — reste attentif(ve).',
      }

  return { signal, strength, description_expert: descriptionExpert, description_novice: descriptionNovice }
}

// ── Signal 2 : Mempool ────────────────────────────────────────────────────────

/**
 * Analyse la congestion du mempool Bitcoin.
 *
 * @param {{ txCount: number|null, congestion: string, fastFee: number|null, hourFee: number|null }} mempoolData
 * @returns {{
 *   signal: 'CALM'|'ACTIVE'|'CONGESTED'|'CRITICAL',
 *   congestionLevel: 'low'|'medium'|'high'|'critical',
 *   description_expert: string,
 *   description_novice: { metaphor, situation, action, gain, risk }
 * }}
 */
export function detectMempoolSignal(mempoolData) {
  const txCount    = mempoolData?.txCount    ?? null
  const fastFee    = mempoolData?.fastFee    ?? null
  const congestion = mempoolData?.congestion ?? 'low'

  let signal = 'CALM'
  if (congestion === 'critical' || (fastFee != null && fastFee > 100)) signal = 'CRITICAL'
  else if (congestion === 'high' || (fastFee != null && fastFee > 50))  signal = 'CONGESTED'
  else if (congestion === 'medium')                                       signal = 'ACTIVE'

  const txFmt  = txCount != null ? `${txCount.toLocaleString()} tx` : 'N/A'
  const feeFmt = fastFee != null ? `${fastFee} sats/vbyte` : 'N/A'

  const descriptionExpert = signal === 'CRITICAL'
    ? `Mempool critique : ${txFmt} en attente, fees rapides à ${feeFmt}. Activité réseau anormalement élevée — possibilité de mouvement de prix imminent ou liquidations en chaîne.`
    : signal === 'CONGESTED'
    ? `Mempool congestionné : ${txFmt} en attente, fees à ${feeFmt}. Activité supérieure à la normale — surveiller les bougies courtes pour signaux de momentum.`
    : signal === 'ACTIVE'
    ? `Activité mempool modérée : ${txFmt}, fees à ${feeFmt}. Réseau sous charge normale.`
    : `Mempool calme : ${txFmt}, fees à ${feeFmt}. Faible activité on-chain.`

  const descriptionNovice = signal === 'CRITICAL'
    ? {
        metaphor:  'Comme une autoroute bouchée un vendredi soir — tout le monde veut passer en même temps...',
        situation: `Il y a ${txFmt} de transactions Bitcoin bloquées. Quelque chose de gros se passe sur le réseau.`,
        action:    'Attention : un mouvement de prix fort est possible dans les prochaines heures. Ne place pas d\'ordre important sans stop-loss sur Binance.',
        gain:      'Les traders qui anticipent ces moments peuvent capturer des mouvements de 5-15%.',
        risk:      'Ce n\'est pas toujours un mouvement haussier — ça peut aussi être des liquidations en cascade.',
      }
    : signal === 'CONGESTED'
    ? {
        metaphor:  'Comme une salle de concert qui se remplit — il se passe quelque chose...',
        situation: `Le réseau Bitcoin est occupé (${txFmt} en attente). Activité supérieure à la normale.`,
        action:    'Surveille le marché de près. Sur Binance, active les alertes de prix pour ton asset.',
        gain:      'Repérer l\'activité avant les autres donne souvent quelques minutes d\'avance.',
        risk:      'La congestion peut durer des heures sans mouvement de prix significatif.',
      }
    : {
        metaphor:  'Comme une route déserte à 3h du matin — tout est calme...',
        situation: `Peu d\'activité Bitcoin on-chain (${txFmt}, fees à ${feeFmt}).`,
        action:    'Pas d\'urgence. C\'est un bon moment pour configurer des ordres limite sur Nexo sans se faire déborder.',
        gain:      'Les frais de transaction sont bas — c\'est le bon moment pour des mouvements de fonds.',
        risk:      'Le calme peut précéder une forte volatilité.',
      }

  return {
    signal,
    congestionLevel: congestion,
    description_expert: descriptionExpert,
    description_novice: descriptionNovice,
  }
}

// ── Signal 3 : Mining ─────────────────────────────────────────────────────────

/**
 * Interprète les données de mining.
 *
 * @param {{ hashRate: number|null, difficulty: number|null, trend: string }} miningData
 * @param {number|null} [previousHashRate] — hash rate précédent pour calculer la variation
 * @returns {{
 *   signal: 'BULLISH'|'BEARISH'|'NEUTRAL',
 *   trend: 'up'|'down'|'stable',
 *   description_novice: { metaphor, situation, action, gain, risk }
 * }}
 */
export function detectMinerSignal(miningData, previousHashRate) {
  const hashRate   = miningData?.hashRate   ?? null
  const difficulty = miningData?.difficulty ?? null

  let trend  = miningData?.trend ?? 'stable'
  let signal = 'NEUTRAL'

  // Calculer la variation si on a un hash rate précédent
  if (hashRate != null && previousHashRate != null && previousHashRate > 0) {
    const changePct = ((hashRate - previousHashRate) / previousHashRate) * 100
    if (changePct > 5) {
      trend  = 'up'
      signal = 'BULLISH'
    } else if (changePct < -5) {
      trend  = 'down'
      signal = 'BEARISH'
    }
  }

  const hashFmt = hashRate != null
    ? `${(hashRate / 1e18).toFixed(2)} EH/s`
    : 'N/A'

  const diffFmt = difficulty != null
    ? `${(difficulty / 1e12).toFixed(2)}T`
    : 'N/A'

  const descriptionNovice = signal === 'BULLISH'
    ? {
        metaphor:  'Comme de plus en plus d\'ouvriers qui rejoignent un chantier — le projet prend de l\'ampleur...',
        situation: `Les mineurs Bitcoin investissent plus de puissance (${hashFmt}). C\'est un signe de confiance dans le prix futur.`,
        action:    'Signal positif long terme. Idéal pour accumuler progressivement sur Binance avec un DCA hebdomadaire.',
        gain:      'Historiquement, la hausse du hash rate précède des hausses de prix à 3-6 mois.',
        risk:      'C\'est un signal lent — ça ne dit rien sur ce qui se passe dans la prochaine heure.',
      }
    : signal === 'BEARISH'
    ? {
        metaphor:  'Comme des ouvriers qui quittent le chantier — quelque chose ne va pas...',
        situation: `Les mineurs réduisent leur activité (${hashFmt}). Ils ne sont plus confiants dans la rentabilité du mining.`,
        action:    'Sois prudent(e) sur les positions longues. Sur Nexo, tu peux mettre une partie en stablecoin pour éviter la baisse.',
        gain:      'Réduire son exposition peut éviter des pertes de 15-30% lors de capitulations de mineurs.',
        risk:      'Les mineurs peuvent aussi migrer vers des régions moins chères — ce n\'est pas toujours négatif.',
      }
    : {
        metaphor:  'Comme une usine qui tourne à vitesse normale...',
        situation: `Le réseau de mining est stable (${hashFmt}, difficulté ${diffFmt}).`,
        action:    'Continue ton plan habituel. Pas de signal mining directionnel.',
        gain:      'La stabilité du mining est un signe de santé du réseau.',
        risk:      'La stabilité peut masquer des changements à venir.',
      }

  return { signal, trend, description_novice: descriptionNovice }
}

// ── Signal composite ──────────────────────────────────────────────────────────

/**
 * Synthétise les 3 signaux on-chain en un signal composite.
 *
 * @param {ReturnType<typeof detectExchangeFlowSignal>}  flowSignal
 * @param {ReturnType<typeof detectMempoolSignal>}       mempoolSignal
 * @param {ReturnType<typeof detectMinerSignal>}         minerSignal
 * @param {number} onChainScore — score 0-100 calculé par normalizeOnChain
 * @returns {{
 *   score: number,
 *   expert: string,
 *   novice: { metaphor, situation, action, gain, risk },
 *   action_expert: string,
 *   action_novice: string
 * }}
 */
export function compositeOnChainSignal(flowSignal, mempoolSignal, minerSignal, onChainScore) {
  const score = onChainScore ?? 50

  // ── Synthèse experte ──────────────────────────────────────────────────────

  const flowPart = flowSignal?.signal === 'ACCUMULATION'
    ? `Outflow exchange ${flowSignal.strength} (accumulateurs actifs)`
    : flowSignal?.signal === 'DISTRIBUTION'
    ? `Inflow exchange ${flowSignal.strength} (pression vendeuse)`
    : 'Flux exchange neutre'

  const mempoolPart = mempoolSignal?.signal === 'CRITICAL'
    ? 'Mempool critique — momentum imminent possible'
    : mempoolSignal?.signal === 'CONGESTED'
    ? 'Réseau congestionné — activité élevée'
    : 'Mempool calme'

  const minerPart = minerSignal?.signal === 'BULLISH'
    ? 'Mineurs en expansion (+HR)'
    : minerSignal?.signal === 'BEARISH'
    ? 'Mineurs en repli (-HR)'
    : 'Mining stable'

  const expert = `[On-Chain Score: ${score}/100] ${flowPart} | ${mempoolPart} | ${minerPart}.`

  const actionExpert = score >= 70
    ? 'Contexte on-chain favorable : renforcer positions longues ou vendre des puts OTM. Surveiller le funding rate pour confirmation.'
    : score >= 50
    ? 'Signal on-chain neutre à légèrement positif : maintenir positions actuelles, pas d\'augmentation de levier recommandée.'
    : 'Contexte on-chain dégradé : réduire exposition, envisager des hedges via options puts ou stablecoin partiel.'

  // ── Synthèse novice ───────────────────────────────────────────────────────

  const noviceBias = score >= 65 ? 'positif' : score >= 45 ? 'neutre' : 'négatif'
  const novice = {
    metaphor:  score >= 65
      ? 'Comme si les "gros joueurs" préparaient discrètement un grand achat...'
      : score >= 45
      ? 'Comme un marché calme où tout le monde attend le prochain signal...'
      : 'Comme si les investisseurs avertis commençaient à sortir discrètement...',
    situation: `Le bilan on-chain est ${noviceBias} (score ${score}/100). ${flowPart.toLowerCase()}, ${mempoolPart.toLowerCase()}.`,
    action:    score >= 65
      ? 'C\'est un bon moment pour commencer ou renforcer une position sur Binance avec un ordre limite sous le prix actuel.'
      : score >= 45
      ? 'Pas d\'urgence — continue ton DCA habituel sur Binance ou Nexo sans changer ta stratégie.'
      : 'Sois prudent(e) : ne mets pas de grosses sommes maintenant. Sur Nexo, convertis une partie en USDC pour sécuriser.',
    gain:      score >= 65
      ? 'Un bon timing on-chain peut améliorer ton point d\'entrée de 5-15%.'
      : score >= 45
      ? 'Rester constant dans un marché neutre évite de mauvais timings émotionnels.'
      : 'Sécuriser pendant un signal négatif peut protéger 10-25% de ton portefeuille.',
    risk:      'Les signaux on-chain sont des indicateurs de tendance, pas des prédictions certaines. Ne mets jamais plus que ce que tu peux te permettre de perdre.',
  }

  const actionNovice = score >= 65
    ? `Achète progressivement sur Binance (pas tout d\'un coup) et active une alerte de prix.`
    : score >= 45
    ? `Continue ton plan habituel sur Nexo ou Binance — pas de décision urgente.`
    : `Sécurise une partie en USDC sur Nexo et attends une amélioration des signaux.`

  return { score, expert, novice, action_expert: actionExpert, action_novice: actionNovice }
}
