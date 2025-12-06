export async function onRequestGet(context) {
    const { params, env } = context;
    const gameType = params.game_type;

    try {
        if (!['overall', 'sleigh', 'catch'].includes(gameType)) {
            return new Response(JSON.stringify({ error: 'Invalid game type' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

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
    } catch (error) {
        console.error('Fetch error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
