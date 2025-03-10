const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth * 0.65; // 65% of the screen width
canvas.height = window.innerHeight * 0.8; // 80% of the screen height

let whiteBloodCells = [];
let bacteria = [];
let deadBacteriaCount = 0;
let lastGrowthTime = Date.now();
const MAX_BACTERIA = 5000;

// Default configurable parameters
const defaultConfig = {
  wbcSpeed: 3,
  bacteriaSpeed: 2.5,
  bacteriaGrowthRate: 3000,
  cytokineEvaporationRate: 0.1, // Renamed from pheromoneEvaporationRate
  bacteriaCount: 200,
  wbcCount: 5,
};

let config = { ...defaultConfig };

// Update config from controls and restart simulation
document.getElementById("updateButton").addEventListener("click", () => {
  config.wbcSpeed = parseFloat(document.getElementById("wbcSpeed").value);
  config.bacteriaSpeed = parseFloat(document.getElementById("bacteriaSpeed").value);
  config.bacteriaGrowthRate = parseFloat(document.getElementById("bacteriaGrowthRate").value);
  config.cytokineEvaporationRate = parseFloat(document.getElementById("cytokineEvaporationRate").value);
  config.bacteriaCount = parseFloat(document.getElementById("bacteriaCount").value);
  config.wbcCount = parseFloat(document.getElementById("wbcCount").value);
  aco.evaporationRate = config.cytokineEvaporationRate; // Update ACO's evaporation rate

  // Restart simulation
  whiteBloodCells = [];
  bacteria = [];
  deadBacteriaCount = 0;
  spawnEntities(whiteBloodCells, WBC, config.wbcCount);
  spawnEntities(bacteria, Bacteria, config.bacteriaCount);
});

// Reset to default parameters
document.getElementById("resetButton").addEventListener("click", () => {
  // Reset config to default
  config = { ...defaultConfig };

  // Update input fields
  document.getElementById("wbcSpeed").value = config.wbcSpeed;
  document.getElementById("bacteriaSpeed").value = config.bacteriaSpeed;
  document.getElementById("bacteriaGrowthRate").value = config.bacteriaGrowthRate;
  document.getElementById("cytokineEvaporationRate").value = config.cytokineEvaporationRate;
  document.getElementById("bacteriaCount").value = config.bacteriaCount;
  document.getElementById("wbcCount").value = config.wbcCount;

  // Restart simulation
  whiteBloodCells = [];
  bacteria = [];
  deadBacteriaCount = 0;
  spawnEntities(whiteBloodCells, WBC, config.wbcCount);
  spawnEntities(bacteria, Bacteria, config.bacteriaCount);
});

class ACO {
  constructor() {
    this.cytokines = []; // Renamed from pheromones
    this.evaporationRate = config.cytokineEvaporationRate;
    this.depositAmount = 50;
    this.senseDistance = 70;
  }

  evaporate() {
    // Apply evaporation rate to all cytokines
    this.cytokines.forEach(c => {
      c.strength *= (1 - this.evaporationRate); // Decay strength
    });

    // Remove cytokines with very low strength
    this.cytokines = this.cytokines.filter(c => c.strength > 1);
  }

  deposit(x, y, type) {
    let existing = this.cytokines.find(c =>
      c.type === type && Math.hypot(c.x - x, c.y - y) < 10
    );
    if (existing) {
      existing.strength += this.depositAmount;
    } else {
      this.cytokines.push({
        x, y,
        strength: this.depositAmount,
        type,
        color: type === 'wbc' ? 'rgba(255,255,255,0.3)' : 'rgba(0,255,0,0.3)'
      });
    }
  }

  getDirection(x, y, type) {
    let maxStrength = 0;
    let target = null;

    this.cytokines.forEach(c => {
      if (c.type === type && c.strength > maxStrength) {
        maxStrength = c.strength;
        target = c;
      }
    });

    if (target) {
      const dx = target.x - x;
      const dy = target.y - y;
      const dist = Math.hypot(dx, dy);
      return { dx: dx / dist, dy: dy / dist };
    }
    return null;
  }
}

const aco = new ACO();

class WBC {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = config.wbcSpeed;
    this.range = 25;
    this.randomDirection = { dx: Math.random() * 2 - 1, dy: Math.random() * 2 - 1 };
    this.lastAteTime = 0;
  }

  move() {
    const targetBacteria = this.findNearestBacteria();
    const cytokineDir = aco.getDirection(this.x, this.y, 'wbc');

    let dx = 0, dy = 0;

    if (targetBacteria) {
      const angle = Math.atan2(targetBacteria.y - this.y, targetBacteria.x - this.x);
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      aco.deposit(this.x, this.y, 'wbc');
    } else {
      dx = this.randomDirection.dx;
      dy = this.randomDirection.dy;

      if (Math.random() < 0.2) {
        this.randomDirection = { dx: Math.random() * 2 - 1, dy: Math.random() * 2 - 1 };
      }
    }

    if (cytokineDir) {
      dx += cytokineDir.dx * 0.8;
      dy += cytokineDir.dy * 0.8;
    }

    whiteBloodCells.forEach(other => {
      if (other !== this) {
        const dist = Math.hypot(this.x - other.x, this.y - other.y);
        if (dist < 40) {
          dx += (this.x - other.x) * 0.05;
          dy += (this.y - other.y) * 0.05;
        }
      }
    });

    const length = Math.hypot(dx, dy) || 1;
    this.x += (dx / length) * this.speed;
    this.y += (dy / length) * this.speed;

    this.boundaryCheck();
  }

  checkCollision() {
    bacteria.forEach((b, i) => {
      if (Math.hypot(this.x - b.x, this.y - b.y) < this.range) {
        bacteria.splice(i, 1);
        deadBacteriaCount++;
        this.lastAteTime = Date.now();
      }
    });
  }

  boundaryCheck() {
    this.x = Math.max(20, Math.min(canvas.width - 20, this.x));
    this.y = Math.max(20, Math.min(canvas.height - 20, this.y));
  }

  findNearestBacteria() {
    let nearest = null;
    let minDist = Infinity;

    bacteria.forEach(b => {
      const dist = Math.hypot(this.x - b.x, this.y - b.y);
      if (dist < minDist && dist < 200) {
        minDist = dist;
        nearest = b;
      }
    });
    return nearest;
  }

  draw() {
    ctx.fillStyle = "white";
    ctx.beginPath();
    const numPoints = 50;
    const radius = 10;
    const irregularity = 0.9;

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const randomRadius = radius * (1 + (Math.random() - 0.5) * irregularity);
      const x = this.x + Math.cos(angle) * randomRadius;
      const y = this.y + Math.sin(angle) * randomRadius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.fill();
  }
}

class Bacteria {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = config.bacteriaSpeed;
    this.fleeDistance = 50; // Distance within which bacteria will flee from WBC
  }

  move() {
    const nearestWBC = this.findNearestWBC();

    let dx = 0, dy = 0;

    if (nearestWBC) {
      // Move away from the nearest WBC
      const angle = Math.atan2(this.y - nearestWBC.y, this.x - nearestWBC.x);
      dx = Math.cos(angle);
      dy = Math.sin(angle);
    } else {
      // If no WBC is nearby, move randomly
      const angle = Math.random() * Math.PI * 2;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
    }

    // Normalize the direction vector and move the bacteria
    const length = Math.hypot(dx, dy) || 1;
    this.x += (dx / length) * this.speed;
    this.y += (dy / length) * this.speed;

    // Ensure bacteria stay within the canvas boundaries
    this.boundaryCheck();
  }

  boundaryCheck() {
    this.x = Math.max(5, Math.min(canvas.width - 5, this.x));
    this.y = Math.max(5, Math.min(canvas.height - 5, this.y));
  }

  findNearestWBC() {
    let nearest = null;
    let minDist = Infinity;

    // Find the nearest WBC within the flee distance
    whiteBloodCells.forEach(w => {
      const dist = Math.hypot(this.x - w.x, this.y - w.y);
      if (dist < minDist && dist < this.fleeDistance) {
        minDist = dist;
        nearest = w;
      }
    });
    return nearest;
  }

  static grow() {
    // Grow new bacteria if the growth rate condition is met
    if (Date.now() - lastGrowthTime > config.bacteriaGrowthRate && bacteria.length < MAX_BACTERIA) {
      lastGrowthTime = Date.now();
      bacteria.forEach(b => {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 20 + 10; // Spawn within 10-30 pixels of existing bacteria
        const newX = b.x + Math.cos(angle) * distance;
        const newY = b.y + Math.sin(angle) * distance;
        const newBacteria = new Bacteria(newX, newY);
        bacteria.push(newBacteria);
      });
    }
  }

  draw() {
    // Draw the bacteria as a green circle
    ctx.fillStyle = "#00ff00";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function update() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw cytokines
  aco.cytokines.forEach(c => {
    const opacity = Math.min(0.5, c.strength / 100);
    const size = Math.min(10, c.strength / 50);
    ctx.fillStyle = `rgba(${c.type === 'wbc' ? '255,255,255' : '0,255,0'},${opacity})`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Update simulation
  Bacteria.grow();
  aco.evaporate();

  bacteria.forEach(b => {
    b.move();
    b.draw();
  });

  whiteBloodCells.forEach(wbc => {
    wbc.move();
    wbc.checkCollision();
    wbc.draw();
  });

  // Update counters
  document.getElementById("aliveCount").textContent = bacteria.length;
  document.getElementById("deadCount").textContent = deadBacteriaCount;

  requestAnimationFrame(update);
}

function spawnEntities(entityArray, EntityClass, count) {
  while (entityArray.length < count) {
    const newEntity = new EntityClass(Math.random() * canvas.width, Math.random() * canvas.height);
    entityArray.push(newEntity);
  }
}

// Initial spawn
spawnEntities(whiteBloodCells, WBC, config.wbcCount);
spawnEntities(bacteria, Bacteria, config.bacteriaCount);

update();

// Handle window resize
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth * 0.65;
  canvas.height = window.innerHeight * 0.8;
});