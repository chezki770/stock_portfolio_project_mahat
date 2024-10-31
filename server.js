require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const {
  addInvestor,
  buyStocks,
  sellStocks,
  showPortfolio,
  updateStockPrices,
//   evaluateStockRisk,
//   evaluatePortfolioRisk
} = require('./backend/InvestmentSystem');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

async function testDBConnection() {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to the PostgreSQL database.');
    client.release();
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

testDBConnection();

app.post('/login', async (req, res) => {
  const { investorName } = req.body;
  try {
    const result = await addInvestor(investorName);
    console.log('Login result:', result); // Debug log
    res.json({ message: result });
  } catch (error) {
    console.error('Login error:', error); // Debug log
    res.status(400).json({ error: error.message });
  }
});

app.post('/buy', async (req, res) => {
  const { investorName, stockSymbol, shares } = req.body;
  try {
    const result = await buyStocks(investorName, stockSymbol, parseInt(shares));
    res.json({ message: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/sell', async (req, res) => {
  const { investorName, stockSymbol, shares } = req.body;
  try {
    const result = await sellStocks(investorName, stockSymbol, parseInt(shares));
    res.json({ message: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/portfolio/:investorName', async (req, res) => {
  const { investorName } = req.params;
  try {
    const portfolio = await showPortfolio(investorName);
    res.json(portfolio);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/update-prices', async (req, res) => {
  try {
    const result = await updateStockPrices();
    res.json({ message: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// app.get('/evaluate-stock/:symbol', async (req, res) => {
//   const { symbol } = req.params;
//   try {
//     const riskAssessment = await evaluateStockRisk(symbol);
//     res.json({ riskAssessment });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

// app.get('/evaluate-portfolio/:investorName', async (req, res) => {
//   const { investorName } = req.params;
//   try {
//     const riskAssessment = await evaluatePortfolioRisk(investorName);
//     res.json({ riskAssessment });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));