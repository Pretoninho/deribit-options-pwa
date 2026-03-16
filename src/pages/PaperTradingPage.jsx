import { useState, useEffect } from 'react'
import { getSpot, getOrderBook } from '../utils/api.js'

const LS_PAPER_POSITIONS = 'paper_positions'
const LS_PAPER_BALANCE = 'paper_balance'

export default function PaperTradingPage({ onBack }) {
  const [asset, setAsset] = useState('BTC')
  const [positions, setPositions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_PAPER_POSITIONS) || '[]') } catch { return [] }
  })
  const [balance, setBalance] = useState(() => parseFloat(localStorage.getItem(LS_PAPER_BALANCE) || '10000'))
  const [spot, setSpot] = useState(null)
  const [showNewTrade, setShowNewTrade] = useState(false)
  const [newTrade, setNewTrade] = useState({ type: 'buy', optionType: 'call', strike: '', expiry: '', quantity: 1 })
  const [pnl, setPnl] = useState(0)

  useEffect(() => {
    const loadSpot = async () => {
      const s = await getSpot(asset).catch(() => null)
      setSpot(s)
    }
    loadSpot()
  }, [asset])

  useEffect(() => {
    localStorage.setItem(LS_PAPER_POSITIONS, JSON.stringify(positions))
  }, [positions])

  useEffect(() => {
    localStorage.setItem(LS_PAPER_BALANCE, balance.toString())
  }, [balance])

  // Calculer P&L total
  useEffect(() => {
    const calcPnl = async () => {
      let totalPnl = 0
      for (const pos of positions) {
        if (pos.asset !== asset) continue
        const ob = await getOrderBook(pos.instrument).catch(() => null)
        if (ob?.mark_price) {
          const currentPrice = ob.mark_price
          const entryPrice = pos.entryPrice
          const qty = pos.quantity * (pos.side === 'buy' ? 1 : -1)
          totalPnl += (currentPrice - entryPrice) * qty // en USD
        }
      }
      setPnl(totalPnl)
    }
    calcPnl()
  }, [positions, asset, spot])

  const executeTrade = async () => {
    if (!newTrade.strike || !newTrade.expiry) return
    const instrument = `${asset}-${newTrade.expiry}-${newTrade.strike}-${newTrade.optionType[0]}`
    const ob = await getOrderBook(instrument).catch(() => null)
    if (!ob?.mark_price) return alert('Prix non disponible pour cet instrument')

    const price = ob.mark_price
    const cost = price * newTrade.quantity * (newTrade.type === 'buy' ? 1 : -1) // options en USD

    if (newTrade.type === 'buy' && cost > balance) return alert('Solde insuffisant')

    const position = {
      id: Date.now(),
      asset,
      instrument,
      side: newTrade.type,
      optionType: newTrade.optionType,
      strike: parseFloat(newTrade.strike),
      expiry: newTrade.expiry,
      quantity: newTrade.quantity,
      entryPrice: price,
      entryTime: new Date().toISOString(),
      spotAtEntry: spot
    }

    setPositions(prev => [...prev, position])
    setBalance(prev => prev - cost)
    setShowNewTrade(false)
    setNewTrade({ type: 'buy', optionType: 'call', strike: '', expiry: '', quantity: 1 })
  }

  const closePosition = (id) => {
    const pos = positions.find(p => p.id === id)
    if (!pos) return
    // Simuler la clôture au prix actuel
    const currentPrice = pos.entryPrice // simplification, devrait récupérer prix actuel
    const pnl = (currentPrice - pos.entryPrice) * pos.quantity * (pos.side === 'buy' ? 1 : -1)
    setBalance(prev => prev + pnl)
    setPositions(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        <div className="page-wrap">

          {/* Header */}
          <div className="page-header">
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="page-title">Paper <span>Trading</span></div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div className="price-pill"><span className="price-label">{asset}</span><span className="price-value">${spot?.toLocaleString()}</span></div>
              <button className="icon-btn" onClick={() => setShowNewTrade(true)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Balance & P&L */}
          <div style={{ display:'flex', gap:12, marginBottom:16 }}>
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', flex:1 }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>Solde</div>
              <div style={{ fontFamily:'var(--sans)', fontWeight:800, fontSize:16, color:'var(--text)' }}>${balance.toLocaleString()}</div>
            </div>
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', flex:1 }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>P&L Total</div>
              <div style={{ fontFamily:'var(--sans)', fontWeight:800, fontSize:16, color: pnl >= 0 ? 'var(--call)' : 'var(--put)' }}>
                {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Asset toggle */}
          <div className="asset-toggle" style={{ marginBottom:12 }}>
            <button className={`asset-btn${asset==='BTC'?' active-btc':''}`} onClick={() => setAsset('BTC')}>BTC</button>
            <button className={`asset-btn${asset==='ETH'?' active-eth':''}`} onClick={() => setAsset('ETH')}>ETH</button>
          </div>

          {/* Positions */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontFamily:'var(--sans)', fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:8 }}>Positions ouvertes</div>
            {positions.filter(p => p.asset === asset).length === 0 ? (
              <div className="card">
                <div style={{ padding:24, textAlign:'center', color:'var(--text-muted)' }}>
                  Aucune position ouverte
                </div>
              </div>
            ) : (
              positions.filter(p => p.asset === asset).map(pos => (
                <div key={pos.id} className="card" style={{ marginBottom:8 }}>
                  <div style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <div>
                        <div style={{ fontFamily:'var(--sans)', fontWeight:700, fontSize:13, color:'var(--text)' }}>
                          {pos.side === 'buy' ? 'Achat' : 'Vente'} {pos.optionType} ${pos.strike}
                        </div>
                        <div style={{ fontSize:10, color:'var(--text-muted)' }}>
                          {pos.expiry} · {pos.quantity} contrat{pos.quantity > 1 ? 's' : ''}
                        </div>
                      </div>
                      <button onClick={() => closePosition(pos.id)} style={{
                        background:'var(--put)', color:'white', border:'none', borderRadius:6, padding:'4px 8px',
                        fontSize:10, cursor:'pointer'
                      }}>
                        Clôturer
                      </button>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                      Entrée: ${pos.entryPrice.toFixed(2)} · Spot: ${pos.spotAtEntry?.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* New Trade Modal */}
          {showNewTrade && (
            <div style={{
              position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,.5)',
              display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
            }}>
              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, padding:20, width:'90%', maxWidth:320 }}>
                <div style={{ fontFamily:'var(--sans)', fontWeight:800, fontSize:16, color:'var(--text)', marginBottom:16 }}>Nouvelle transaction</div>

                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  <button className={`asset-btn${newTrade.type==='buy'?' active-btc':''}`} onClick={() => setNewTrade({...newTrade, type:'buy'})}>Achat</button>
                  <button className={`asset-btn${newTrade.type==='sell'?' active-eth':''}`} onClick={() => setNewTrade({...newTrade, type:'sell'})}>Vente</button>
                </div>

                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  <button className={`asset-btn${newTrade.optionType==='call'?' active-btc':''}`} onClick={() => setNewTrade({...newTrade, optionType:'call'})}>Call</button>
                  <button className={`asset-btn${newTrade.optionType==='put'?' active-eth':''}`} onClick={() => setNewTrade({...newTrade, optionType:'put'})}>Put</button>
                </div>

                <input
                  type="number"
                  placeholder="Strike"
                  value={newTrade.strike}
                  onChange={e => setNewTrade({...newTrade, strike: e.target.value})}
                  style={{ width:'100%', padding:8, border:'1px solid var(--border)', borderRadius:6, marginBottom:8, background:'var(--surface)', color:'var(--text)' }}
                />

                <input
                  type="text"
                  placeholder="Expiry (YYYY-MM-DD)"
                  value={newTrade.expiry}
                  onChange={e => setNewTrade({...newTrade, expiry: e.target.value})}
                  style={{ width:'100%', padding:8, border:'1px solid var(--border)', borderRadius:6, marginBottom:8, background:'var(--surface)', color:'var(--text)' }}
                />

                <input
                  type="number"
                  placeholder="Quantité"
                  value={newTrade.quantity}
                  onChange={e => setNewTrade({...newTrade, quantity: parseInt(e.target.value) || 1})}
                  style={{ width:'100%', padding:8, border:'1px solid var(--border)', borderRadius:6, marginBottom:16, background:'var(--surface)', color:'var(--text)' }}
                />

                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setShowNewTrade(false)} style={{
                    flex:1, padding:10, border:'1px solid var(--border)', borderRadius:6, background:'none', color:'var(--text-muted)', cursor:'pointer'
                  }}>Annuler</button>
                  <button onClick={executeTrade} style={{
                    flex:1, padding:10, border:'none', borderRadius:6, background:'var(--accent)', color:'white', cursor:'pointer'
                  }}>Exécuter</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}