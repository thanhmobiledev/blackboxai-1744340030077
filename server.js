const express = require('express');
const app = express();
const path = require('path');
const fetch = require('node-fetch');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// In-memory database with test data
const linkDatabase = {
    '5StvQ0': {
        destinationUrl: 'https://www.example.com',
        created: new Date().toISOString(),
        clicks: [
            {
                timestamp: new Date().toISOString(),
                ip: '127.0.0.1',
                userAgent: 'Test Browser',
                location: {
                    city: 'Test City',
                    region: 'Test Region',
                    country: 'Test Country'
                }
            }
        ]
    }
};

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
        // For testing purposes, if it's localhost return test data
        if (ip === '127.0.0.1' || ip === '::1') {
            return {
                city: 'San Francisco',
                region: 'California',
                country: 'United States',
                latitude: 37.7749,
                longitude: -122.4194
            };
        }

        // Using ip-api.com which has better rate limits and reliability
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon`);
        const data = await response.json();
        
        if (data.status === 'fail') {
            throw new Error(data.message || 'Failed to get location data');
        }

        return {
            city: data.city || 'Unknown',
            region: data.regionName || 'Unknown',
            country: data.country || 'Unknown',
            latitude: data.lat || 0,
            longitude: data.lon || 0
        };
    } catch (error) {
        console.error('Error getting location:', error);
        throw error; // Let the caller handle the error
    }
}

// Retry mechanism for location lookup
async function getLocationWithRetry(ip, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await getLocationFromIP(ip);
        } catch (error) {
            if (i === maxRetries - 1) {
                console.error(`Failed to get location after ${maxRetries} attempts`);
                return {
                    city: 'Unknown',
                    region: 'Unknown',
                    country: 'Unknown',
                    latitude: 0,
                    longitude: 0
                };
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
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

        // Get IP address with proper forwarding handling
        const ip = req.headers['x-forwarded-for'] || 
                  req.headers['x-real-ip'] || 
                  req.connection.remoteAddress || 
                  req.socket.remoteAddress || 
                  '127.0.0.1';
                  
        // Clean the IP address (remove IPv6 prefix if present)
        const cleanIP = ip.includes('::ffff:') ? ip.split('::ffff:')[1] : ip;
        console.log('Detected IP:', cleanIP);
        
        // Get location data with retry mechanism
        const location = await getLocationWithRetry(cleanIP);

        // Log click with cleaned IP
        link.clicks.push({
            timestamp: new Date().toISOString(),
            ip: cleanIP === '::1' ? '127.0.0.1' : cleanIP, // Convert IPv6 localhost to IPv4
            userAgent: req.get('User-Agent'),
            location: {
                ...location,
                // Ensure we have location data even for localhost
                city: location.city || 'San Francisco',
                region: location.region || 'California',
                country: location.country || 'United States'
            }
        });
        
        console.log('Logged click:', {
            ip: cleanIP,
            location: location
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

// Update destination URL for a link
app.patch('/api/links/:code', (req, res) => {
    try {
        const { code } = req.params;
        const { destinationUrl } = req.body;
        
        // Check if link exists
        if (!linkDatabase[code]) {
            return res.status(404).json({ error: 'Link not found' });
        }

        // Validate new URL
        try {
            new URL(destinationUrl);
        } catch (err) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Update destination URL
        linkDatabase[code].destinationUrl = destinationUrl;

        res.json({
            trackingCode: code,
            destinationUrl: destinationUrl
        });
    } catch (error) {
        console.error('Error updating link:', error);
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
