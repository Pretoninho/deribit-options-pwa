# 📊 Guide de Calibrage - Système de Détection de Signaux
**Date**: 28 Mars 2026 | **Contexte**: Audit complet du système de signaux et calibrage

---

## 🎯 SITUATION ACTUELLE

**Problème déclaré**: "Les calculs marchent mais aucune détection/alerte visible"

**Causes identifiées**:
1. ✅ **Calculs de signal**: Fonctionnent correctement (signal global calculé)
2. ❌ **Affichage des résultats**: Filtrés/cachés par conditions strictes
3. ❌ **Notifications**: Thresholds trop élevés ou cooldowns bloquants
4. ⚠️ **Paramètres hardcoded**: 25+ seuils non-ajustables sans code change

---

## 📋 CARTOGRAPHIE COMPLÈTE DES PARAMÈTRES

### **Niveau 1: Calcul des Scores (0-100)**

#### Signal Engine - Thresholds Hardcoded (`src/signals/signal_engine.js`)

**IV Score (s1) - 30% du poids**
```
Ratio DVOL / moyenne30j:
├─ >= 1.20  → 100 pts (volatilité très élevée)
├─ >= 1.10  →  75 pts
├─ >= 0.95  →  50 pts
├─ >= 0.85  →  25 pts
└─ <  0.85  →   0 pts (volatilité basse)

Impact: Si DVOL/avg30 = 1.15 → score 75/100
```

**Funding Score (s2) - 20% du poids**
```
Annualized funding rate:
├─ >= 30%   → 100 pts (très bullish)
├─ >= 15%   →  75 pts
├─ >=  5%   →  50 pts
├─ >=  0%   →  25 pts
└─ <   0%   →   0 pts (baissier)

Impact: Si funding = 2%/jour (73%/an) → score 100/100
```

**Basis Score (s3) - 20% du poids**
```
Futures basis annualisé:
├─ >= 15%   → 100 pts (forte prime cash-and-carry)
├─ >=  8%   →  75 pts
├─ >=  3%   →  50 pts
├─ >=  0%   →  25 pts
└─ <   0%   →   0 pts (backwardation)

Impact: Si basis annualisé = 5% → score 50/100
```

**IV vs RV Premium (s4) - 15% du poids**
```
Écart DVOL - RV:
├─ >= 20    → 100 pts (prime importante)
├─ >= 10    →  75 pts
├─ >=  0    →  50 pts
└─ <   0    →   0 pts (RV > IV = rare)

Impact: Si DVOL=40, RV=25, premium=15 → score 75/100
```

**OnChain Score (s5) - 10% du poids**
```
Synthèse de 5 composants:
├─ Mempool congestion
├─ Exchange flows (CryptoQuant)
├─ Mining sentiment
├─ Fear & Greed Index
└─ Hash rate trend

Gate: Besoin 2+ composants disponibles sinon score=null
Impact: Si CryptoQuant indisponible + blockchain.info down → s5=null
```

**Positioning Divergence (s6) - 15% du poids**
```
Retail vs Institutional divergence:
├─ L/S Ratio (Binance): < 0.8 = bullish, > 1.2 = bearish
├─ P/C Ratio (Deribit): < 0.85 = bullish, > 1.15 = bearish
└─ Normalization via Math.tanh()

Gate: Besoin BOTH ratios non-null sinon score=null
Impact: Si sentiment indisponible → s6=null (15% perdu)
```

### **Score Global = Moyenne Pondérée**

```
Cas 1: Tous les composants (s1-s6) disponibles
  GLOBAL = s1×30% + s2×20% + s3×20% + s4×15% + s5×10% + s6×15%
  Résultat: 0-100

Cas 2: Sans s6 (pas de positioning)
  GLOBAL = s1×30% + s2×20% + s3×20% + s4×15% + s5×15%
  Résultat: 0-100

Cas 3: Sans s5 & s6 (pas de onchain/positioning)
  GLOBAL = s1×35% + s2×25% + s3×25% + s4×15%
  Résultat: 0-100

⚠️ PROBLÈME: Si s5 ou s6 = null, calcul continue quand même!
Si global calculé comme 45/100 mais avec 2 composants manquants:
→ Résultat peut être artificiel (basé sur données incomplètes)
```

### **Niveau 2: Seuils de Notification/Alerte**

#### Thresholds Modifiables (`src/signals/notification_manager.js`)

**N1: Price Move Detection**
```
Seuil par défaut: 5% en 1 heure
Cooldown: 30 minutes
Formule: |nouveauPrix - ancienPrix| / ancienPrix * 100 > 5%
Impact: Si activé sur BTC 45,000 → alerte si prix > 46,125 en <1h
```

**N2: IV Spike Detection**
```
Seuils: IV Rank sort de [30, 70] en 4 heures
├─ Bas: IV Rank < 30 (compression extrême)
├─ Haut: IV Rank > 70 (expansion extrême)
Cooldown: 60 minutes
Impact: Sensible aux mouvements volatilité court-terme
```

**N3: Funding Change**
```
Seuil: Changement 20% en 15 minutes
Cooldown: 15 minutes
Formule: |newFunding - oldFunding| / oldFunding * 100 > 20%
Impact: Détecte les retournements rapides du sentiment
```

**N4: Liquidations**
```
Seuil: >$50M liquidations/heure
Cooldown: 30 minutes
Impact: Détecte mouvements de marché extrêmes
```

**N5: Settlement Alert**
```
Seuil: Écart settlement vs spot > 0.3%
Cooldown: 24 heures
Impact: Daily market fixing validation
```

**N6-N9: Autres (Expiry warnings, Funding fixing, Anomaly)**
- Expiry 24h/1h warnings (configurable)
- Funding fixing 30min before 00/08/16 UTC
- Anomaly si 3+ indicateurs changent en <10s

---

## 🔴 PROBLÈMES CRITIQUES IDENTIFIÉS

### **PROBLÈME 1: Gates Multiples Bloquent l'Affichage**

```
Signal calculé ✓ → Mais s'affiche seulement si:
├─ s5 (OnChain) disponible (sinon null)
│  ├─ Blockchain.info + Mempool.space doivent répondre
│  └─ CryptoQuant API key présente (VITE_CRYPTOQUANT_API_KEY)
├─ s6 (Positioning) disponible
│  ├─ Binance L/S Ratio doit être présent
│  └─ Deribit P/C Ratio doit être présent
└─ Au moins 2 composants OnChain actifs (sinon s5=null)

❌ RÉSULTAT: Si s5 OU s6 manquent → global=45/100 mais basé sur données incomplètes
```

### **PROBLÈME 2: Thresholds Trop Stricts pour Convergence**

```
Convergence Detection (6 critères):
├─ MIN_CONVERGENCE = 3 critères minimum doivent être alignés
├─ Critères: ivRank, dvol, funding, basis, onChain, positioning
└─ Si seulement 2 changent → "No convergence" (pas d'alerte)

❌ RÉSULTAT: Pattern "IV spike + funding spike" manqué
Utilisateur voit rien même si données indiquent danger
```

### **PROBLÈME 3: IV Spike Timer Reset Bug**

```
Code actuel (src/signals/notification_engine.js:169-208):
if (ivRank < threshold) {
  _state.ivSpikeStart[asset] = now  // ← RESET CHAQUE POLL!
}

Scénario:
├─ IV Rank oscille à 48-50 (juste en dessous seuil 50)
├─ Timer reset CHAQUE 5-10 secondes
└─ Jamais accumule assez pour alerte → Pas de notification

❌ RÉSULTAT: Compression IV détectée mais invisible
```

### **PROBLÈME 4: Absence de Logging des Échecs**

```
API Silencieux failures:
├─ blockchain.info timeout → returns null (no log)
├─ mempool.space down → returns null (no log)
├─ CryptoQuant rate limited → returns null (no log)
└─ Utilisateur ne sait pas pourquoi s5=null

❌ RÉSULTAT: Impossible de debugger sans code inspection
```

---

## 🎛️ RECOMMANDATIONS DE CALIBRAGE

### **Quick Wins (5-15 minutes chacun)**

#### **1. Réduire IV Spike Threshold pour plus de sensibilité**

**Fichier**: `src/signals/notification_manager.js` ligne 40
```javascript
// Avant:
iv_spike_low: 50,   // Alerte si IV Rank < 50
iv_spike_high: 70,  // Alerte si IV Rank > 70

// Après (plus sensible):
iv_spike_low: 40,   // Alerte si IV Rank < 40
iv_spike_high: 75,  // Alerte si IV Rank > 75

// Effet:
├─ Détecte compression plus agressive
├─ Détecte expansion plus tôt
└─ Peut générer plus d'alertes
```

#### **2. Réduire Price Move Threshold**

**Fichier**: `src/signals/notification_manager.js` ligne 36
```javascript
// Avant:
price_move_pct: 5.0  // 5% en 1 heure

// Après (plus sensible):
price_move_pct: 2.5  // 2.5% en 1 heure

// Effet:
├─ Alerte sur mouvements plus modérés
├─ Window toujours 1h
└─ Cooldown 30min bloque les doublons
```

#### **3. Réduire Funding Change Threshold**

**Fichier**: `src/signals/notification_manager.js` ligne 42
```javascript
// Avant:
funding_change_ann: 20.0  // 20% changement en 15min

// Après:
funding_change_ann: 10.0  // 10% changement en 15min

// Effet:
├─ Détecte retournements sentiment plus tôt
├─ Critère moins bruyant que price_move
└─ Utile pour futures trading
```

**Comment appliquer**:
1. Ouvrir DevTools (F12)
2. Exécuter:
```javascript
localStorage.setItem('notification_thresholds', JSON.stringify({
  price_move_pct: 2.5,
  iv_spike_low: 40,
  iv_spike_high: 75,
  funding_change_ann: 10.0
}))
```
3. Reload la page

### **Medium Effort (30min - 1h)**

#### **4. Fixer IV Spike Timer Reset Bug**

**Fichier**: `src/signals/notification_engine.js` lignes 169-208

**Avant (bugué)**:
```javascript
async function _checkIVSpike(asset, ivRank, t) {
  const wasLow = (_state.lastIVRank[asset] ?? 0) < t.iv_spike_low

  if (wasLow && _state.ivSpikeStart[asset] == null) {
    _state.ivSpikeStart[asset] = now
  }

  if (ivRank < t.iv_spike_low) {  // ← RESET CHAQUE FOIS!
    _state.ivSpikeStart[asset] = now
  }
}
```

**Après (fixé)**:
```javascript
async function _checkIVSpike(asset, ivRank, t) {
  const wasLow = (_state.lastIVRank[asset] ?? 0) < t.iv_spike_low

  // START timer seulement au moment d'entrée
  if (wasLow && !_state.ivSpikeStart[asset]) {
    _state.ivSpikeStart[asset] = now
  }

  // RESET seulement à la SORTIE du seuil bas
  if (ivRank >= t.iv_spike_low && _state.ivSpikeStart[asset]) {
    _state.ivSpikeStart[asset] = null  // Reset
  }

  // Check elapsed time (no reset while in state)
  if (_state.ivSpikeStart[asset] && now - _state.ivSpikeStart[asset] > t.iv_spike_window_ms) {
    // Send alert...
  }
}
```

#### **5. Ajouter Logging pour Debugging**

**Fichier**: `src/signals/notification_engine.js` à début de `checkNotifications()`

```javascript
export async function checkNotifications(asset, data) {
  if (!data) {
    console.warn('[checkNotifications] No data for', asset)
    return
  }

  // Log data availability
  const available = {
    price: data.price != null,
    ivRank: data.ivRank != null,
    funding: data.funding != null,
    liquidations: data.liquidations != null,
  }
  console.debug('[checkNotifications]', asset, available)

  // ... rest of function
}
```

**Effet**:
- Console affiche quelle data arrive
- Permet identifier points de perte de données

### **Strategic (Requires Code Structure Changes)**

#### **6. Implémenter Configuration Unifiée**

**Créer**: `src/config/signal_calibration.js`

```javascript
export const SIGNAL_THRESHOLDS = {
  // IV Score boundaries
  scoreIV: { high: 1.20, med: 1.10, low: 0.95, veryLow: 0.85 },

  // Funding Score boundaries
  scoreFunding: { high: 30, med: 15, low: 5, zero: 0 },

  // ... etc
}

export const NOTIFICATION_THRESHOLDS = {
  price_move_pct: 5.0,
  iv_spike_low: 50,
  iv_spike_high: 70,
  // ... etc
}
```

**Bénéfices**:
- Single source of truth
- Facile à ajuster globalement
- Can be loaded from API/database

---

## 📊 TABLEAU DE CALIBRAGE RECOMMANDÉ

| Paramètre | Défaut | Recommandé | Effet |
|-----------|--------|-----------|--------|
| `price_move_pct` | 5.0% | 2.5% | Plus de détection mouvements |
| `iv_spike_low` | 50 | 40 | Plus sensible compression |
| `iv_spike_high` | 70 | 75 | Détecte expansion plus tôt |
| `funding_change_ann` | 20% | 10% | Sentiment détecté plus vite |
| `convergence_min` | 3 critères | 2 critères | Moins strict |
| `onchain_min_components` | 2 | 1 | Fallback si API down |

---

## 🔧 CHECKLIST DE DEBUGGING

- [ ] Vérifier localStorage: `console.log(localStorage.getItem('notification_thresholds'))`
- [ ] Checker IndexedDB quota: `navigator.storage.estimate()`
- [ ] Vérifier API key: `console.log(import.meta.env.VITE_CRYPTOQUANT_API_KEY)`
- [ ] Monitor API appels: DevTools Network tab
- [ ] Activer console logging pour silent failures
- [ ] Tester API responses séparément (curl/postman)

---

## 📈 FLUX COMPLET DE DÉTECTION

```
ÉTAPE 1: Collecte Données (Promise.allSettled)
├─ DVOL (Deribit) → dvol object
├─ Funding (Binance) → funding object
├─ RV → rv number
├─ OnChain (blockchain.info, etc) → nullable
└─ Positioning (Binance, Deribit) → nullable

ÉTAPE 2: Normalisation
├─ dvol → scoreIV (ratio calc)
├─ funding → scoreFunding (annualization)
├─ rv, dvol → scoreIVvsRV (premium calc)
├─ basis → scoreBasis
├─ onchain → onChainScore (5-component synthesis)
└─ positioning → positioningScore (tanh normalization)

ÉTAPE 3: Calcul Score Global
  GLOBAL = weighted average (s1-s6)
  Result: 0-100

ÉTAPE 4: Interprétation Signal
├─ Label: "Exceptionnel" (>=80), "Favorable" (>=60), etc
├─ 3 recommendations: spot, futures, options
└─ AI insight (Claude API)

ÉTAPE 5: Notification Checks
├─ Check price move
├─ Check IV spike (Timer-based)
├─ Check funding change
├─ Check liquidations
├─ Check convergence
└─ Send alerts via Service Worker

ÉTAPE 6: Affichage
└─ React UI renders results IF all conditions met
```

---

## ✅ VÉRIFICATION POST-CALIBRAGE

**Après ajustement des thresholds**:

1. **Console check** (F12 → Console):
   ```javascript
   JSON.parse(localStorage.getItem('notification_thresholds'))
   // Should show your updated values
   ```

2. **Force reload**:
   ```javascript
   Ctrl+Shift+R  (ou Cmd+Shift+R sur Mac)
   ```

3. **Test via Network tab**:
   - Ouvrir DevTools → Network
   - Voir les API calls vers Deribit, Binance
   - Vérifier qu'elles retournent des données

4. **Manually trigger test**:
   ```javascript
   // In console
   await window.__notificationTest?.test('BTC')
   // Should log all checks
   ```

---

## 🎯 RECOMMANDATION FINALE

**Pour commencer**:
1. **Appliquer Quick Wins** (localStorage thresholds) - 5min
2. **Ajouter logging** pour voir ce qui se passe - 10min
3. **Fixer IV timer bug** - 30min
4. **Valider avec tests** - 10min

**Résultat attendu**: Détection visible avec alertes pertinentes

**Si toujours aucune donnée**:
→ Problème est probablement dans affichage UI ou API connectivity
→ Check Network tab pour voir si API calls réussissent

---

**Document généré**: 28 Mars 2026
**Audience**: Opérateur système Veridex
**Prérequis**: Accès localhost:5173, DevTools, localStorage
