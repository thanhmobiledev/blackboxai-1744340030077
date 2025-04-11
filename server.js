const express = require('express');
const app = express();
const path = require('path');
const fetch = require('node-fetch');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// In-memory database
const linkDatabase = {};

// Generate a random tracking code
function generateTrackingCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Simulate geolocation lookup
async function getLocationFromIP(ip) {
    try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        const data = await response.json();
        return {
            city: data.city,
            region: data.region,
            country: data.country_name,
            latitude: data.latitude,
            longitude: data.longitude
        };
    } catch (error) {
        console.error('Error getting location:', error);
        return {
            city: 'Unknown',
            region: 'Unknown',
            country: 'Unknown',
            latitude: null,
            longitude: null
        };
    }
}

// Create new tracking link
app.post('/api/create-link', (req, res) => {
    try {
        const { url } = req.body;
        
        // Validate URL
        try {
            new URL(url);
        } catch (err) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Generate unique tracking code
        let trackingCode;
        do {
            trackingCode = generateTrackingCode();
        } while (linkDatabase[trackingCode]);

        // Store in database
        linkDatabase[trackingCode] = {
            destinationUrl: url,
            created: new Date().toISOString(),
            clicks: []
        };

        res.json({
            trackingCode,
            trackingUrl: `${req.protocol}://${req.get('host')}/t/${trackingCode}`,
            destinationUrl: url
        });
    } catch (error) {
        console.error('Error creating link:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Handle redirect and tracking
app.get('/t/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const link = linkDatabase[code];

        if (!link) {
            return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
        }

        // Get IP address
        const ip = req.ip || req.connection.remoteAddress;
        
        // Get location data
        const location = await getLocationFromIP(ip);

        // Log click
        link.clicks.push({
            timestamp: new Date().toISOString(),
            ip: ip,
            userAgent: req.get('User-Agent'),
            location
        });

        // Redirect to destination
        res.redirect(link.destinationUrl);
    } catch (error) {
        console.error('Error handling redirect:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get link statistics
app.get('/api/link-stats', (req, res) => {
    try {
        const stats = Object.entries(linkDatabase).map(([code, data]) => ({
            trackingCode: code,
            trackingUrl: `${req.protocol}://${req.get('host')}/t/${code}`,
            destinationUrl: data.destinationUrl,
            created: data.created,
            totalClicks: data.clicks.length,
            clicks: data.clicks
        }));

        // Sort by creation date (newest first)
        stats.sort((a, b) => new Date(b.created) - new Date(a.created));

        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get click details for a specific link
app.get('/api/link-stats/:code', (req, res) => {
    try {
        const { code } = req.params;
        const link = linkDatabase[code];

        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }

        res.json({
            trackingCode: code,
            trackingUrl: `${req.protocol}://${req.get('host')}/t/${code}`,
            destinationUrl: link.destinationUrl,
            created: link.created,
            totalClicks: link.clicks.length,
            clicks: link.clicks
        });
    } catch (error) {
        console.error('Error getting link details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
