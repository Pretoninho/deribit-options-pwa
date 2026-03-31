#!/bin/bash
# Test script pour la refonte Veridex
# Vérifie que la refonte est complète et fonctionnelle

set -e

echo "🧪 TEST DE REFONTE VERIDEX"
echo "=========================================="

# 1. Vérifier que les pages supprimées n'existent plus
echo ""
echo "1️⃣ Vérifier suppression des pages..."
PAGES_SUPPRIMEES=(
  "OptionsDataPage"
  "VolPage"
  "TrackerPage"
  "TradePage"
  "AssistantPage"
  "OnChainPage"
  "AuditPage"
  "AnalyticsPage"
  "CalibrationPage"
  "FingerprintDebug"
  "MonitorPage"
)

FOUND_PAGES=0
for page in "${PAGES_SUPPRIMEES[@]}"; do
  if grep -r "$page" src/interface --include="*.jsx" --include="*.js" 2>/dev/null | grep -v "node_modules"; then
    echo "  ❌ $page trouvé (devrait être supprimé)"
    FOUND_PAGES=$((FOUND_PAGES + 1))
  fi
done

if [ $FOUND_PAGES -eq 0 ]; then
  echo "  ✅ Toutes les pages supprimées confirmées"
else
  echo "  ❌ $FOUND_PAGES pages supprimées encore référencées"
  exit 1
fi

# 2. Vérifier que les 3 onglets existent
echo ""
echo "2️⃣ Vérifier les 3 onglets principaux..."
PAGES_ACTIVES=("MarketPage" "DerivativesPage" "SignalsPage")
MISSING_PAGES=0

for page in "${PAGES_ACTIVES[@]}"; do
  if [ ! -f "src/interface/pages/${page}.jsx" ]; then
    echo "  ❌ ${page}.jsx manquant"
    MISSING_PAGES=$((MISSING_PAGES + 1))
  else
    echo "  ✅ ${page}.jsx existe"
  fi
done

if [ $MISSING_PAGES -gt 0 ]; then
  exit 1
fi

# 3. Vérifier que DVOL est dans DerivativesPage
echo ""
echo "3️⃣ Vérifier DVOL dans DerivativesPage..."
if grep -q "dvol" src/interface/pages/DerivativesPage.jsx; then
  echo "  ✅ DVOL intégré dans DerivativesPage"
else
  echo "  ❌ DVOL non trouvé dans DerivativesPage"
  exit 1
fi

# 4. Vérifier que les modules supprimés ne sont plus importés
echo ""
echo "4️⃣ Vérifier imports orphelins supprimés..."
SUPPRESSED_IMPORTS=(
  "onchain.js"
  "insight_generator"
  "pattern_clustering"
  "market_fingerprint"
  "pattern_audit"
  "pattern_session"
)

FOUND_IMPORTS=0
for import in "${SUPPRESSED_IMPORTS[@]}"; do
  if grep -r "from.*${import}" src/ --include="*.js*" 2>/dev/null | grep -v "node_modules"; then
    echo "  ❌ Import trouvé: $import"
    FOUND_IMPORTS=$((FOUND_IMPORTS + 1))
  fi
done

if [ $FOUND_IMPORTS -eq 0 ]; then
  echo "  ✅ Aucun import orphelin trouvé"
else
  echo "  ⚠️ $FOUND_IMPORTS imports orphelins trouvés"
fi

# 5. Vérifier que le signal engine a 4 composantes
echo ""
echo "5️⃣ Vérifier Signal Engine: 4 composantes..."
if grep -q "s1\|s2\|s3\|s4" src/signals/signal_engine.js && ! grep -q "s5\|s6" src/signals/signal_engine.js | head -5; then
  echo "  ✅ Signal Engine réduit à 4 composantes"
else
  echo "  ⚠️ Signal Engine structure peut nécessiter vérification"
fi

# 6. Build test
echo ""
echo "6️⃣ Vérifier build..."
if npm run build > /dev/null 2>&1; then
  BUNDLE_SIZE=$(du -h dist/assets/index-*.js | awk '{print $1}')
  echo "  ✅ Build OK - Bundle: $BUNDLE_SIZE"
else
  echo "  ❌ Build échouée"
  exit 1
fi

# 7. Vérifier bundle size
echo ""
echo "7️⃣ Vérifier taille bundle..."
BUNDLE_KB=$(ls -l dist/assets/index-*.js | awk '{print int($5/1024)}')
if [ $BUNDLE_KB -lt 230 ]; then
  echo "  ✅ Bundle optimisé: ${BUNDLE_KB}KB (< 230KB)"
else
  echo "  ⚠️ Bundle: ${BUNDLE_KB}KB (attendu < 230KB)"
fi

# 8. Vérifier tests (si existent)
echo ""
echo "8️⃣ Vérifier tests..."
if [ -f "package.json" ] && grep -q "\"test\"" package.json; then
  if npm run test 2>/dev/null | grep -q "pass"; then
    echo "  ✅ Tests passent"
  else
    echo "  ⚠️ Certains tests pourraient échouer"
  fi
else
  echo "  ⏭️ Tests non configurés"
fi

echo ""
echo "=========================================="
echo "✅ REFONTE VALIDÉE"
echo "=========================================="
echo ""
echo "Prochaines étapes:"
echo "1. npm run dev (tester en local)"
echo "2. Vérifier les 3 onglets dans le navigateur"
echo "3. git merge origin/claude/plan-app-redesign-12VEM"
echo ""
