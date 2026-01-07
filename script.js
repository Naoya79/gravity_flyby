class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    mult(n) { return new Vector2(this.x * n, this.y * n); }
    div(n) { return new Vector2(this.x / n, this.y / n); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        const m = this.mag();
        return m === 0 ? new Vector2(0, 0) : new Vector2(this.x / m, this.y / m);
    }
    static dist(v1, v2) { return v1.sub(v2).mag(); }
    copy() { return new Vector2(this.x, this.y); }
}

const GAME_STATE = {
    IDLE: 'IDLE',       // Creating trajectory
    FLYING: 'FLYING',   // Physics active
    ENDED: 'ENDED'      // Win/Loss
};

class Ship {
    constructor(x, y) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2(0, 0);
        this.acc = new Vector2(0, 0);
        this.radius = 8;
        this.color = '#ffffff';
        this.trail = [];
        this.maxTrailLength = 20;
    }

    applyForce(force) {
        this.acc = this.acc.add(force);
    }

    update(dt, planets) {
        this.acc = new Vector2(0, 0); // Reset acceleration

        // Gravity Physics
        for (let planet of planets) {
            let dir = planet.pos.sub(this.pos);
            let d = dir.mag();
            let epsilon = 5.0; // Prevent division by zero

            // F = G / (d + e)  -- Simplified as per specs
            // Assuming ship mass = 1
            if (d < planet.influenceRadius) {
                let strength = planet.gravity / (d + epsilon);
                let force = dir.normalize().mult(strength);
                this.applyForce(force);
            }
        }

        // Symplectic Euler Integration (better stability)
        this.vel = this.vel.add(this.acc.mult(dt));
        this.pos = this.pos.add(this.vel.mult(dt));

        // Trail effect
        if (GlobalGame.frameCount % 5 === 0) {
            this.trail.push(this.pos.copy());
            if (this.trail.length > this.maxTrailLength) this.trail.shift();
        }
    }

    draw(ctx) {
        // Draw Trail
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
        }

        // Draw Ship (Spaceship shape)
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        // Rotate towards direction of movement
        let angle = 0;
        if (this.vel.mag() > 0.1) {
            angle = Math.atan2(this.vel.y, this.vel.x);
        }
        ctx.rotate(angle);

        ctx.beginPath();
        const r = this.radius;
        // Triangle pointing right (0 rad)
        ctx.moveTo(r + 2, 0);
        ctx.lineTo(-r, r - 2);
        ctx.lineTo(-r + 3, 0); // Engine notch
        ctx.lineTo(-r, -r + 2);
        ctx.closePath();

        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'white';
        ctx.fill();
        ctx.restore();
    }
}

class Planet {
    constructor(x, y, radius, gravity, influenceRadius) {
        this.pos = new Vector2(x, y);
        this.radius = radius;
        this.gravity = gravity;
        this.influenceRadius = influenceRadius;
        this.color = '#4cc9f0'; // Cyber blue
    }

    draw(ctx) {
        // Draw influence area (faint)
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.influenceRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(76, 201, 240, 0.1)';
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw gravity well gradient
        let gradient = ctx.createRadialGradient(this.pos.x, this.pos.y, this.radius, this.pos.x, this.pos.y, this.influenceRadius * 0.5);
        gradient.addColorStop(0, 'rgba(76, 201, 240, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.influenceRadius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw Planet Body
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.stroke(); // Stroke to emphasize edge
        ctx.shadowBlur = 0;
    }
}

class Goal {
    constructor(x, y, radius) {
        this.pos = new Vector2(x, y);
        this.radius = radius;
        this.pulse = 0;
    }

    draw(ctx) {
        this.pulse += 0.05;
        const glowRadius = this.radius + Math.sin(this.pulse) * 5;

        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#fca311'; // Orange
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, glowRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(252, 163, 17, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(252, 163, 17, 0.1)';
        ctx.fill();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.uiStage = document.getElementById('stage-number');
        this.uiMessages = document.getElementById('messages');
        this.retryBtn = document.getElementById('retry-btn');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.currentLevel = 1;
        this.retryBtn.addEventListener('click', () => {
            // Logic handled inside gameWin for Next Level, otherwise here is reset
            if (this.state !== GAME_STATE.ENDED || this.uiMessages.innerText !== "COURSE CLEAR!") {
                this.initLevel(this.currentLevel);
            }
        });

        // Input Handling
        this.isDragging = false;
        this.dragStart = null;
        this.dragCurrent = null;

        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));

        // Game Entities
        this.ship = null;
        this.planets = [];
        this.goal = null;
        this.state = GAME_STATE.IDLE;

        // Levels Config
        this.levels = {
            1: (w, h) => ({
                ship: new Vector2(100, h - 100),
                goal: { pos: new Vector2(w - 100, 100), r: 30 },
                planets: [
                    new Planet(w / 2, h / 2, 40, 5000, 300)
                ]
            }),
            2: (w, h) => ({
                ship: new Vector2(100, h / 2),
                goal: { pos: new Vector2(w - 100, h / 2), r: 30 },
                planets: [
                    new Planet(w / 3, h / 2 - 150, 35, 4000, 250),
                    new Planet(2 * w / 3, h / 2 + 150, 35, 4000, 250)
                ]
            }),
            3: (w, h) => ({
                ship: new Vector2(100, h / 2),
                goal: { pos: new Vector2(w - 100, h / 2), r: 25 },
                planets: [
                    new Planet(w / 2, h / 2, 60, 8000, 400), // Big strong one
                    new Planet(w - 200, h / 2 - 150, 20, 2000, 150), // Trap
                    new Planet(w - 200, h / 2 + 150, 20, 2000, 150)  // Trap
                ]
            })
        };

        this.initLevel(this.currentLevel);

        this.lastTime = 0;
        this.frameCount = 0;
        window.GlobalGame = this;

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // Coordinate conversion
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    }

    initLevel(levelNum) {
        if (!this.levels[levelNum]) {
            levelNum = 1; // Loop back or finish
            this.currentLevel = 1;
        }

        const config = this.levels[levelNum](this.canvas.width, this.canvas.height);

        this.state = GAME_STATE.IDLE;
        this.uiMessages.classList.add('hidden');
        this.uiStage.innerText = levelNum;
        this.retryBtn.innerText = "RETRY";

        // Reset button listener behavior
        this.retryBtn.onclick = () => {
            this.initLevel(this.currentLevel);
        };

        this.ship = new Ship(config.ship.x, config.ship.y);
        this.planets = config.planets;
        this.goal = new Goal(config.goal.pos.x, config.goal.pos.y, config.goal.r);
    }

    onMouseDown(e) {
        if (this.state !== GAME_STATE.IDLE) return;
        const pos = this.getMousePos(e);
        // Drag anywhere behavior
        this.isDragging = true;
        this.dragStart = pos;
        this.dragCurrent = pos;
    }

    onMouseMove(e) {
        if (!this.isDragging) return;
        this.dragCurrent = this.getMousePos(e);
    }

    onMouseUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;

        const dragVector = this.dragStart.sub(this.dragCurrent);
        const power = 3.0; // Multiplier
        let launchVel = dragVector.mult(0.1 * power); // scaling

        this.ship.vel = launchVel;
        this.state = GAME_STATE.FLYING;
    }

    update(dt) {
        this.frameCount++;
        if (this.state === GAME_STATE.FLYING) {
            // Slow motion for better observation (20 instead of 60)
            this.ship.update(dt * 20, this.planets);

            // Collision Detection
            this.checkCollisions();
        }
    }

    checkCollisions() {
        // Goal
        if (Vector2.dist(this.ship.pos, this.goal.pos) < this.goal.radius + this.ship.radius) {
            this.gameWin();
        }

        // Planets
        for (let p of this.planets) {
            if (Vector2.dist(this.ship.pos, p.pos) < p.radius + this.ship.radius) {
                this.gameLoss("CRASHED!");
            }
        }

        // Out of bounds
        const m = 0; // Margin
        if (this.ship.pos.x < -m || this.ship.pos.x > this.canvas.width + m ||
            this.ship.pos.y < -m || this.ship.pos.y > this.canvas.height + m) {
            this.gameLoss("LOST IN SPACE");
        }
    }

    gameWin() {
        this.state = GAME_STATE.ENDED;
        this.uiMessages.innerText = "COURSE CLEAR!";
        this.uiMessages.style.color = "#4cc9f0";
        this.uiMessages.classList.remove('hidden');

        this.retryBtn.innerText = "NEXT LEVEL";
        this.retryBtn.onclick = () => {
            this.currentLevel++;
            this.initLevel(this.currentLevel);
        };
    }

    gameLoss(msg) {
        this.state = GAME_STATE.ENDED;
        this.uiMessages.innerText = msg;
        this.uiMessages.style.color = "#ef233c";
        this.uiMessages.classList.remove('hidden');
    }

    draw() {
        // Background update handled by CSS, but we clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Predict Line (Trajectory) if Dragging
        if (this.state === GAME_STATE.IDLE && this.isDragging) {
            this.drawTrajectory();
        }

        // Draw Entities
        this.goal.draw(this.ctx);
        for (let p of this.planets) p.draw(this.ctx);
        this.ship.draw(this.ctx);
    }

    drawTrajectory() {
        // Slingshot vector
        const dragVector = this.dragStart.sub(this.dragCurrent);
        const power = 3.0;
        const launchVel = dragVector.mult(0.1 * power);

        let simPos = this.ship.pos.copy();
        let simVel = launchVel.copy();
        let simAcc = new Vector2(0, 0);

        this.ctx.beginPath();
        this.ctx.moveTo(simPos.x, simPos.y);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.setLineDash([5, 5]);

        const steps = 100; // How far to predict
        const simDt = 1; // 1 frame per step equivalent

        for (let i = 0; i < steps; i++) {
            simAcc = new Vector2(0, 0);
            for (let planet of this.planets) {
                let dir = planet.pos.sub(simPos);
                let d = dir.mag();
                let epsilon = 5.0;
                if (d < planet.influenceRadius) {
                    let strength = planet.gravity / (d + epsilon);
                    let force = dir.normalize().mult(strength);
                    simAcc = simAcc.add(force);
                }
            }
            simVel = simVel.add(simAcc.mult(simDt));
            simPos = simPos.add(simVel.mult(simDt));

            this.ctx.lineTo(simPos.x, simPos.y);

            // Check collision in future (optional visual cue)
            for (let p of this.planets) {
                if (Vector2.dist(simPos, p.pos) < p.radius) break;
            }
        }
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw Drag Line
        this.ctx.beginPath();
        this.ctx.moveTo(this.ship.pos.x, this.ship.pos.y);
        this.ctx.lineTo(this.ship.pos.x - dragVector.x, this.ship.pos.y - dragVector.y);
        this.ctx.strokeStyle = '#fca311';
        this.ctx.stroke();
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame(this.loop);
    }
}

window.onload = () => {
    new Game();
};
