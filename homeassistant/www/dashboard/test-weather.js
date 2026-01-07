const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    // Collect console logs
    const logs = [];
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[Weather]') || text.includes('weather') || text.includes('Error')) {
            logs.push(msg.type() + ': ' + text);
        }
    });

    page.on('pageerror', err => {
        logs.push('PAGE ERROR: ' + err.message);
    });

    // Navigate to test page that loads the REAL view template
    const url = 'http://192.168.68.77:8123/local/dashboard/test-weather-real.html?v=' + Date.now();
    console.log('Navigating to:', url);
    await page.goto(url);
    await page.waitForTimeout(6000); // Wait for template load + data fetch

    // Take screenshot
    await page.screenshot({ path: '/tmp/weather-dashboard.png', fullPage: true });
    console.log('Screenshot saved to /tmp/weather-dashboard.png');

    // Print console logs
    console.log('\n=== Weather Console Logs ===');
    logs.forEach(log => console.log(log));

    // Check specific elements
    console.log('\n=== Element Values ===');

    const checks = [
        { id: 'hourlyScroll', name: 'Hourly Scroll' },
        { id: 'aqiValue', name: 'AQI Value' },
        { id: 'currentTemp', name: 'Current Temp' },
        { id: 'feelsLike', name: 'Feels Like' },
        { id: 'todayHigh', name: 'Today High' },
        { id: 'weeklyForecast', name: 'Weekly Forecast' },
        { id: 'humidityValue', name: 'Humidity' },
        { id: 'windValue', name: 'Wind' }
    ];

    for (const check of checks) {
        try {
            const content = await page.$eval('#' + check.id, el => el.innerHTML || el.textContent);
            const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
            console.log(check.name + ': ' + preview);
        } catch (e) {
            console.log(check.name + ': NOT FOUND');
        }
    }

    await browser.close();
})();
