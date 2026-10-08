const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SECRET = process.env.JWT_SECRET;
if (!SECRET) { console.error('JWT_SECRET is required'); process.exit(1); }

app.use(cors());
app.use(express.json({ limit: '10kb' }));

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Server error' });
});
const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').split(' ')[1];
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Please sign in to continue' }); }
};
const sign = (u) => jwt.sign({ id: u.id, email: u.email }, SECRET, { expiresIn: '2h' });
const validEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ---- auth ----
app.post('/api/register', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!validEmail(email) || typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'Use a valid email and a password of 8+ characters' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const r = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email',
      [email.toLowerCase(), hash]);
    res.status(201).json({ token: sign(r.rows[0]), email: r.rows[0].email });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw e;
  }
}));

app.post('/api/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!validEmail(email) || typeof password !== 'string')
    return res.status(400).json({ error: 'Enter your email and password' });
  const r = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: sign(u), email: u.email });
}));

// ---- catalog (public) ----
app.get('/api/products', wrap(async (req, res) => {
  const r = await pool.query('SELECT * FROM products ORDER BY id');
  res.json(r.rows.map((p) => ({ ...p, price: Number(p.price) })));
}));

// ---- orders (auth). Prices always come from the database, never from the client ----
app.post('/api/orders', auth, wrap(async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || !items.length || items.length > 50)
    return res.status(400).json({ error: 'Your cart is empty' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let total = 0; const lines = [];
    for (const it of items) {
      const id = parseInt(it.id, 10), qty = parseInt(it.qty, 10);
      if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 10)
        throw Object.assign(new Error('Invalid cart item'), { bad: true });
      const r = await client.query(
        'UPDATE products SET stock = stock - $2 WHERE id = $1 AND stock >= $2 RETURNING price', [id, qty]);
      if (!r.rows[0]) throw Object.assign(new Error('An item is out of stock'), { bad: true });
      total += Number(r.rows[0].price) * qty;
      lines.push([id, qty, r.rows[0].price]);
    }
    const o = await client.query('INSERT INTO orders (user_id,total) VALUES ($1,$2) RETURNING id',
      [req.user.id, total.toFixed(2)]);
    for (const l of lines)
      await client.query('INSERT INTO order_items (order_id,product_id,qty,unit_price) VALUES ($1,$2,$3,$4)',
        [o.rows[0].id, ...l]);
    await client.query('COMMIT');
    res.status(201).json({ id: o.rows[0].id, total: Number(total.toFixed(2)) });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.bad) return res.status(400).json({ error: e.message });
    throw e;
  } finally { client.release(); }
}));

app.get('/api/orders', auth, wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT o.id, o.total, o.created_at,
       json_agg(json_build_object('name', p.name, 'qty', i.qty, 'price', i.unit_price)) AS items
     FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id
     WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.id DESC`, [req.user.id]);
  res.json(r.rows.map((o) => ({ ...o, total: Number(o.total) })));
}));

app.listen(process.env.PORT || 4000, () => console.log('API running'));
