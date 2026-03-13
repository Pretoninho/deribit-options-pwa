# Deribit Options Pro — PWA Mobile

Application React PWA installable sur mobile, accessible depuis n'importe où via GitHub Pages.

## 🚀 Déploiement en 5 étapes

### 1. Prérequis
- Node.js 18+ installé sur ton PC
- Compte GitHub (gratuit)
- Git installé

### 2. Installation locale
```bash
cd deribit-options-pwa
npm install
npm run dev   # → http://localhost:5173 pour tester
```

### 3. Créer le dépôt GitHub
1. Va sur https://github.com/new
2. Nom du repo : `deribit-options-pwa` (ou ce que tu veux)
3. **Public** (obligatoire pour GitHub Pages gratuit)
4. Ne pas initialiser avec README

### 4. Push du code
```bash
git init
git add .
git commit -m "Initial commit — Deribit Options PWA"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/deribit-options-pwa.git
git push -u origin main
```

### 5. Activer GitHub Pages avec GitHub Actions
Crée le fichier `.github/workflows/deploy.yml` (déjà inclus dans ce projet).

Puis dans GitHub :
- Settings → Pages → Source → **GitHub Actions**
- Le déploiement se lance automatiquement à chaque push
- Ton app sera disponible sur : `https://TON_USERNAME.github.io/deribit-options-pwa/`

---

## 📱 Installer sur mobile

### iPhone (Safari)
1. Ouvre l'URL dans Safari
2. Appuie sur l'icône Partager ↑
3. "Sur l'écran d'accueil"
4. L'app apparaît comme une vraie app native

### Android (Chrome)
1. Ouvre l'URL dans Chrome
2. Menu ⋮ → "Ajouter à l'écran d'accueil"
3. Confirmer

---

## 🔧 Structure du projet

```
src/
├── pages/
│   ├── DualPage.jsx      ← Dual Investment + scoring + P&L
│   ├── ChainPage.jsx     ← Chaîne d'options Deribit
│   ├── TrackerPage.jsx   ← IV Live tracker avec graphiques
│   └── TermPage.jsx      ← Term Structure / Basis futures
├── utils/
│   ├── api.js            ← Appels API Deribit (publique, no auth)
│   └── di.js             ← Logique DI : scoring, P&L, break-even
├── App.jsx               ← Navigation bottom bar mobile
└── index.css             ← Thème dark + variables CSS
```

## 📡 APIs utilisées
- **Deribit API v2** (publique, sans authentification)
  - `/get_index_price` — Prix spot
  - `/get_instruments` — Instruments options/futures
  - `/get_order_book` — IV, greeks, OI
  - `/get_funding_rate_value` — Funding rate perpetuel

## 💾 Persistance des données
- Contrats DI : sauvegardés automatiquement dans `localStorage`
- DCA BTC : sauvegardé dans `localStorage`
- Historique IV Tracker : sauvegardé dans `localStorage`
- Fonctionne hors-ligne pour les données déjà chargées (PWA cache)
