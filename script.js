const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

let level = 1;
let subLevelSpeed = 1;
let timeElapsed = 0;
let slowdownCounter = 0;

let carImg = new Image();
carImg.src = "car.png";

let keys = {};
document.addEventListener("keydown", (e) => keys[e.key] = true);
document.addEventListener("keyup", (e) => keys[e.key] = false);

const ROAD_WIDTH = 240;
const ROAD_LEFT = (GAME_WIDTH - ROAD_WIDTH) / 2;
const ROAD_RIGHT = ROAD_LEFT + ROAD_WIDTH;
const ROAD_CENTER = ROAD_LEFT + ROAD_WIDTH / 2;

// Configuración de hitboxes
const HITBOX_SETTINGS = {
  player: { width: 29, height: 80, offsetX: 19, offsetY: 10 },
  truck: { width: 17, height: 100, offsetX: 30, offsetY: 15 },
  car: { width: 20, height: 60, offsetX: 23, offsetY: 16 },
  moto: { width: 10, height: 20, offsetX: 20, offsetY: 30 },
  plant: { width: 10, height: 10, offsetX: 10, offsetY: 10 }
};

let car = {
  x: ROAD_LEFT + ROAD_WIDTH / 2 - 35,
  y: GAME_HEIGHT - 140,
  width: 70,
  height: 100,
  get hitbox() {
    const s = HITBOX_SETTINGS.player;
    return {
      x: this.x + s.offsetX,
      y: this.y + s.offsetY,
      width: s.width,
      height: s.height
    };
  }
};

const obstacleImagePaths = [
  { src: "camion.png", type: "truck" },
  { src: "carro.png", type: "car" },
  { src: "carro2.png", type: "car" },
  { src: "moto.png", type: "moto" },
  { src: "moto2.png", type: "moto" },
];

let obstacleImgObjects = obstacleImagePaths.map(({ src, type }) => {
  const img = new Image();
  img.src = src;
  return { img, type, src };
});

let roadLines = [];
for (let y = 0; y < GAME_HEIGHT; y += 40) {
  roadLines.push({ x: ROAD_CENTER, y });
}

let obstacles = [];
let greenCubes = [];
let lastFrameTime = performance.now();
let collisionTime = null;
let gameRunning = true;

// Configuración de niveles
const LEVEL_SETTINGS = [
  { duration: 75, speedIncrement: 0.2, maxSpeed: 2.5, obstacleRate: 0.012, cubeRate: 0.006, roadColor: "#333" },
  { duration: 70, speedIncrement: 0.25, maxSpeed: 2.8, obstacleRate: 0.015, cubeRate: 0.008, roadColor: "#2a2a2a" },
  { duration: 65, speedIncrement: 0.3, maxSpeed: 3.2, obstacleRate: 0.018, cubeRate: 0.01, roadColor: "#252525" },
  { duration: 60, speedIncrement: 0.35, maxSpeed: 3.6, obstacleRate: 0.022, cubeRate: 0.012, roadColor: "#202020" },
  { duration: 55, speedIncrement: 0.4, maxSpeed: 4.0, obstacleRate: 0.026, cubeRate: 0.014, roadColor: "#1a1a1a" },
  { duration: 50, speedIncrement: 0.45, maxSpeed: 4.5, obstacleRate: 0.03, cubeRate: 0.016, roadColor: "#151515" },
  { duration: 45, speedIncrement: 0.5, maxSpeed: 5.0, obstacleRate: 0.035, cubeRate: 0.018, roadColor: "#101010" },
  { duration: 40, speedIncrement: 0.55, maxSpeed: 5.5, obstacleRate: 0.04, cubeRate: 0.02, roadColor: "#0a0a0a" },
  { duration: 35, speedIncrement: 0.6, maxSpeed: 6.0, obstacleRate: 0.045, cubeRate: 0.022, roadColor: "#050505" },
  { duration: 30, speedIncrement: 0.65, maxSpeed: 6.5, obstacleRate: 0.05, cubeRate: 0.025, roadColor: "#000000" }
];

function checkCollision(rect1, rect2) {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect1.x > rect2.x + rect2.width ||
    rect1.y + rect1.height < rect2.y ||
    rect1.y > rect2.y + rect2.height
  );
}

function getObstacleHitbox(obs) {
  const s = HITBOX_SETTINGS[obs.type] || HITBOX_SETTINGS.car;
  return {
    x: obs.x + s.offsetX,
    y: obs.y + s.offsetY,
    width: s.width,
    height: s.height
  };
}

function drawGreenCube(x, y, size) {
  ctx.fillStyle = "#00AA00";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "#005500";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);
}

function drawWatermark() {
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#AAAAAA";
  ctx.font = "italic 60px Arial";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 10;
  ctx.fillText("STARMORALES", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100);
  ctx.restore();
}

function drawLevelIndicator() {
  ctx.fillStyle = "#fff";
  ctx.font = "24px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Nivel ${level}/10`, 20, 30);
  
  // Barra de progreso del nivel
  const progressWidth = 200;
  const progress = timeElapsed / LEVEL_SETTINGS[level-1].duration;
  ctx.fillStyle = "#444";
  ctx.fillRect(20, 50, progressWidth, 10);
  ctx.fillStyle = "#0f0";
  ctx.fillRect(20, 50, progressWidth * progress, 10);
}

function gameLoop(timestamp) {
  let deltaTime = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;

  if (!gameRunning) {
    if (timestamp - collisionTime > 800) {
      resetGame();
      gameRunning = true;
    } else {
      return requestAnimationFrame(gameLoop);
    }
  }

  timeElapsed += deltaTime;
  slowdownCounter += deltaTime;

  const currentLevelSettings = LEVEL_SETTINGS[level-1];

  if (slowdownCounter > 15) {
    subLevelSpeed = Math.min(subLevelSpeed + currentLevelSettings.speedIncrement, currentLevelSettings.maxSpeed);
    slowdownCounter = 0;
  }

  if (timeElapsed > currentLevelSettings.duration) {
    if (level < 10) {
      level++;
      timeElapsed = 0;
      subLevelSpeed = 1 + (level * 0.15); // Velocidad base aumenta con cada nivel
      obstacles = [];
      greenCubes = [];
    } else {
      // Juego completado
      ctx.fillStyle = "#fff";
      ctx.font = "30px Arial";
      ctx.textAlign = "center";
      ctx.fillText("¡Felicidades! Has completado todos los niveles.", GAME_WIDTH / 2, GAME_HEIGHT / 2);
      ctx.font = "20px Arial";
      ctx.fillText("Presiona F5 para reiniciar.", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
      return;
    }
  }

  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Fondo y carretera
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  
  drawWatermark();
  
  ctx.fillStyle = currentLevelSettings.roadColor;
  ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, GAME_HEIGHT);

  // Líneas de carretera
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  roadLines.forEach(line => {
    line.y -= 2 * subLevelSpeed;
    if (line.y < -20) line.y = GAME_HEIGHT;
    ctx.beginPath();
    ctx.moveTo(ROAD_CENTER, line.y);
    ctx.lineTo(ROAD_CENTER, line.y + 20);
    ctx.stroke();
  });

  // Movimiento del jugador
  const moveSpeed = 6 + (level * 0.2); // Aumenta ligeramente la velocidad del jugador por nivel
  if (keys["ArrowLeft"] && car.x > ROAD_LEFT) car.x -= moveSpeed;
  if (keys["ArrowRight"] && car.x + car.width < ROAD_RIGHT) car.x += moveSpeed;
  if (keys["ArrowUp"] && car.y > 0) car.y -= moveSpeed;
  if (keys["ArrowDown"] && car.y + car.height < GAME_HEIGHT) car.y += moveSpeed;

  ctx.drawImage(carImg, car.x, car.y, car.width, car.height);

  // Generar obstáculos
  if (Math.random() < currentLevelSettings.obstacleRate * subLevelSpeed) {
    generateObstacle();
  }

  // Generar cubos verdes
  if (Math.random() < currentLevelSettings.cubeRate * subLevelSpeed) {
    generateGreenCube();
  }

  // Actualizar obstáculos
  updateObstacles();

  // Actualizar cubos verdes
  for (let i = greenCubes.length - 1; i >= 0; i--) {
    let cube = greenCubes[i];
    cube.y += cube.speed * subLevelSpeed;
    drawGreenCube(cube.x, cube.y, cube.width);

    const cubeHitbox = {
      x: cube.x + HITBOX_SETTINGS.plant.offsetX,
      y: cube.y + HITBOX_SETTINGS.plant.offsetY,
      width: HITBOX_SETTINGS.plant.width,
      height: HITBOX_SETTINGS.plant.height
    };

    if (checkCollision(car.hitbox, cubeHitbox)) {
      collisionTime = timestamp;
      gameRunning = false;
      break;
    }

    if (cube.y + cube.height < 0 || cube.y > GAME_HEIGHT) {
      greenCubes.splice(i, 1);
    }
  }

  // Mostrar información
  drawLevelIndicator();
  ctx.fillStyle = "#fff";
  ctx.font = "18px Arial";
  ctx.fillText(`Velocidad: ${subLevelSpeed.toFixed(1)}x`, 20, 90);

  requestAnimationFrame(gameLoop);
}

function generateObstacle() {
  const type = obstacleImgObjects[Math.floor(Math.random() * obstacleImgObjects.length)].type;
  
  let width, height;
  if (type === "truck") {
    width = 80;
    height = 130;
  } else if (type === "moto") {
    width = 50;
    height = 90;
  } else {
    width = 70;
    height = 100;
  }

  const direction = Math.random() < 0.5 ? "down" : "up";
  const lane = direction === "down" ? 
    Math.random() * (ROAD_CENTER - ROAD_LEFT - width) + ROAD_LEFT :
    Math.random() * (ROAD_RIGHT - ROAD_CENTER - width) + ROAD_CENTER;

  obstacles.push({
    x: lane,
    y: direction === "up" ? GAME_HEIGHT : -height,
    width,
    height,
    img: obstacleImgObjects.find(o => o.type === type).img,
    speed: direction === "up" ? (1.8 + (level * 0.1)) * subLevelSpeed : (0.9 + (level * 0.1)) * subLevelSpeed,
    direction,
    type
  });
}

function generateGreenCube() {
  const cubeSize = 30;
  greenCubes.push({
    x: ROAD_CENTER - cubeSize/2,
    y: -cubeSize,
    width: cubeSize,
    height: cubeSize,
    speed: 1.5 * subLevelSpeed
  });
}

function updateObstacles() {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    let obs = obstacles[i];
    obs.y += obs.direction === "down" ? obs.speed : -obs.speed;
    ctx.drawImage(obs.img, obs.x, obs.y, obs.width, obs.height);

    if (checkCollision(car.hitbox, getObstacleHitbox(obs))) {
      collisionTime = performance.now();
      gameRunning = false;
      return;
    }

    if (obs.y + obs.height < 0 || obs.y > GAME_HEIGHT) {
      obstacles.splice(i, 1);
    }
  }
}

function resetGame() {
  level = 1;
  timeElapsed = 0;
  subLevelSpeed = 1;
  slowdownCounter = 0;
  obstacles = [];
  greenCubes = [];
  car.x = ROAD_LEFT + ROAD_WIDTH / 2 - 35;
  car.y = GAME_HEIGHT - 140;
}

requestAnimationFrame(gameLoop);