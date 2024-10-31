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

document.addEventListener('DOMContentLoaded', function() {
    const investorNameInput = document.getElementById('investorName');
    if (investorNameInput) {
        investorNameInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
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
                </div>
                <table class="portfolio-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Company</th>
                            <th>Shares</th>
                            <th>Price</th>
                            <th>Total Value</th>
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