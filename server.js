// PING PONG PERFECTO - Servidor
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuración del juego
const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 10;
const BALL_SPEED = 5;
const PADDLE_SPEED = 6;
const TICK_RATE = 60; // 60 FPS

// Estado del juego
const gameState = {
  players: {
    left: {
      x: 20,
      y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      targetY: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      connected: false
    },
    right: {
      x: GAME_WIDTH - 20 - PADDLE_WIDTH,
      y: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      targetY: GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      connected: false
    }
  },
  ball: {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    vx: BALL_SPEED,
    vy: 0
  },
  score: {
    left: 0,
    right: 0
  },
  gameRunning: true
};

const clients = new Map();

// Asignar rol al jugador
function assignRole() {
  if (!gameState.players.left.connected) return 'left';
  if (!gameState.players.right.connected) return 'right';
  return 'spectator';
}

// Resetear pelota
function resetBall() {
  gameState.ball.x = GAME_WIDTH / 2;
  gameState.ball.y = GAME_HEIGHT / 2;
  gameState.ball.vx = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
  gameState.ball.vy = (Math.random() - 0.5) * BALL_SPEED;
}

// Actualizar física del juego
function updateGame() {
  if (!gameState.gameRunning) return;

  // Mover paletas suavemente
  for (const side of ['left', 'right']) {
    const player = gameState.players[side];
    const diff = player.targetY - player.y;
    player.y += diff * 0.3; // Interpolación suave
    
    // Limitar dentro de la pantalla
    player.y = Math.max(0, Math.min(GAME_HEIGHT - PADDLE_HEIGHT, player.y));
  }

  // Mover pelota
  gameState.ball.x += gameState.ball.vx;
  gameState.ball.y += gameState.ball.vy;

  // Rebote en bordes superior e inferior
  if (gameState.ball.y <= 0 || gameState.ball.y >= GAME_HEIGHT - BALL_SIZE) {
    gameState.ball.vy = -gameState.ball.vy;
    gameState.ball.y = Math.max(0, Math.min(GAME_HEIGHT - BALL_SIZE, gameState.ball.y));
  }

  // Colisión con paleta izquierda
  const leftPaddle = gameState.players.left;
  if (gameState.ball.x <= leftPaddle.x + PADDLE_WIDTH &&
      gameState.ball.x >= leftPaddle.x &&
      gameState.ball.y + BALL_SIZE >= leftPaddle.y &&
      gameState.ball.y <= leftPaddle.y + PADDLE_HEIGHT &&
      gameState.ball.vx < 0) {
    
    // Calcular ángulo de rebote basado en dónde golpea la paleta
    const hitPos = (gameState.ball.y - leftPaddle.y) / PADDLE_HEIGHT;
    const angle = (hitPos - 0.5) * Math.PI / 3; // -30° a +30°
    
    const speed = Math.sqrt(gameState.ball.vx * gameState.ball.vx + gameState.ball.vy * gameState.ball.vy);
    gameState.ball.vx = Math.abs(speed * Math.cos(angle));
    gameState.ball.vy = speed * Math.sin(angle);
    
    // Asegurar que la pelota no se quede pegada
    gameState.ball.x = leftPaddle.x + PADDLE_WIDTH + 1;
  }

  // Colisión con paleta derecha
  const rightPaddle = gameState.players.right;
  if (gameState.ball.x + BALL_SIZE >= rightPaddle.x &&
      gameState.ball.x + BALL_SIZE <= rightPaddle.x + PADDLE_WIDTH &&
      gameState.ball.y + BALL_SIZE >= rightPaddle.y &&
      gameState.ball.y <= rightPaddle.y + PADDLE_HEIGHT &&
      gameState.ball.vx > 0) {
    
    // Calcular ángulo de rebote basado en dónde golpea la paleta
    const hitPos = (gameState.ball.y - rightPaddle.y) / PADDLE_HEIGHT;
    const angle = (hitPos - 0.5) * Math.PI / 3; // -30° a +30°
    
    const speed = Math.sqrt(gameState.ball.vx * gameState.ball.vx + gameState.ball.vy * gameState.ball.vy);
    gameState.ball.vx = -Math.abs(speed * Math.cos(angle));
    gameState.ball.vy = speed * Math.sin(angle);
    
    // Asegurar que la pelota no se quede pegada
    gameState.ball.x = rightPaddle.x - BALL_SIZE - 1;
  }

  // Puntos
  if (gameState.ball.x < 0) {
    gameState.score.right++;
    console.log(`Punto para derecha! Score: ${gameState.score.left}-${gameState.score.right}`);
    resetBall();
  } else if (gameState.ball.x > GAME_WIDTH) {
    gameState.score.left++;
    console.log(`Punto para izquierda! Score: ${gameState.score.left}-${gameState.score.right}`);
    resetBall();
  }

  // Limitar velocidad máxima
  const speed = Math.sqrt(gameState.ball.vx * gameState.ball.vx + gameState.ball.vy * gameState.ball.vy);
  const maxSpeed = BALL_SPEED * 2;
  if (speed > maxSpeed) {
    gameState.ball.vx = (gameState.ball.vx / speed) * maxSpeed;
    gameState.ball.vy = (gameState.ball.vy / speed) * maxSpeed;
  }
}

// Enviar estado a todos los clientes
function broadcastState() {
  const message = JSON.stringify({
    type: 'gameState',
    state: gameState
  });
  
  clients.forEach((role, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// WebSocket connections
wss.on('connection', (ws) => {
  const role = assignRole();
  clients.set(ws, role);
  
  if (role !== 'spectator') {
    gameState.players[role].connected = true;
  }

  console.log(`Jugador conectado como: ${role}`);

  // Enviar asignación de rol
  ws.send(JSON.stringify({
    type: 'roleAssignment',
    role: role
  }));

  // Enviar estado inicial
  ws.send(JSON.stringify({
    type: 'gameState',
    state: gameState
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'paddleMove' && role !== 'spectator') {
        // Convertir coordenada Y del mouse a posición de paleta
        const targetY = (message.y + 1) * (GAME_HEIGHT / 2);
        gameState.players[role].targetY = Math.max(0, Math.min(GAME_HEIGHT - PADDLE_HEIGHT, targetY));
      }
      
      if (message.type === 'restart') {
        resetBall();
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  });

  ws.on('close', () => {
    console.log(`Jugador desconectado: ${role}`);
    
    if (role !== 'spectator') {
      gameState.players[role].connected = false;
      gameState.players[role].y = GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2;
      gameState.players[role].targetY = GAME_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    }
    
    clients.delete(ws);
  });
});

// Bucle principal del juego
setInterval(() => {
  updateGame();
  broadcastState();
}, 1000 / TICK_RATE);

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('🏓 PING PONG PERFECTO 🏓');
  console.log(`Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  console.log('Esperando jugadores...');
});

// Manejo de errores
process.on('uncaughtException', (err) => {
  console.error('Error no manejado:', err);
});
