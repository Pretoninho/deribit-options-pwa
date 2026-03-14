import { useState } from 'react'
import { parseNexoCSV, buildContracts, calcStats } from '../utils/nexo.js'

const SCORE_COLORS = { great: 'var(--call)', good: 'var(--atm)', fair: 'var(--accent2)', poor: 'var(--put)' }

function fmtUSD(n) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(str) {
  return new Date(str).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'2-digit' }).toUpperCase()
}

export default function PerfPage() {
  const [contracts, setContracts] = useState([])
  const [stats, setStats]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [activeTab, setActiveTab] = useState('summary')
  const [filter, setFilter]       = useState('all') // all | converted | not-converted | buy-low | sell-high

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true); setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const rows      = parseNexoCSV(ev.target.result)
        const built     = buildContracts(rows)
        const computed  = calcStats(built)
        setContracts(built)
        setStats(computed)
        if (!built.length) setError('Aucun contrat DI trouvé dans ce fichier.')
      } catch(err) {
        setError('Erreur de parsing : ' + err.message)
      }
      setLoading(false)
    }
    reader.readAsText(file)
  }

  const filtered = contracts.filter(c => {
    if (filter === 'converted')     return c.converted
    if (filter === 'not-converted') return !c.converted
    if (filter === 'buy-low')       return c.type === 'buy-low'
    if (filter === 'sell-high')     return c.type === 'sell-high'
    return true
  })

  const months = stats ? Object.entries(stats.byMonth).sort((a,b) => a[0].localeCompare(b[0])) : []
  const maxPrime = months.length ? Math.max(...months.map(([,v]) => v.prime)) : 1

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div className="page-title">Suivi <span>Performance</span></div>
        {contracts.length > 0 && (
          <label style={{ cursor:'pointer' }}>
            <span className="icon-btn">↑ Nouveau CSV</span>
            <input type="file" accept=".csv" style={{ display:'none' }} onChange={handleFile} />
          </label>
        )}
      </div>

      {/* Zone import */}
      {contracts.length === 0 && (
        <label style={{ cursor:'pointer', display:'block' }}>
          <div style={{
            border:'2px dashed var(--border-bright)', borderRadius:12, padding:'40px 20px',
            textAlign:'center', background:'var(--surface)', transition:'all .2s',
          }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📂</div>
            <div style={{ fontFamily:'var(--sans)', fontSize:15, fontWeight:700, color:'var(--text-dim)', marginBottom:8 }}>
              Importer l'export Nexo
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.8 }}>
              Depuis Nexo → Transactions → Exporter CSV<br/>
              Filtre : Dual Investment
            </div>
            {loading && <div style={{ marginTop:12, color:'var(--accent)', fontSize:12 }}>Analyse en cours…</div>}
          </div>
          <input type="file" accept=".csv" style={{ display:'none' }} onChange={handleFile} />
        </label>
      )}

      {error && <div className="error-box" style={{ marginTop:12 }}>⚠ {error}</div>}

      {stats && (
        <>
          {/* Tabs */}
          <div style={{ display:'flex', marginBottom:14, borderBottom:'1px solid var(--border)', marginTop:16 }}>
            {[['summary','Résumé'],['monthly','Par mois'],['contracts','Contrats']].map(([id,label]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                padding:'8px 16px', background:'none', border:'none', cursor:'pointer',
                fontFamily:'var(--sans)', fontSize:12, fontWeight:700,
                color: activeTab===id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: activeTab===id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom:-1, transition:'all .2s'
              }}>{label}</button>
            ))}
          </div>

          {/* ── RÉSUMÉ ── */}
          {activeTab === 'summary' && (
            <div className="fade-in">

              {/* KPIs principaux */}
              <div className="stats-grid">
                <div className="stat-card" style={{ borderColor:'rgba(0,229,160,.3)', background:'rgba(0,229,160,.04)' }}>
                  <div className="stat-label">Primes totales</div>
                  <div className="stat-value green">{fmtUSD(stats.totalPrime)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Contrats</div>
                  <div className="stat-value blue">{stats.total}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">APY moyen réel</div>
                  <div className="stat-value orange">{stats.avgAPY.toFixed(2)}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Durée moyenne</div>
                  <div className="stat-value">{stats.avgDays.toFixed(0)}j</div>
                </div>
                <div className="stat-card" style={{ borderColor: stats.conversionRate > 40 ? 'rgba(255,77,109,.3)' : 'rgba(255,215,0,.3)' }}>
                  <div className="stat-label">Taux conversion</div>
                  <div className="stat-value" style={{ color: stats.conversionRate > 40 ? 'var(--put)' : 'var(--atm)' }}>
                    {stats.conversionRate.toFixed(1)}%
                  </div>
                  <div className="stat-sub">{stats.convertedCount} exercés / {stats.total}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Non exercés</div>
                  <div className="stat-value green">{stats.notConvertedCount}</div>
                  <div className="stat-sub">{(100 - stats.conversionRate).toFixed(1)}% du total</div>
                </div>
              </div>

              {/* Buy Low vs Sell High */}
              <div className="card" style={{ marginBottom:12 }}>
                <div className="card-header">Buy Low vs Sell High</div>
                <div style={{ padding:'12px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div style={{ background:'rgba(0,229,160,.06)', borderRadius:8, padding:'12px' }}>
                    <div style={{ color:'var(--call)', fontFamily:'var(--sans)', fontWeight:800, fontSize:13, marginBottom:8 }}>Buy Low</div>
                    <div style={{ fontSize:11, color:'var(--text-dim)', display:'flex', flexDirection:'column', gap:5 }}>
                      <div>Contrats : <strong style={{ color:'var(--text)' }}>{stats.buyLowCount}</strong></div>
                      <div>Primes : <strong style={{ color:'var(--call)' }}>{fmtUSD(stats.buyLowPrime)}</strong></div>
                      {stats.buyLowCount > 0 && <div>Moy/contrat : <strong>{fmtUSD(stats.buyLowPrime/stats.buyLowCount)}</strong></div>}
                    </div>
                  </div>
                  <div style={{ background:'rgba(255,107,53,.06)', borderRadius:8, padding:'12px' }}>
                    <div style={{ color:'var(--accent2)', fontFamily:'var(--sans)', fontWeight:800, fontSize:13, marginBottom:8 }}>Sell High</div>
                    <div style={{ fontSize:11, color:'var(--text-dim)', display:'flex', flexDirection:'column', gap:5 }}>
                      <div>Contrats : <strong style={{ color:'var(--text)' }}>{stats.sellHighCount}</strong></div>
                      <div>Primes : <strong style={{ color:'var(--accent2)' }}>{fmtUSD(stats.sellHighPrime)}</strong></div>
                      {stats.sellHighCount > 0 && <div>Moy/contrat : <strong>{fmtUSD(stats.sellHighPrime/stats.sellHighCount)}</strong></div>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Par actif */}
              <div className="card" style={{ marginBottom:12 }}>
                <div className="card-header">Performance par actif</div>
                {Object.entries(stats.byAsset).map(([asset, data]) => (
                  <div key={asset} style={{ padding:'12px 16px', borderBottom:'1px solid rgba(30,58,95,.3)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontFamily:'var(--sans)', fontWeight:800, fontSize:14, color: asset==='BTC'?'#f7931a':asset==='ETH'?'#627eea':'var(--accent)' }}>
                        {asset === 'BTC' ? '₿' : asset === 'ETH' ? 'Ξ' : '$'} {asset}
                      </span>
                      <span style={{ color:'var(--call)', fontWeight:700, fontSize:13 }}>{fmtUSD(data.prime)}</span>
                    </div>
                    <div style={{ display:'flex', gap:16, fontSize:10, color:'var(--text-muted)' }}>
                      <span>Contrats : <strong style={{ color:'var(--text-dim)' }}>{data.count}</strong></span>
                      <span>Exercés : <strong style={{ color: data.converted/data.count > 0.4 ? 'var(--put)' : 'var(--atm)' }}>{data.converted} ({(data.converted/data.count*100).toFixed(0)}%)</strong></span>
                      <span>APY moy : <strong style={{ color:'var(--accent2)' }}>{data.locked > 0 ? (data.prime/data.locked*365/30*100).toFixed(1)+'%' : '—'}</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Insight */}
              <div className="card">
                <div className="card-header">💡 Insights</div>
                <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                  {stats.conversionRate < 20 && (
                    <div style={{ fontSize:11, color:'var(--call)', lineHeight:1.7 }}>
                      ✓ Taux de conversion bas ({stats.conversionRate.toFixed(1)}%) — ta stratégie de sélection de strikes est efficace
                    </div>
                  )}
                  {stats.conversionRate > 40 && (
                    <div style={{ fontSize:11, color:'var(--put)', lineHeight:1.7 }}>
                      ⚠ Taux de conversion élevé ({stats.conversionRate.toFixed(1)}%) — tes strikes sont peut-être trop proches du spot
                    </div>
                  )}
                  {stats.avgAPY > 10 && (
                    <div style={{ fontSize:11, color:'var(--call)', lineHeight:1.7 }}>
                      ✓ APY moyen réel {stats.avgAPY.toFixed(2)}% — tu exploites bien les pics de volatilité
                    </div>
                  )}
                  {stats.avgAPY < 5 && (
                    <div style={{ fontSize:11, color:'var(--accent2)', lineHeight:1.7 }}>
                      ~ APY moyen {stats.avgAPY.toFixed(2)}% — des marges d'amélioration possibles via le timing IV
                    </div>
                  )}
                  <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.7 }}>
                    Prime moyenne par contrat : <strong style={{ color:'var(--text-dim)' }}>{fmtUSD(stats.totalPrime / stats.total)}</strong> · 
                    Durée moyenne : <strong style={{ color:'var(--text-dim)' }}>{stats.avgDays.toFixed(0)} jours</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PAR MOIS ── */}
          {activeTab === 'monthly' && (
            <div className="fade-in">
              <div className="card" style={{ marginBottom:12 }}>
                <div className="card-header">Primes encaissées par mois</div>
                <div style={{ padding:'12px 16px' }}>
                  {months.map(([month, data]) => {
                    const barPct = (data.prime / maxPrime) * 100
                    const [y, m] = month.split('-')
                    const label = new Date(parseInt(y), parseInt(m)-1).toLocaleDateString('fr-FR', { month:'short', year:'2-digit' }).toUpperCase()
                    return (
                      <div key={month} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                        <span style={{ width:50, fontSize:10, color:'var(--text-muted)', flexShrink:0 }}>{label}</span>
                        <div style={{ flex:1, height:20, background:'rgba(255,255,255,.04)', borderRadius:3, overflow:'hidden', position:'relative' }}>
                          <div style={{ height:'100%', width:`${barPct}%`, background:'linear-gradient(90deg, var(--accent), var(--call))', borderRadius:3, transition:'width .4s' }} />
                        </div>
                        <span style={{ width:55, fontSize:11, color:'var(--call)', fontWeight:700, textAlign:'right', flexShrink:0 }}>{fmtUSD(data.prime)}</span>
                        <span style={{ width:20, fontSize:10, color:'var(--text-muted)', textAlign:'right', flexShrink:0 }}>{data.count}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding:'0 16px 12px', fontSize:10, color:'var(--text-muted)' }}>
                  Nombre de contrats à droite de chaque barre
                </div>
              </div>

              {/* Total par trimestre */}
              <div className="card">
                <div className="card-header">Total cumulé</div>
                <div style={{ padding:'12px 16px' }}>
                  {(() => {
                    let cumul = 0
                    return months.map(([month, data]) => {
                      cumul += data.prime
                      const [y, m] = month.split('-')
                      const label = new Date(parseInt(y), parseInt(m)-1).toLocaleDateString('fr-FR', { month:'short', year:'2-digit' }).toUpperCase()
                      return (
                        <div key={month} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(30,58,95,.2)', fontSize:11 }}>
                          <span style={{ color:'var(--text-muted)' }}>{label}</span>
                          <span style={{ color:'var(--call)' }}>+{fmtUSD(data.prime)}</span>
                          <span style={{ color:'var(--text-dim)', fontWeight:700 }}>{fmtUSD(cumul)}</span>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ── CONTRATS ── */}
          {activeTab === 'contracts' && (
            <div className="fade-in">
              {/* Filtres */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                {[['all','Tous'],['converted','Exercés'],['not-converted','Non exercés'],['buy-low','Buy Low'],['sell-high','Sell High']].map(([id,label]) => (
                  <button key={id} onClick={() => setFilter(id)} style={{
                    padding:'5px 12px', borderRadius:20, fontSize:10, cursor:'pointer',
                    border: filter===id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: filter===id ? 'rgba(0,212,255,.1)' : 'transparent',
                    color: filter===id ? 'var(--accent)' : 'var(--text-muted)',
                  }}>{label} {id==='all'?`(${contracts.length})`:''}</button>
                ))}
              </div>

              {filtered.map(c => (
                <div key={c.id} className="card fade-in" style={{
                  marginBottom:8,
                  borderLeft: `2px solid ${c.converted ? 'var(--put)' : 'var(--call)'}`,
                }}>
                  <div style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontFamily:'var(--sans)', fontWeight:800, fontSize:13, color: c.asset==='BTC'?'#f7931a':c.asset==='ETH'?'#627eea':'var(--accent)' }}>{c.asset}</span>
                        <span style={{
                          fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:20,
                          background: c.type==='buy-low'?'rgba(0,229,160,.12)':'rgba(255,107,53,.12)',
                          color: c.type==='buy-low'?'var(--call)':'var(--accent2)',
                          border: `1px solid ${c.type==='buy-low'?'rgba(0,229,160,.25)':'rgba(255,107,53,.25)'}`
                        }}>{c.type==='buy-low'?'Buy Low':'Sell High'}</span>
                        <span style={{
                          fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:20,
                          background: c.converted?'rgba(255,77,109,.12)':'rgba(0,229,160,.08)',
                          color: c.converted?'var(--put)':'var(--call)',
                          border: `1px solid ${c.converted?'rgba(255,77,109,.25)':'rgba(0,229,160,.2)'}`
                        }}>{c.converted ? '⚡ Exercé' : '✓ Non exercé'}</span>
                      </div>
                      <span style={{ color:'var(--call)', fontWeight:700, fontSize:13 }}>+{fmtUSD(c.interestUSD)}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, fontSize:11 }}>
                      <div>
                        <div style={{ color:'var(--text-muted)', fontSize:9, marginBottom:2 }}>ENGAGÉ</div>
                        <div style={{ color:'var(--text-dim)' }}>{c.amountLocked} {c.asset}</div>
                        <div style={{ color:'var(--text-muted)', fontSize:9 }}>{fmtUSD(c.lockUSD)}</div>
                      </div>
                      <div>
                        <div style={{ color:'var(--text-muted)', fontSize:9, marginBottom:2 }}>PÉRIODE</div>
                        <div style={{ color:'var(--text-dim)' }}>{fmtDate(c.lockDate)}</div>
                        <div style={{ color:'var(--text-muted)', fontSize:9 }}>{c.days}j · {fmtDate(c.settleDate)}</div>
                      </div>
                      <div>
                        <div style={{ color:'var(--text-muted)', fontSize:9, marginBottom:2 }}>APY RÉEL</div>
                        <div style={{ color:'var(--accent2)', fontWeight:700 }}>{c.apyReal.toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="empty-state"><div className="empty-icon">◇</div><h3>Aucun contrat</h3></div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
