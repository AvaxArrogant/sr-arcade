#!/bin/bash

# Saint Richards Arcade - Cloudflare D1 Setup Script
# Run this in your project directory

echo "🎮 Setting up Saint Richards Arcade with Cloudflare D1..."

# Create directory structure
mkdir -p functions/api/leaderboard

# Create submit.js
cat > functions/api/leaderboard/submit.js << 'EOF'
export async function onRequestPost(context) {
  const { request, env } = context;
  
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }
  
  try {
    const { name, wallet, score, user_id, game_type } = await request.json();
    
    if (!name || !score || !user_id || !game_type) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Submit error:', error);
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
EOF

# Create [game_type].js
cat > 'functions/api/leaderboard/[game_type].js' << 'EOF'
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
EOF

echo "✅ API functions created"
echo "📁 Structure:"
echo "   functions/"
echo "   └── api/"
echo "       └── leaderboard/"
echo "           ├── submit.js"
echo "           └── [game_type].js"
echo ""
echo "🔥 Next steps:"
echo "1. Replace your index.html with the updated version (see below)"
echo "2. git add functions/"
echo "3. git commit -m 'Add D1 leaderboard integration'"
echo "4. git push"
echo ""
echo "🎮 Your D1 database 'arcade-leaderboard' is already bound as 'DB'"
echo "✨ Done! Your leaderboard will be live after deployment."
EOF

