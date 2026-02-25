import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("orders.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contractNo TEXT,
    poNo TEXT,
    item TEXT,
    buyer TEXT,
    styleName TEXT,
    color TEXT,
    season TEXT,
    orderQty INTEGER,
    washPricePcs REAL,
    washPriceDoz REAL,
    bp TEXT,
    wo TEXT,
    shipmentDate TEXT
  );

  CREATE TABLE IF NOT EXISTS buyers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );
`);

// Seed initial buyers if table is empty
const buyerCount = db.prepare("SELECT COUNT(*) as count FROM buyers").get() as { count: number };
if (buyerCount.count === 0) {
  const initialBuyers = ["H&M", "Mango", "Stradivarius", "Jules", "Benetton", "GDM", "Zara"];
  const insert = db.prepare("INSERT INTO buyers (name) VALUES (?)");
  initialBuyers.forEach(name => insert.run(name));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/buyers", (req, res) => {
    const buyers = db.prepare("SELECT * FROM buyers").all();
    res.json(buyers);
  });

  app.post("/api/buyers", (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO buyers (name) VALUES (?)").run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch (e) {
      res.status(400).json({ error: "Buyer already exists" });
    }
  });

  app.delete("/api/buyers/:name", (req, res) => {
    const { name } = req.params;
    db.prepare("DELETE FROM buyers WHERE name = ?").run(name);
    res.json({ success: true });
  });

  app.get("/api/orders", (req, res) => {
    const { buyer } = req.query;
    let query = "SELECT * FROM orders";
    const params: any[] = [];

    if (buyer && buyer !== "Buyers") {
      query += " WHERE buyer = ?";
      params.push(buyer);
    }

    const orders = db.prepare(query).all(...params);
    res.json(orders);
  });

  app.post("/api/orders", (req, res) => {
    const {
      contractNo,
      poNo,
      item,
      buyer,
      styleName,
      color,
      season,
      orderQty,
      washPricePcs,
      washPriceDoz,
      bp,
      wo,
      shipmentDate,
    } = req.body;

    const info = db.prepare(`
      INSERT INTO orders (
        contractNo, poNo, item, buyer, styleName, color, season, 
        orderQty, washPricePcs, washPriceDoz, bp, wo, shipmentDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contractNo, poNo, item, buyer, styleName, color, season,
      orderQty, washPricePcs, washPriceDoz, bp, wo, shipmentDate
    );

    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/orders/:id", (req, res) => {
    const id = parseInt(req.params.id);
    db.prepare("DELETE FROM orders WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.put("/api/orders/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const {
      contractNo,
      poNo,
      item,
      buyer,
      styleName,
      color,
      season,
      orderQty,
      washPricePcs,
      washPriceDoz,
      bp,
      wo,
      shipmentDate,
    } = req.body;

    db.prepare(`
      UPDATE orders SET 
        contractNo = ?, poNo = ?, item = ?, buyer = ?, styleName = ?, 
        color = ?, season = ?, orderQty = ?, washPricePcs = ?, 
        washPriceDoz = ?, bp = ?, wo = ?, shipmentDate = ?
      WHERE id = ?
    `).run(
      contractNo, poNo, item, buyer, styleName, color, season,
      orderQty, washPricePcs, washPriceDoz, bp, wo, shipmentDate,
      id
    );

    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
