export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS headers helper
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // API Routes
        if (path === '/admin-rh') {
            // We can't easily serve a specific file from ASSETS in a single-file worker without KV or similar if it's not the index.
            // However, since we are using `env.ASSETS`, we can just let the static asset handler take care of it if we request /admin.html
            // But to make /admin-rh work, we can rewrite the request or fetch admin.html explicitly.
            // Simpler approach: Redirect /admin-rh to /admin.html or just serve it.
            // Let's try to fetch /admin.html from assets.
            const newRequest = new Request(new URL('/admin.html', request.url), request);
            return env.ASSETS.fetch(newRequest);
        }

        if (path === '/api/leaderboard/submit' && request.method === 'POST') {
            try {
                const { name, wallet, score, user_id, game_type } = await request.json();

                if (!name || !score || !user_id || !game_type) {
                    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json', ...corsHeaders }
                    });
                }

                await env.DB.prepare(
                    'INSERT INTO leaderboard (name, wallet, score, user_id, game_type, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
                ).bind(
                    name.substring(0, 12),
                    wallet || '',
                    parseInt(score),
                    user_id,
                    game_type,
                    Date.now()
                ).run();

                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            } catch (e) {
                console.error('Submit error:', e);
                return new Response(JSON.stringify({ error: e.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        // ADMIN API Routes
        if (path.startsWith('/api/admin/')) {
            // Auth Check
            const password = request.headers.get('x-admin-password');
            if (password !== 'santa2025') {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            // 1. Stats Endpoint
            if (path === '/api/admin/stats') {
                try {
                    const totalGames = await env.DB.prepare('SELECT COUNT(*) as count FROM leaderboard').first('count');
                    const uniqueUsers = await env.DB.prepare('SELECT COUNT(DISTINCT user_id) as count FROM leaderboard').first('count');
                    const topSleigh = await env.DB.prepare('SELECT MAX(score) as max FROM leaderboard WHERE game_type = "sleigh"').first('max');
                    const topCatch = await env.DB.prepare('SELECT MAX(score) as max FROM leaderboard WHERE game_type = "catch"').first('max');

                    return new Response(JSON.stringify({
                        total_games: totalGames,
                        unique_users: uniqueUsers,
                        top_sleigh: topSleigh || 0,
                        top_catch: topCatch || 0
                    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
                } catch (e) {
                    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
                }
            }

            // 2. Full Leaderboard Endpoint (with wallets)
            if (path === '/api/admin/leaderboard') {
                try {
                    const { results } = await env.DB.prepare(
                        'SELECT * FROM leaderboard ORDER BY score DESC LIMIT 100'
                    ).all();
                    return new Response(JSON.stringify(results), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
                } catch (e) {
                    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
                }
            }

            // 3. User History Endpoint
            if (path.startsWith('/api/admin/user/')) {
                const userId = path.split('/').pop();
                try {
                    const { results } = await env.DB.prepare(
                        'SELECT * FROM leaderboard WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50'
                    ).bind(userId).all();
                    return new Response(JSON.stringify(results), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
                } catch (e) {
                    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
                }
            }
        }

        if (path.startsWith('/api/leaderboard/') && request.method === 'GET') {
            const gameType = path.split('/').pop();

            if (!['overall', 'sleigh', 'catch'].includes(gameType)) {
                return new Response(JSON.stringify({ error: 'Invalid game type' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            try {
                const { results } = await env.DB.prepare(
                    'SELECT name, wallet, score, timestamp FROM leaderboard WHERE game_type = ? ORDER BY score DESC LIMIT 50'
                ).bind(gameType).all();

                return new Response(JSON.stringify(results || []), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=30'
                    }
                });
            } catch (e) {
                console.error('Fetch error:', e);
                return new Response(JSON.stringify({ error: e.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        // Serve static assets
        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }

        return new Response('Not Found', { status: 404 });
    }
}
