import { useEffect, useMemo, useState } from 'react';

const api = async (path, opts = {}, token) => {
  const res = await fetch('/api' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
};
const money = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function AuthForm({ onAuth, note }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    setError('');
    try {
      const d = await api(mode === 'login' ? '/login' : '/register', { method: 'POST', body: JSON.stringify({ email, password }) });
      onAuth(d.token, d.email);
    } catch (e) { setError(e.message); }
  };
  return (
    <div className="auth">
      <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
      {note && <p className="muted">{note}</p>}
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password (8+ characters)" value={password}
        onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn primary" onClick={submit}>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
      <button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New customer? Create an account' : 'Have an account? Sign in'}
      </button>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('featured');
  const [sel, setSel] = useState(null);
  const [cart, setCart] = useState(() => load('cart', {}));
  const [panel, setPanel] = useState(null); // 'cart' | 'auth' | 'orders'
  const [token, setToken] = useState(sessionStorage.getItem('token'));
  const [email, setEmail] = useState(sessionStorage.getItem('email') || '');
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => { api('/products').then(setProducts).catch(() => setMsg('Could not load products')); }, []);
  useEffect(() => save('cart', cart), [cart]);

  const shown = useMemo(() => {
    let l = products.filter((p) => (cat === 'all' || p.category === cat) &&
      (p.name + p.brand).toLowerCase().includes(q.toLowerCase()));
    if (sort === 'low') l = [...l].sort((a, b) => a.price - b.price);
    if (sort === 'high') l = [...l].sort((a, b) => b.price - a.price);
    return l;
  }, [products, cat, q, sort]);

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: products.find((x) => x.id == id), qty })).filter((l) => l.p);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.p.price, 0);

  const add = (p) => { setCart((c) => ({ ...c, [p.id]: Math.min((c[p.id] || 0) + 1, 10) })); setPanel('cart'); setSel(null); };
  const setQty = (id, n) => setCart((c) => { const x = { ...c }; if (n < 1) delete x[id]; else x[id] = Math.min(n, 10); return x; });
  const onAuth = (t, e) => { sessionStorage.setItem('token', t); sessionStorage.setItem('email', e); setToken(t); setEmail(e); setPanel('cart'); };
  const logout = () => { sessionStorage.clear(); setToken(null); setEmail(''); setPanel(null); };

  const checkout = async () => {
    if (!token) return setPanel('auth');
    try {
      const d = await api('/orders', { method: 'POST', body: JSON.stringify({ items: lines.map((l) => ({ id: l.p.id, qty: l.qty })) }) }, token);
      setCart({}); setPanel(null); setMsg(`Order #${d.id} placed. Total ${money(d.total)}.`);
      api('/products').then(setProducts);
    } catch (e) {
      if (e.status === 401) { logout(); setPanel('auth'); } else setMsg(e.message);
    }
  };
  const showOrders = async () => { try { setOrders(await api('/orders', {}, token)); setPanel('orders'); } catch { logout(); } };

  return (
    <>
      <header className="top">
        <div className="brand">ShopZone</div>
        <input className="search" placeholder="Search phones and laptops" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <nav>
          {token ? (<><button className="link" onClick={showOrders}>My orders</button><button className="link" onClick={logout}>Sign out</button></>)
                 : <button className="link" onClick={() => setPanel('auth')}>Sign in</button>}
          <button className="btn primary" onClick={() => setPanel('cart')}>Cart ({count})</button>
        </nav>
      </header>

      <section className="intro">
        <h1>Phones and laptops, 40 models in stock.</h1>
        <p className="muted">Compare specs, add to cart, check out in one step.</p>
      </section>

      {msg && <div className="toast" role="status">{msg}<button className="link" onClick={() => setMsg('')}>Dismiss</button></div>}

      <div className="bar">
        <div className="tabs">
          {[['all', 'All'], ['smartphone', 'Smartphones'], ['laptop', 'Laptops']].map(([k, label]) => (
            <button key={k} className={'tab' + (cat === k ? ' on' : '')} onClick={() => setCat(k)}>{label}</button>))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option>
        </select>
      </div>

      <main className="grid">
        {shown.map((p) => (
          <article key={p.id} className="item">
            <button className="imgbtn" onClick={() => setSel(p)}><img src={p.image} alt={p.name} loading="lazy" /></button>
            <div className="info">
              <h3>{p.name}</h3>
              <p className="muted small">{p.specs}</p>
              <div className="row"><strong>{money(p.price)}</strong>
                <button className="btn" disabled={p.stock < 1} onClick={() => add(p)}>{p.stock < 1 ? 'Sold out' : 'Add to cart'}</button></div>
            </div>
          </article>))}
        {!shown.length && <p className="muted">No products match your search.</p>}
      </main>

      {sel && (
        <div className="overlay" onClick={() => setSel(null)}>
          <div className="modal wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <img src={sel.image} alt={sel.name} />
            <div>
              <h2>{sel.name}</h2>
              <p className="muted">{sel.brand} | {sel.category}</p>
              <p>{sel.description}</p>
              <p className="small">{sel.specs}</p>
              <p className="small muted">{sel.stock} in stock</p>
              <h2>{money(sel.price)}</h2>
              <button className="btn primary" disabled={sel.stock < 1} onClick={() => add(sel)}>Add to cart</button>
              <button className="link" onClick={() => setSel(null)}>Close</button>
            </div>
          </div>
        </div>)}

      {panel && (
        <div className="overlay right" onClick={() => setPanel(null)}>
          <aside className="drawer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="link close" onClick={() => setPanel(null)}>Close</button>
            {panel === 'auth' && <AuthForm onAuth={onAuth} note="Sign in to check out." />}
            {panel === 'cart' && (<>
              <h2>Your cart</h2>
              {!lines.length && <p className="muted">Your cart is empty. Add a phone or laptop to get started.</p>}
              {lines.map(({ p, qty }) => (
                <div key={p.id} className="line">
                  <img src={p.image} alt="" />
                  <div><strong>{p.name}</strong><div className="small muted">{money(p.price)}</div>
                    <div className="qty"><button onClick={() => setQty(p.id, qty - 1)} aria-label="Decrease">-</button>{qty}
                      <button onClick={() => setQty(p.id, qty + 1)} aria-label="Increase">+</button></div></div>
                </div>))}
              {!!lines.length && (<><h3>Total {money(total)}</h3>
                <button className="btn primary" onClick={checkout}>{token ? 'Place order' : 'Sign in to check out'}</button></>)}
            </>)}
            {panel === 'orders' && (<>
              <h2>My orders</h2>
              {!orders.length && <p className="muted">No orders yet.</p>}
              {orders.map((o) => (
                <div key={o.id} className="order"><strong>Order #{o.id}</strong> <span className="muted small">{new Date(o.created_at).toLocaleDateString()}</span>
                  {o.items.map((i, k) => <div key={k} className="small">{i.qty} x {i.name}</div>)}
                  <div>{money(o.total)}</div></div>))}
              <p className="small muted">Signed in as {email}</p>
            </>)}
          </aside>
        </div>)}
    </>
  );
}
