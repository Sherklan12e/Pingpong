// PING PONG PERFECTO - Cliente
class PingPongGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.role = 'spectator';
        this.gameState = null;
        this.ws = null;
        this.mouseY = 0;
        
        this.setupCanvas();
        this.setupWebSocket();
        this.setupEventListeners();
        this.setupUI();
        
        this.gameLoop();
    }
    
    setupCanvas() {
        // Configurar canvas para alta resolución
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Configurar renderizado suave
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }
    
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}`);
        
        this.ws.onopen = () => {
            console.log('Conectado al servidor');
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            
            if (message.type === 'roleAssignment') {
                this.role = message.role;
                this.updatePlayerInfo();
            } else if (message.type === 'gameState') {
                this.gameState = message.state;
            }
        };
        
        this.ws.onclose = () => {
            console.log('Desconectado del servidor');
            setTimeout(() => this.setupWebSocket(), 1000);
        };
        
        this.ws.onerror = (error) => {
            console.error('Error de WebSocket:', error);
        };
    }
    
    setupEventListeners() {
        // Control del ratón
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1; // -1 a 1
            
            if (this.role !== 'spectator' && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'paddleMove',
                    y: this.mouseY
                }));
            }
        });
        
        // Botón de reinicio
        document.getElementById('restartBtn').addEventListener('click', () => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'restart' }));
            }
        });
        
        // Redimensionar ventana
        window.addEventListener('resize', () => {
            this.setupCanvas();
        });
    }
    
    setupUI() {
        this.updatePlayerInfo();
    }
    
    updatePlayerInfo() {
        const playerInfo = document.getElementById('playerInfo');
        const restartBtn = document.getElementById('restartBtn');
        
        switch (this.role) {
            case 'left':
                playerInfo.textContent = 'JUGADOR IZQUIERDA';
                playerInfo.style.color = '#2196F3';
                restartBtn.style.display = 'block';
                break;
            case 'right':
                playerInfo.textContent = 'JUGADOR DERECHA';
                playerInfo.style.color = '#F44336';
                restartBtn.style.display = 'block';
                break;
            default:
                playerInfo.textContent = 'ESPECTADOR';
                playerInfo.style.color = '#FFD700';
                restartBtn.style.display = 'none';
        }
    }
    
    draw() {
        if (!this.gameState) return;
        
        // Limpiar canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Dibujar línea central
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Dibujar paleta izquierda
        this.ctx.fillStyle = '#2196F3';
        this.ctx.fillRect(
            this.gameState.players.left.x,
            this.gameState.players.left.y,
            15,
            80
        );
        
        // Dibujar paleta derecha
        this.ctx.fillStyle = '#F44336';
        this.ctx.fillRect(
            this.gameState.players.right.x,
            this.gameState.players.right.y,
            15,
            80
        );
        
        // Dibujar pelota
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(
            this.gameState.ball.x + 5,
            this.gameState.ball.y + 5,
            5,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
        
        // Actualizar puntuación
        document.getElementById('score').textContent = 
            `${this.gameState.score.left} - ${this.gameState.score.right}`;
    }
    
    gameLoop() {
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Inicializar juego cuando la página cargue
document.addEventListener('DOMContentLoaded', () => {
    new PingPongGame();
});
