
const API_URL = 'http://localhost:8080';

async function login() {
    const investorName = document.getElementById('investorName').value.trim();
    if (investorName) {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ investorName })
            });
            const data = await response.json();
            if (response.ok) {
                sessionStorage.setItem('investorName', investorName);
                window.location.href = "./loggedIn.html";
            } else {
                throw new Error(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert(`Login failed: ${error.message}`);
        }
    } else {
        alert('Please enter your name');
    }
}

// Add event listener for Enter key press
document.addEventListener('DOMContentLoaded', function() {
    const investorNameInput = document.getElementById('investorName');
    if (investorNameInput) {
        investorNameInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent form submission if it's in a form
                login();
            }
        });
    }
});

function initLoggedInPage() {
    const investorName = sessionStorage.getItem('investorName');
    if (investorName) {
        document.getElementById('welcomeName').textContent = investorName;
        document.getElementById('mainSection').style.display = 'block';
    } else {
        window.location.href = "./index.html";
    }
}

window.onload = function() {
    if (document.getElementById('mainSection')) {
        initLoggedInPage();
    }
};

function goBack() {
    sessionStorage.removeItem('investorName');
    window.location.href = "./index.html";
}

async function buyStocks() {
    const symbol = prompt('Enter stock symbol:');
    const shares = prompt('Enter number of shares:');
    if (symbol && shares) {
        try {
            const response = await fetch(`${API_URL}/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    investorName: sessionStorage.getItem('investorName'),
                    stockSymbol: symbol,
                    shares: parseInt(shares)
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                showPortfolio();
            } else {
                throw new Error(data.error || 'Failed to buy stocks');
            }
        } catch (error) {
            console.error('Buy stocks error:', error);
            alert(`Failed to buy stocks: ${error.message}`);
        }
    }
}

async function sellStocks() {
    const symbol = prompt('Enter stock symbol:');
    const shares = prompt('Enter number of shares:');
    if (symbol && shares) {
        try {
            const response = await fetch(`${API_URL}/sell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    investorName: sessionStorage.getItem('investorName'),
                    stockSymbol: symbol,
                    shares: parseInt(shares)
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                showPortfolio();
            } else {
                throw new Error(data.error || 'Failed to sell stocks');
            }
        } catch (error) {
            console.error('Sell stocks error:', error);
            alert(`Failed to sell stocks: ${error.message}`);
        }
    }
}

async function showPortfolio() {
    try {
        const investorName = sessionStorage.getItem('investorName');
        const response = await fetch(`${API_URL}/portfolio/${investorName}`);
        const data = await response.json();
        
        if (response.ok) {
            let portfolioHTML = `
                <div class="portfolio-summary">
                    <h3>Portfolio Summary for ${data.investor}</h3>
                    <p class="total-value">Total Value: $${data.totalValue.toFixed(2)}</p>
                    <p class="risk-score">Risk Score: ${data.riskScore.toFixed(2)}</p>
                </div>
                <table class="portfolio-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Company</th>
                            <th>Shares</th>
                            <th>Price</th>
                            <th>Total Value</th>
                            <th>Beta</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            for (const stock of data.portfolio) {
                portfolioHTML += `
                    <tr>
                        <td>${stock.symbol}</td>
                        <td>${stock.company}</td>
                        <td>${stock.shares}</td>
                        <td>$${stock.currentPrice.toFixed(2)}</td>
                        <td>$${stock.totalValue.toFixed(2)}</td>
                        <td>${stock.beta !== null ? stock.beta.toFixed(2) : 'N/A'}</td>
                        <td><button onclick="evaluateStock('${stock.symbol}')">Evaluate</button></td>
                    </tr>
                `;
            }
            
            portfolioHTML += `
                    </tbody>
                </table>
            `;
            
            document.getElementById('results').innerHTML = portfolioHTML;
        } else {
            throw new Error(data.error || 'Failed to fetch portfolio');
        }
    } catch (error) {
        console.error('Portfolio fetch error:', error);
        document.getElementById('results').innerHTML = `
            <h3>Error Fetching Portfolio</h3>
            <p>An error occurred while fetching your portfolio: ${error.message}</p>
            <p>Please try again later or contact support if the problem persists.</p>
        `;
    }
}

async function updateStockPrices() {
    try {
        const response = await fetch(`${API_URL}/update-prices`, { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            showPortfolio();
        } else {
            throw new Error(data.error || 'Failed to update stock prices');
        }
    } catch (error) {
        console.error('Update prices error:', error);
        alert(`Failed to update stock prices: ${error.message}`);
    }
}

async function evaluateStock(symbol) {
    if (!symbol) {
        symbol = prompt('Enter stock symbol to evaluate:');
    }
    if (symbol) {
        try {
            console.log(`Fetching data for symbol: ${symbol}`);
            const response = await fetch(`${API_URL}/evaluate-stock/${symbol}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received stock data:', data);

            if (!data || !data.riskAssessment) {
                throw new Error('No risk assessment data received from the server');
            }

            displayStockEvaluation(symbol, data.riskAssessment);
        } catch (error) {
            console.error('Stock evaluation error:', error);
            document.getElementById('results').innerHTML = `
                <div class="evaluation">
                    <h3>Error Evaluating Stock: ${symbol}</h3>
                    <p>An error occurred while evaluating the stock: ${error.message}</p>
                    <p>Please check if the stock symbol is correct and try again later.</p>
                </div>
            `;
        }
    }
}

function displayStockEvaluation(symbol, riskAssessment) {
    console.log('Displaying evaluation for:', symbol, riskAssessment);

    // Parse the risk assessment string
    const lines = riskAssessment.split('\n');
    const beta = lines.find(line => line.includes('Beta:'))?.split(':')[1]?.trim() || 'N/A';
    const currentPrice = lines.find(line => line.includes('Current Price:'))?.split(':')[1]?.trim() || 'N/A';
    const peRatio = lines.find(line => line.includes('P/E Ratio:'))?.split(':')[1]?.trim() || 'N/A';
    const marketCap = lines.find(line => line.includes('Market Cap:'))?.split(':')[1]?.trim() || 'N/A';

    const evaluationHTML = `
        <div class="evaluation">
            <h3>Risk Assessment for ${symbol}</h3>
            <p><strong>Beta:</strong> ${beta}</p>
            <p><strong>Current Price:</strong> ${currentPrice}</p>
            <p><strong>P/E Ratio:</strong> ${peRatio}</p>
            <p><strong>Market Cap:</strong> ${marketCap}</p>
            <h4>Full Risk Assessment:</h4>
            <pre>${riskAssessment}</pre>
        </div>
    `;
    document.getElementById('results').innerHTML = evaluationHTML;
}

async function evaluatePortfolio() {
    try {
        const investorName = sessionStorage.getItem('investorName');
        const response = await fetch(`${API_URL}/evaluate-portfolio/${investorName}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received portfolio data:', data);

        displayPortfolioEvaluation(data);
    } catch (error) {
        console.error('Portfolio evaluation error:', error);
        document.getElementById('results').innerHTML = `
            <div class="evaluation">
                <h3>Error Evaluating Portfolio</h3>
                <p>An error occurred while evaluating the portfolio: ${error.message}</p>
                <p>Please try again later or contact support if the problem persists.</p>
            </div>
        `;
    }
}

function displayPortfolioEvaluation(evaluation) {
    if (!evaluation || Object.keys(evaluation).length === 0) {
        document.getElementById('results').innerHTML = `
            <div class="evaluation">
                <h3>Portfolio Evaluation</h3>
                <p>No portfolio data available. You might not have any stocks in your portfolio yet.</p>
            </div>
        `;
        return;
    }

    const evaluationHTML = `
        <div class="evaluation">
            <h3>Portfolio Evaluation</h3>
            <p><strong>Total Value:</strong> ${evaluation.totalValue ? '$' + evaluation.totalValue.toFixed(2) : 'N/A'}</p>
            <p><strong>Overall Risk Level:</strong> ${evaluation.overallRiskLevel || 'N/A'}</p>
            <p><strong>Diversification Score:</strong> ${evaluation.diversificationScore ? evaluation.diversificationScore + '/10' : 'N/A'}</p>
            <p><strong>Top Performing Stock:</strong> ${evaluation.topPerformingStock || 'N/A'}</p>
            <p><strong>Worst Performing Stock:</strong> ${evaluation.worstPerformingStock || 'N/A'}</p>
            ${evaluation.recommendedActions && evaluation.recommendedActions.length > 0 ? `
                <p><strong>Recommended Actions:</strong></p>
                <ul>
                    ${evaluation.recommendedActions.map(action => `<li>${action}</li>`).join('')}
                </ul>
            ` : ''}
        </div>
    `;
    document.getElementById('results').innerHTML = evaluationHTML;
}

async function showComprehensiveRiskReport() {
    try {
        const investorName = sessionStorage.getItem('investorName');
        const response = await fetch(`${API_URL}/comprehensive-report/${investorName}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received report data:', data);

        if (data && data.report) {
            document.getElementById('results').innerHTML = `
                <div class="evaluation">
                    <h3>Comprehensive Risk Report</h3>
                    <pre>${data.report}</pre>
                </div>
            `;
        } else {
            throw new Error('No report data available');
        }
    } catch (error) {
        console.error('Comprehensive report error:', error);
        document.getElementById('results').innerHTML = `
            <div class="evaluation">
                <h3>Error Generating Comprehensive Risk Report</h3>
                <p>An error occurred while generating the report: ${error.message}</p>
                <p>Please try again later or contact support if the problem persists.</p>
            </div>
        `;
    }
}