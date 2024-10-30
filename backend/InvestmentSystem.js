const { Pool } = require('pg');
const axios = require('axios');

const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY;
const ALPHAVANTAGE_BASE_URL = "https://www.alphavantage.co/query";

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

async function fetchStockPrice(symbol) {
    try {
        const response = await axios.get(ALPHAVANTAGE_BASE_URL, {
            params: {
                function: "GLOBAL_QUOTE",
                symbol: symbol,
                apikey: ALPHAVANTAGE_API_KEY,
            }
        });

        const data = response.data;

        if ("Global Quote" in data && data["Global Quote"]) {
            return {
                price: parseFloat(data["Global Quote"]["05. price"] || 0),
                symbol: data["Global Quote"]["01. symbol"] || symbol,
                latestTradingDay: data["Global Quote"]["07. latest trading day"] || "Unknown",
            };
        } else if ("Note" in data) {
            console.log(`API limit reached: ${data['Note']}`);
            return null;
        } else {
            console.log(`No data available for symbol: ${symbol}`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching data: ${error.message}`);
        return null;
    }
}

async function updateStockPrices() {
    const client = await pool.connect();
    try {
        const { rows } = await client.query("SELECT symbol FROM stocks");
        const symbols = rows.map(row => row.symbol);

        for (const symbol of symbols) {
            const stockData = await fetchStockPrice(symbol);
            if (stockData) {
                await client.query(
                    "UPDATE stocks SET price = $1 WHERE symbol = $2",
                    [stockData.price, symbol]
                );
                console.log(`Updated ${symbol} price to ${stockData.price.toFixed(2)}`);
            } else {
                console.log(`Failed to update ${symbol}`);
            }
        }
        return "Stock prices updated successfully";
    } finally {
        client.release();
    }
}

async function addInvestor(investorName) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'INSERT INTO investors (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *',
            [investorName]
        );
        if (result.rows.length > 0) {
            return `Investor ${investorName} has been added.`;
        } else {
            return "Investor already exists.";
        }
    } finally {
        client.release();
    }
}


async function showPortfolio(investorName) {
    const client = await pool.connect();
    try {
        const { rows } = await client.query(`
            SELECT s.symbol, s.company, p.shares, s.price, s.beta, (p.shares * s.price) AS total_value
            FROM investors i
            JOIN portfolios p ON i.id = p.investor_id
            JOIN stocks s ON p.stock_symbol = s.symbol
            WHERE i.name = $1
        `, [investorName]);

        if (rows.length > 0) {
            let totalPortfolioValue = 0;
            let weightedBetaSum = 0;
            const portfolio = rows.map(stock => {
                totalPortfolioValue += parseFloat(stock.total_value);
                if (stock.beta !== null) {
                    weightedBetaSum += parseFloat(stock.beta) * parseFloat(stock.total_value);
                }
                return {
                    symbol: stock.symbol,
                    company: stock.company,
                    shares: parseInt(stock.shares),
                    currentPrice: parseFloat(stock.price),
                    beta: parseFloat(stock.beta),
                    totalValue: parseFloat(stock.total_value)
                };
            });

            const portfolioRisk = totalPortfolioValue > 0 ? weightedBetaSum / totalPortfolioValue : 0;

            return {
                investor: investorName,
                portfolio: portfolio,
                totalValue: totalPortfolioValue,
                riskScore: portfolioRisk
            };
        } else {
            return { message: `${investorName} has no stocks in their portfolio.` };
        }
    } finally {
        client.release();
    }
}

async function buyStocks(investorName, stockSymbol, shares) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const stockData = await fetchStockPrice(stockSymbol);
        if (stockData === null) {
            throw new Error(`Unable to proceed with purchase for ${stockSymbol}`);
        }

        const currentPrice = stockData.price;

        // Check if the stock exists in the database
        const { rows: existingStock } = await client.query(
            "SELECT 1 FROM stocks WHERE symbol = $1",
            [stockSymbol]
        );

        if (existingStock.length === 0) {
            // If the stock doesn't exist, add it to the database
            await client.query(
                "INSERT INTO stocks (symbol, company, price, market_cap, pe_ratio, beta) VALUES ($1, $2, $3, $4, $5, $6)",
                [stockSymbol, `Company for ${stockSymbol}`, currentPrice, 'Unknown', 0, 0]
            );
        } else {
            // If the stock exists, update its price
            await client.query(
                "UPDATE stocks SET price = $1 WHERE symbol = $2",
                [currentPrice, stockSymbol]
            );
        }

        // Get investor ID
        const { rows: investorRows } = await client.query(
            "SELECT id FROM investors WHERE name = $1",
            [investorName]
        );

        if (investorRows.length === 0) {
            throw new Error(`Investor ${investorName} not found.`);
        }

        const investorId = investorRows[0].id;

        // Check if the investor already owns this stock
        const { rows: portfolioRows } = await client.query(
            "SELECT shares FROM portfolios WHERE investor_id = $1 AND stock_symbol = $2",
            [investorId, stockSymbol]
        );

        if (portfolioRows.length > 0) {
            // Update existing portfolio entry
            await client.query(
                "UPDATE portfolios SET shares = shares + $1 WHERE investor_id = $2 AND stock_symbol = $3",
                [shares, investorId, stockSymbol]
            );
        } else {
            // Insert new portfolio entry
            await client.query(
                "INSERT INTO portfolios (investor_id, stock_symbol, shares) VALUES ($1, $2, $3)",
                [investorId, stockSymbol, shares]
            );
        }

        await client.query('COMMIT');

        const totalCost = currentPrice * shares;
        return `${investorName} bought ${shares} shares of ${stockSymbol} at $${currentPrice.toFixed(2)} per share. Total cost: $${totalCost.toFixed(2)}`;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function sellStocks(investorName, stockSymbol, shares) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get investor ID
        const { rows: investorRows } = await client.query(
            "SELECT id FROM investors WHERE name = $1",
            [investorName]
        );

        if (investorRows.length === 0) {
            throw new Error(`Investor ${investorName} not found.`);
        }

        const investorId = investorRows[0].id;

        // Check if the investor owns this stock
        const { rows: portfolioRows } = await client.query(
            "SELECT shares FROM portfolios WHERE investor_id = $1 AND stock_symbol = $2",
            [investorId, stockSymbol]
        );

        if (portfolioRows.length === 0) {
            throw new Error(`${investorName} does not own any shares of ${stockSymbol}.`);
        }

        const currentShares = parseInt(portfolioRows[0].shares);
        if (currentShares < shares) {
            throw new Error(`${investorName} only owns ${currentShares} shares of ${stockSymbol}.`);
        }

        const newShares = currentShares - shares;
        if (newShares === 0) {
            // Remove the entry if all shares are sold
            await client.query(
                "DELETE FROM portfolios WHERE investor_id = $1 AND stock_symbol = $2",
                [investorId, stockSymbol]
            );
        } else {
            // Update the number of shares
            await client.query(
                "UPDATE portfolios SET shares = $1 WHERE investor_id = $2 AND stock_symbol = $3",
                [newShares, investorId, stockSymbol]
            );
        }

        const stockData = await fetchStockPrice(stockSymbol);
        const currentPrice = stockData ? stockData.price : 0;
        const totalValue = currentPrice * shares;

        await client.query('COMMIT');

        return `${investorName} sold ${shares} shares of ${stockSymbol} at $${currentPrice.toFixed(2)} per share. Total value: $${totalValue.toFixed(2)}`;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function evaluateStockRisk(stockSymbol) {
    const client = await pool.connect();
    try {
        const { rows: stockData } = await client.query(
            "SELECT beta, price, pe_ratio, market_cap FROM stocks WHERE symbol = $1",
            [stockSymbol]
        );

        if (stockData.length === 0) {
            throw new Error(`Stock ${stockSymbol} not found in the database.`);
        }

        const { beta, price, pe_ratio, market_cap } = stockData[0];

        let riskAssessment = `Risk Assessment for ${stockSymbol}:\n\n`;

        if (beta === null) {
            riskAssessment += "1. Beta: Not available\n";
        } else {
            riskAssessment += `1. Beta: ${parseFloat(beta).toFixed(2)}\n`;
            if (beta < 0.8) {
                riskAssessment += "   Interpretation: Low risk compared to the market\n";
            } else if (beta >= 0.8 && beta < 1.2) {
                riskAssessment += "   Interpretation: Moderate risk, similar to the market\n";
            } else {
                riskAssessment += "   Interpretation: High risk compared to the market\n";
            }
        }

        riskAssessment += `\n2. Current Price: $${parseFloat(price).toFixed(2)}\n`;

        if (pe_ratio) {
            riskAssessment += `\n3. P/E Ratio: ${parseFloat(pe_ratio).toFixed(2)}\n`;
            if (pe_ratio < 15) {
                riskAssessment += "   Interpretation: Potentially undervalued or higher risk\n";
            } else if (pe_ratio >= 15 && pe_ratio <= 25) {
                riskAssessment += "   Interpretation: Fairly valued\n";
            } else {
                riskAssessment += "   Interpretation: Potentially overvalued or lower risk\n";
            }
        } else {
            riskAssessment += "\n3. P/E Ratio: Not available\n";
        }

        riskAssessment += `\n4. Market Cap: ${market_cap}\n`;
        riskAssessment += "   Note: Market cap can indicate company size and associated risks\n";

        return riskAssessment;
    } finally {
        client.release();
    }
}

async function evaluatePortfolioRisk(investorName) {
    const portfolioData = await showPortfolio(investorName);
    
    if ('message' in portfolioData) {
        return portfolioData.message;
    }

    let riskAssessment = `Portfolio Risk Assessment for ${investorName}:\n\n`;
    riskAssessment += `Total Portfolio Value: $${portfolioData.totalValue.toFixed(2)}\n`;
    riskAssessment += `Portfolio Risk Score (Weighted Beta): ${portfolioData.riskScore.toFixed(2)}\n\n`;

    if (portfolioData.riskScore < 0.8) {
        riskAssessment += "Overall: Your portfolio is considered less risky than the market.\n";
    } else if (portfolioData.riskScore >= 0.8 && portfolioData.riskScore < 1.2) {
        riskAssessment += "Overall: Your portfolio has average market risk.\n";
    } else {
        riskAssessment += "Overall: Your portfolio is considered more risky than the market.\n";
    }

    return riskAssessment;
}

module.exports = {
    fetchStockPrice,
    updateStockPrices,
    addInvestor,
    showPortfolio,
    buyStocks,
    sellStocks,
    evaluateStockRisk,
    evaluatePortfolioRisk
};