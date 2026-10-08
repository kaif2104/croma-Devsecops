"""Regenerates db/init.sql and frontend/public/img/*.svg (20 smartphones + 20 laptops)."""
import os
root = os.path.dirname(os.path.abspath(__file__))

phone_brands = [("Nova", "X", 0, 210), ("Zenith", "Z", 40, 160), ("Aura", "A", 80, 280),
                ("Orbit", "O", 20, 30), ("Pixelon", "P", 60, 340)]
phone_tiers = [("Lite", 6, 128, 6.1, 4200, 299), ("Plus", 8, 256, 6.4, 4600, 499),
               ("Pro", 12, 512, 6.7, 5000, 799), ("Ultra", 16, 1024, 6.9, 5400, 1099)]
lap_brands = [("Vertex", 220, 0), ("Lumio", 150, 30), ("Kairo", 20, 60), ("Strata", 280, 90), ("Helix", 340, 120)]
lap_tiers = [("Air 13", "Quad-core 2.4GHz", 8, 256, 13.3, 1.2, 549), ("Go 14", "Hexa-core 3.0GHz", 16, 512, 14.0, 1.4, 799),
             ("Pro 15", "Octa-core 3.6GHz", 16, 1024, 15.6, 1.8, 1199), ("Studio 16", "12-core 4.2GHz", 32, 2048, 16.0, 2.1, 1799)]

def phone_svg(brand, tier, hue, lenses):
    cam = "".join(f'<circle cx="{168+i%2*30}" cy="{78+i//2*30}" r="11" fill="#111" stroke="#555" stroke-width="3"/>' for i in range(lenses))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl({hue},45%,92%)"/><stop offset="1" stop-color="hsl({hue},45%,78%)"/></linearGradient>
<linearGradient id="sc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl({hue},80%,55%)"/><stop offset="1" stop-color="hsl({(hue+60)%360},80%,30%)"/></linearGradient></defs>
<rect width="400" height="400" fill="url(#bg)"/><ellipse cx="200" cy="372" rx="90" ry="9" fill="#0002"/>
<rect x="122" y="30" width="156" height="334" rx="28" fill="#15171c"/><rect x="130" y="38" width="140" height="318" rx="22" fill="url(#sc)"/>
<rect x="180" y="46" width="40" height="9" rx="4.5" fill="#15171c"/>
<text x="200" y="215" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="22" fill="#fff">{brand}</text>
<text x="200" y="242" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#ffffffcc">{tier}</text>
<g transform="translate(46,20)" opacity="0">{cam}</g></svg>'''

def laptop_svg(brand, tier, hue):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl({hue},40%,93%)"/><stop offset="1" stop-color="hsl({hue},40%,78%)"/></linearGradient>
<linearGradient id="sc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl({hue},75%,50%)"/><stop offset="1" stop-color="hsl({(hue+70)%360},75%,25%)"/></linearGradient></defs>
<rect width="400" height="400" fill="url(#bg)"/><ellipse cx="200" cy="318" rx="170" ry="9" fill="#0002"/>
<rect x="72" y="76" width="256" height="170" rx="12" fill="#15171c"/><rect x="82" y="86" width="236" height="150" rx="5" fill="url(#sc)"/>
<text x="200" y="165" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="24" fill="#fff">{brand}</text>
<text x="200" y="190" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#ffffffcc">{tier}</text>
<path d="M40 252 H360 L346 292 Q344 298 336 298 H64 Q56 298 54 292 Z" fill="#c9ced6"/><rect x="170" y="252" width="60" height="7" rx="3.5" fill="#aab0ba"/></svg>'''

rows, pid = [], 0
def q(s): return "'" + s.replace("'", "''") + "'"
for bi, (b, s, off, hue) in enumerate(phone_brands):
    for ti, (t, ram, st, scr, bat, base) in enumerate(phone_tiers):
        pid += 1
        price = base + off + bi * 10
        name = f"{b} {s}{ti+1} {t}"
        spec = f'{scr}" OLED | {ram}GB RAM | {st if st<1024 else "1TB"}{"GB" if st<1024 else ""} | {bat}mAh | 5G'
        desc = f"{name} pairs a bright {scr}-inch OLED display with {ram}GB of memory and a {bat}mAh battery that lasts all day."
        open(f"{root}/frontend/public/img/p{pid}.svg", "w").write(phone_svg(b, f"{s}{ti+1} {t}", (hue + ti*12) % 360, ti+1))
        rows.append(f"({q(name)},{q(b)},'smartphone',{price}.99,{q(spec)},{q(desc)},'/img/p{pid}.svg',{20+(pid*7)%40})")
for bi, (b, hue, off) in enumerate(lap_brands):
    for ti, (t, cpu, ram, ssd, scr, kg, base) in enumerate(lap_tiers):
        pid += 1
        price = base + off + bi * 10
        name = f"{b} {t}"
        spec = f'{scr}" display | {cpu} | {ram}GB RAM | {ssd if ssd<1024 else str(ssd//1024)+"TB"}{"GB" if ssd<1024 else ""} SSD | {kg}kg'
        desc = f"{name} is a {kg}kg laptop with a {scr}-inch display, {ram}GB of memory and a fast SSD for everyday work and creative projects."
        open(f"{root}/frontend/public/img/p{pid}.svg", "w").write(laptop_svg(b, t, (hue + ti*10) % 360))
        rows.append(f"({q(name)},{q(b)},'laptop',{price}.99,{q(spec)},{q(desc)},'/img/p{pid}.svg',{10+(pid*5)%30})")

sql = """CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('smartphone','laptop')), price NUMERIC(10,2) NOT NULL,
  specs TEXT NOT NULL, description TEXT NOT NULL, image TEXT NOT NULL, stock INT NOT NULL CHECK (stock >= 0));
CREATE TABLE orders (id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total NUMERIC(12,2) NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE order_items (order_id INT REFERENCES orders(id) ON DELETE CASCADE, product_id INT REFERENCES products(id),
  qty INT NOT NULL CHECK (qty > 0), unit_price NUMERIC(10,2) NOT NULL);
INSERT INTO products (name,brand,category,price,specs,description,image,stock) VALUES
""" + ",\n".join(rows) + ";\n"
open(f"{root}/db/init.sql", "w").write(sql)
print(pid, "products generated")
