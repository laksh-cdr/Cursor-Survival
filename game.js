(() => {
  'use strict';

  // Canvas, UI, and shared utility functions.
  const canvas = document.querySelector('#game');
  const context = canvas.getContext('2d');
  const { width: ARENA_WIDTH, height: ARENA_HEIGHT } = canvas;
  const ui = {
    health: document.querySelector('#hp'), healthFill: document.querySelector('#hpFill'),
    level: document.querySelector('#level'),
    time: document.querySelector('#time'), graze: document.querySelector('#graze'),
    overlay: document.querySelector('#overlay'), message: document.querySelector('#message'),
    start: document.querySelector('#start'), restart: document.querySelector('#restart'),
    coins: document.querySelector('#coins'), shop: document.querySelector('#shop'),
    points: document.querySelector('#points'), powerStatus: document.querySelector('#powerStatus'),
    shopModal: document.querySelector('#shopModal'), closeShop: document.querySelector('#closeShop'),
    shopCoins: document.querySelector('#shopCoins'), skinGrid: document.querySelector('#skinGrid'),
    shopStatus: document.querySelector('#shopStatus'), shopAction: document.querySelector('#shopAction'),
    powerModal: document.querySelector('#powerModal'), phaseTitle: document.querySelector('#phaseTitle'),
    phaseSummary: document.querySelector('#phaseSummary'), powerGrid: document.querySelector('#powerGrid'),
    continueWithoutPower: document.querySelector('#continueWithoutPower'),
  };
  const DAMAGE = { projectile: 10, slash: 20, patch: 15, enemy: 10, laser: 20 };
  const PHASE = { WARNING: 'warning', ACTIVE: 'active' };
  const STORAGE_KEY = { coins: 'cursorSurvivalCoins', skins: 'cursorSurvivalOwnedSkins', equipped: 'cursorSurvivalEquippedSkin', bestScore: 'cursorSurvivalBestScore', bestPhase: 'cursorSurvivalBestPhase', totalCoinsEarned: 'cursorSurvivalTotalCoinsEarned' };
  const SKINS = [
    { id: 'default', name: 'White', type: 'solid', price: 0, color: '#f5fbff' },
    { id: 'red', name: 'Red', type: 'solid', price: 10, color: '#ff566e' },
    { id: 'blue', name: 'Blue', type: 'solid', price: 15, color: '#5aa8ff' },
    { id: 'green', name: 'Green', type: 'solid', price: 20, color: '#62e69b' },
    { id: 'purple', name: 'Purple', type: 'solid', price: 30, color: '#c06dff' },
    { id: 'orange', name: 'Orange', type: 'solid', price: 40, color: '#ff9b4d' },
    { id: 'cyan', name: 'Cyan', type: 'solid', price: 50, color: '#4ee9ee' },
    { id: 'sunset', name: 'Sunset', type: 'gradient', price: 75, colors: ['#ff5757', '#ffc14e'] },
    { id: 'ocean', name: 'Ocean', type: 'gradient', price: 100, colors: ['#4de4ed', '#4967ff'] },
    { id: 'neon', name: 'Neon', type: 'gradient', price: 125, colors: ['#b8ff49', '#f748d4'] },
    { id: 'purple-flame', name: 'Purple Flame', type: 'gradient', price: 150, colors: ['#ff5bbd', '#6c35ff'] },
    { id: 'aurora', name: 'Aurora', type: 'gradient', price: 200, colors: ['#57ffcf', '#5e7dff', '#d25bff'] },
  ];
  const POWER_UPS = [
    { id: 'shield', icon: '◉', name: 'SHIELD', description: 'Absorbs 2 incoming hits.', cost: 60, weight: 4 },
    { id: 'heal', icon: '+', name: 'HEAL', description: 'Restore 25 HP, up to the maximum.', cost: 70, weight: 4 },
    { id: 'invisibility', icon: '◌', name: 'INVISIBILITY', description: 'Followers lose your trail for 8 seconds.', cost: 80, duration: 8, weight: 3 },
    { id: 'slowTime', icon: '◷', name: 'SLOW TIME', description: 'Attacks move 30% slower for 8 seconds.', cost: 90, duration: 8, weight: 3 },
    { id: 'invincibility', icon: '✦', name: 'INVINCIBILITY', description: 'Ignore all damage for 3 seconds.', cost: 100, duration: 3, weight: 2 },
    { id: 'scoreBoost', icon: '↑', name: 'SCORE BOOST', description: 'Earn 50% more points next phase.', cost: 100, duration: 12, weight: 2 },
  ];
  const player = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, inside: false };
  let game;
  let previousFrameTime = 0;
  let wallet = 0;
  let ownedSkinIds = new Set(['default']);
  let equippedSkinId = 'default';
  let selectedSkinId = null;
  let selectedPowerId = null;

  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const distanceBetween = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
  const isNearPlayer = (object, radius) => distanceBetween(object, player) < radius;
  const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;

  // Persistent coin and cosmetic data ---------------------------------------
  function readStoredNumber(key) {
    try { const value = Number(localStorage.getItem(key)); return Number.isFinite(value) && value >= 0 ? value : 0; } catch { return 0; }
  }
  function readStoredSkinIds() {
    try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY.skins)); return Array.isArray(value) ? value.filter(id => SKINS.some(skin => skin.id === id)) : []; } catch { return []; }
  }
  function saveEconomy() {
    try { localStorage.setItem(STORAGE_KEY.coins, String(wallet)); localStorage.setItem(STORAGE_KEY.skins, JSON.stringify([...ownedSkinIds])); localStorage.setItem(STORAGE_KEY.equipped, equippedSkinId); } catch { /* Storage can be unavailable in private browser modes. */ }
  }
  function loadEconomy() {
    wallet = readStoredNumber(STORAGE_KEY.coins);
    ownedSkinIds = new Set(['default', ...readStoredSkinIds()]);
    let savedSkin = 'default';
    try { savedSkin = localStorage.getItem(STORAGE_KEY.equipped) || 'default'; } catch { /* Use default. */ }
    equippedSkinId = ownedSkinIds.has(savedSkin) && SKINS.some(skin => skin.id === savedSkin) ? savedSkin : 'default';
    saveEconomy();
  }
  function getSkin(id = equippedSkinId) { return SKINS.find(skin => skin.id === id) || SKINS[0]; }
  function getPowerById(powerId) { return POWER_UPS.find(power => power.id === powerId) || null; }
  function formatCoins(value) { return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); }
  function updateCoinUi() { ui.coins.textContent = formatCoins(wallet); ui.shopCoins.textContent = formatCoins(wallet); }
  function addCoins(amount) {
    wallet += amount;
    try { localStorage.setItem(STORAGE_KEY.totalCoinsEarned, String(readStoredNumber(STORAGE_KEY.totalCoinsEarned) + amount)); } catch { /* Non-persistent browser session. */ }
    saveEconomy();
    updateCoinUi();
  }

  // Game state and HUD -------------------------------------------------------
  function createGameState() {
    return {
      isRunning: false, isOver: false, isPaused: false, health: 100, level: 1,
      elapsed: 0, levelElapsed: 0, intermission: 1.8, nextAttackIn: 0, nextCoinIn: 4,
      points: 0, pointRemainder: 0, phasePoints: 0, phaseChoices: [],
      score: 0, grazes: 0, invulnerability: 0, screenShake: 0, damageFlash: 0,
      projectiles: [], slashes: [], patches: [], bursts: [], enemies: [], lasers: [], coins: [], coinPopups: [], particles: [],
      powers: { shield: 0, invincibility: 0, invisibility: 0, slowTime: 0, scoreBoost: 0 }, shieldFlash: 0,
      banner: 'PHASE 1', runCoinsCollected: 0,
    };
  }
  function resetGame() { game = createGameState(); updateHud(); }
  function updateHud() {
    ui.health.textContent = Math.ceil(game.health);
    ui.healthFill.style.width = `${game.health}%`;
    ui.level.textContent = game.level;
    if (ui.time) ui.time.textContent = formatTime(game.elapsed);
    if (ui.graze) ui.graze.textContent = game.grazes;
    if (ui.points) ui.points.textContent = game.points;
    if (ui.powerStatus) ui.powerStatus.textContent = powerStatusText();
  }
  function powerStatusText() {
    const powers = game.powers;
    const statuses = [];
    if (powers.shield > 0) statuses.push(`SHIELD ${powers.shield}`);
    if (powers.invincibility > 0) statuses.push(`INV ${powers.invincibility.toFixed(1)}s`);
    if (powers.slowTime > 0) statuses.push(`SLOW ${powers.slowTime.toFixed(1)}s`);
    if (powers.invisibility > 0) statuses.push(`HIDDEN ${powers.invisibility.toFixed(1)}s`);
    if (powers.scoreBoost > 0) statuses.push(`BOOST ${powers.scoreBoost.toFixed(1)}s`);
    return statuses.join(' · ') || '—';
  }
  function addPoints(amount, countForPhase = true) {
    const multiplier = game.powers.scoreBoost > 0 ? 1.5 : 1;
    game.pointRemainder += amount * multiplier;
    const wholePoints = Math.floor(game.pointRemainder);
    if (wholePoints > 0) { game.points += wholePoints; if (countForPhase) game.phasePoints += wholePoints; game.pointRemainder -= wholePoints; }
  }
  function currentDifficulty() {
    return {
      projectileSpeed: 150 + game.level * 19,
      attackInterval: Math.max(.28, 1.35 - game.level * .085),
      warningDuration: Math.max(.42, 1.1 - game.level * .04),
    };
  }
  function updatePowerUps(delta) {
    for (const powerId of ['invincibility', 'invisibility', 'slowTime', 'scoreBoost']) game.powers[powerId] = Math.max(0, game.powers[powerId] - delta);
    game.shieldFlash = Math.max(0, game.shieldFlash - delta);
  }
  function powerDurationFor(power) {
    if (!power || !power.duration) return 0;
    return power.duration * (1 + (game.level - 1) * .38);
  }
  function attackTimeScale() { return game.powers.slowTime > 0 ? .7 : 1; }
  function isPowerAvailable(power) {
    if (power.id === 'heal') return game.health < 100;
    return game.powers[power.id] <= 0;
  }
  function selectPowerChoices() {
    const available = POWER_UPS.filter(isPowerAvailable);
    const choices = [];
    while (choices.length < 3 && available.length) {
      const totalWeight = available.reduce((total, power) => total + power.weight, 0);
      let roll = Math.random() * totalWeight;
      const selectedIndex = available.findIndex(power => { roll -= power.weight; return roll <= 0; });
      choices.push(available.splice(selectedIndex < 0 ? 0 : selectedIndex, 1)[0]);
    }
    const affordableOptions = POWER_UPS.filter(power => isPowerAvailable(power) && power.cost <= game.points && !choices.includes(power));
    if (game.points > 0 && !choices.some(power => power.cost <= game.points) && affordableOptions.length) choices[choices.length - 1] = affordableOptions[Math.floor(Math.random() * affordableOptions.length)];
    return choices;
  }
  function clearArena() {
    game.projectiles = []; game.slashes = []; game.patches = []; game.bursts = [];
    game.enemies = []; game.lasers = []; game.coins = []; game.coinPopups = [];
  }
  function activatePower(power) {
    if (power.id === 'shield') game.powers.shield = 2;
    if (power.id === 'heal') game.health = Math.min(100, game.health + 25);
    if (power.id === 'invincibility') game.powers.invincibility = powerDurationFor(power);
    if (power.id === 'invisibility') game.powers.invisibility = powerDurationFor(power);
    if (power.id === 'slowTime') game.powers.slowTime = powerDurationFor(power);
    if (power.id === 'scoreBoost') game.powers.scoreBoost = powerDurationFor(power);
  }

  // Player input and damage --------------------------------------------------
  canvas.addEventListener('mousemove', event => {
    const rect = canvas.getBoundingClientRect();
    player.x = (event.clientX - rect.left) * ARENA_WIDTH / rect.width;
    player.y = (event.clientY - rect.top) * ARENA_HEIGHT / rect.height;
    player.inside = true;
  });
  canvas.addEventListener('mouseleave', () => { player.inside = false; });
  function getSkinColorForParticles() {
    const skin = getSkin();
    if (skin.type === 'solid') return skin.color;
    return skin.colors[Math.floor(Math.random() * skin.colors.length)];
  }
  function spawnImpactParticles(projectile) {
    const originX = projectile ? projectile.x : player.x;
    const originY = projectile ? projectile.y : player.y;
    const attackColor = projectile && projectile.color ? projectile.color : '#ff5972';
    const skinColor = getSkinColorForParticles();
    for (let index = 0; index < 10; index++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = random(18, 86);
      const life = random(.18, .42);
      game.particles.push({
        x: originX, y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: random(1.5, 4.2),
        color: Math.random() < .5 ? skinColor : attackColor,
        life, maxLife: life,
      });
    }
  }
  function dealDamage(amount) {
    if (!game.isRunning || game.invulnerability > 0) return;
    if (game.powers.invincibility > 0) return;
    if (game.powers.shield > 0) {
      game.powers.shield--;
      game.invulnerability = .25;
      game.shieldFlash = .22;
      game.screenShake = 4;
      updateHud();
      return;
    }
    game.health = Math.max(0, game.health - amount);
    game.invulnerability = .42;
    game.screenShake = 8;
    game.damageFlash = .2;
    game.score = Math.max(0, game.score - 25);
    if (game.health === 0) endGame();
    updateHud();
  }

  // Attack creation ----------------------------------------------------------
  function addProjectile(x, y, targetX = player.x, targetY = player.y, speed = currentDifficulty().projectileSpeed) {
    const directionX = targetX - x;
    const directionY = targetY - y;
    const length = Math.hypot(directionX, directionY) || 1;
    game.projectiles.push({ x, y, velocityX: directionX / length * speed, velocityY: directionY / length * speed, radius: 5, grazed: false, dead: false, color: '#ff5972' });
  }
  function spawnEdgeShots() {
    const side = Math.floor(Math.random() * 4);
    const x = side === 0 ? 0 : side === 1 ? ARENA_WIDTH : random(20, ARENA_WIDTH - 20);
    const y = side === 2 ? 0 : side === 3 ? ARENA_HEIGHT : random(20, ARENA_HEIGHT - 20);
    const count = game.level > 7 && Math.random() < .28 ? 3 : 1;
    for (let index = 0; index < count; index++) addProjectile(x, y, player.x + random(-50, 50), player.y + random(-50, 50));
  }
  function spawnSlash() {
    let direction = Math.random() < .5 ? { x: 1, y: 0 } : { x: 0, y: 1 };
    if (game.level > 5 && Math.random() < .35) { const angle = random(-.7, .7); direction = { x: Math.cos(angle), y: Math.sin(angle) }; }
    const normal = { x: -direction.y, y: direction.x };
    const offset = random(-150, 150);
    game.slashes.push({ centerX: ARENA_WIDTH / 2 + normal.x * offset, centerY: ARENA_HEIGHT / 2 + normal.y * offset, direction, normal, width: 42, phase: PHASE.WARNING, timeLeft: currentDifficulty().warningDuration });
  }
  function spawnPatch() {
    const radius = random(38, game.level > 5 ? 96 : 70);
    game.patches.push({ x: clamp(player.x + random(-250, 250), radius + 20, ARENA_WIDTH - radius - 20), y: clamp(player.y + random(-180, 180), radius + 20, ARENA_HEIGHT - radius - 20), radius, phase: PHASE.WARNING, timeLeft: random(.65, 1.1), activeDuration: .75 });
  }
  function spawnBurst() { game.bursts.push({ x: clamp(player.x + random(-270, 270), 70, ARENA_WIDTH - 70), y: clamp(player.y + random(-180, 180), 70, ARENA_HEIGHT - 70), timeLeft: .9 }); }
  function spawnEnemy() { const angle = random(0, Math.PI * 2), radius = Math.max(ARENA_WIDTH, ARENA_HEIGHT) * .48; game.enemies.push({ x: ARENA_WIDTH / 2 + Math.cos(angle) * radius, y: ARENA_HEIGHT / 2 + Math.sin(angle) * radius, radius: 16, speed: 35 + game.level * 3, life: 8 }); }
  function spawnLaser() { game.lasers.push({ x: random(150, ARENA_WIDTH - 150), y: random(100, ARENA_HEIGHT - 100), angle: random(0, Math.PI), spin: random(-.6, .6), width: 20, phase: PHASE.WARNING, timeLeft: currentDifficulty().warningDuration + .25 }); }
  function spawnAttack() {
    if (game.level === 1) return spawnEdgeShots();
    const attacks = [spawnEdgeShots, spawnSlash];
    if (game.level >= 3) attacks.push(spawnPatch);
    if (game.level >= 4) attacks.push(spawnBurst);
    if (game.level >= 5) attacks.push(spawnEnemy);
    if (game.level >= 6) attacks.push(spawnLaser);
    attacks[Math.floor(Math.random() * attacks.length)]();
    if (game.level > 7 && Math.random() < .2) setTimeout(() => { if (game.isRunning && !game.isPaused && game.intermission <= 0) spawnEdgeShots(); }, 180);
  }

  // Coins are optional pickups and use a timer separate from combat spawns. --
  function chooseCoinValue() {
    const roll = Math.random();
    // Higher denominations deliberately unlock and become more likely over time.
    // Early phases only offer small $1/$5 rewards; $25s stay genuinely rare.
    if (game.level <= 2) return roll < .84 ? 1 : 5;
    if (game.level <= 4) return roll < .58 ? 1 : 5;
    if (game.level <= 6) return roll < .40 ? 1 : roll < .83 ? 5 : 10;
    if (game.level <= 9) return roll < .25 ? 1 : roll < .69 ? 5 : roll < .94 ? 10 : 25;
    if (game.level <= 12) return roll < .16 ? 1 : roll < .55 ? 5 : roll < .89 ? 10 : 25;
    return roll < .10 ? 1 : roll < .40 ? 5 : roll < .82 ? 10 : 25;
  }
  function isSafeCoinPosition(x, y, radius = 18) {
    if (Math.hypot(x - player.x, y - player.y) < 135) return false;
    const inPatch = game.patches.some(patch => patch.phase === PHASE.ACTIVE && Math.hypot(x - patch.x, y - patch.y) < patch.radius + radius);
    const nearEnemy = game.enemies.some(enemy => Math.hypot(x - enemy.x, y - enemy.y) < enemy.radius + radius + 34);
    const inLaser = game.lasers.some(laser => laser.phase === PHASE.ACTIVE && Math.abs((x - laser.x) * -Math.sin(laser.angle) + (y - laser.y) * Math.cos(laser.angle)) < laser.width / 2 + radius);
    const inSlash = game.slashes.some(slash => slash.phase === PHASE.ACTIVE && Math.abs((x - slash.centerX) * slash.normal.x + (y - slash.centerY) * slash.normal.y) < slash.width / 2 + radius && Math.abs((x - slash.centerX) * slash.direction.x + (y - slash.centerY) * slash.direction.y - slash.position) < 45 + radius);
    return !inPatch && !nearEnemy && !inLaser && !inSlash;
  }
  function findSafeCoinPosition() {
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = random(65, ARENA_WIDTH - 65), y = random(65, ARENA_HEIGHT - 65);
      if (isSafeCoinPosition(x, y)) return { x, y };
    }
    return null;
  }
  function spawnCoin() {
    if (game.coins.length >= 2) return;
    const value = chooseCoinValue();
    const isMoving = Math.random() < .42;
    if (!isMoving) {
      const position = findSafeCoinPosition();
      if (position) game.coins.push({ ...position, value, radius: 16, isMoving: false, life: 5.5, age: 0 });
      return;
    }
    const side = Math.floor(Math.random() * 4);
    const x = side === 0 ? -20 : side === 1 ? ARENA_WIDTH + 20 : random(60, ARENA_WIDTH - 60);
    const y = side === 2 ? -20 : side === 3 ? ARENA_HEIGHT + 20 : random(60, ARENA_HEIGHT - 60);
    const target = findSafeCoinPosition();
    if (!target) return;
    const dx = target.x - x, dy = target.y - y, length = Math.hypot(dx, dy) || 1;
    game.coins.push({ x, y, value, radius: 16, isMoving: true, velocityX: dx / length * (105 + game.level * 5), velocityY: dy / length * (105 + game.level * 5), life: 6.2, age: 0 });
  }

  // Attack updates -----------------------------------------------------------
  function updateProjectiles(delta) {
    for (const projectile of game.projectiles) {
      projectile.x += projectile.velocityX * delta; projectile.y += projectile.velocityY * delta;
      if (isNearPlayer(projectile, projectile.radius + 8)) {
        const invincible = game.powers.invincibility > 0;
        spawnImpactParticles(projectile);
        dealDamage(DAMAGE.projectile);
        projectile.dead = !invincible;
      }
      if (!projectile.grazed && isNearPlayer(projectile, projectile.radius + 22)) { projectile.grazed = true; game.grazes++; game.score += 12; addPoints(2); }
    }
    game.projectiles = game.projectiles.filter(p => !p.dead && p.x > -30 && p.x < ARENA_WIDTH + 30 && p.y > -30 && p.y < ARENA_HEIGHT + 30);
  }
  function updateSlashes(delta) {
    for (const slash of game.slashes) {
      slash.timeLeft -= delta;
      if (slash.phase === PHASE.WARNING && slash.timeLeft <= 0) { slash.phase = PHASE.ACTIVE; slash.timeLeft = .34; }
      else if (slash.phase === PHASE.ACTIVE) {
        slash.position = -850 + ((.34 - slash.timeLeft) / .34) * 1700;
        const across = (player.x - slash.centerX) * slash.normal.x + (player.y - slash.centerY) * slash.normal.y;
        const along = (player.x - slash.centerX) * slash.direction.x + (player.y - slash.centerY) * slash.direction.y;
        if (Math.abs(across) < slash.width / 2 && Math.abs(along - slash.position) < 45) dealDamage(DAMAGE.slash);
        if (slash.timeLeft <= 0) slash.dead = true;
      }
    }
    game.slashes = game.slashes.filter(slash => !slash.dead);
  }
  function updatePatches(delta) {
    for (const patch of game.patches) { patch.timeLeft -= delta; if (patch.phase === PHASE.WARNING && patch.timeLeft <= 0) { patch.phase = PHASE.ACTIVE; patch.timeLeft = patch.activeDuration; } else if (patch.phase === PHASE.ACTIVE) { if (isNearPlayer(patch, patch.radius)) dealDamage(DAMAGE.patch); if (patch.timeLeft <= 0) patch.dead = true; } }
    game.patches = game.patches.filter(patch => !patch.dead);
  }
  function updateBursts(delta) {
    for (const burst of game.bursts) { burst.timeLeft -= delta; if (burst.timeLeft <= 0) { const count = 10 + game.level; for (let index = 0; index < count; index++) { const angle = index / count * Math.PI * 2; addProjectile(burst.x, burst.y, burst.x + Math.cos(angle) * 100, burst.y + Math.sin(angle) * 100, 150 + game.level * 14); } burst.dead = true; } }
    game.bursts = game.bursts.filter(burst => !burst.dead);
  }
  function updateEnemies(delta) {
    for (const enemy of game.enemies) { if (game.powers.invisibility <= 0) { const dx = player.x - enemy.x, dy = player.y - enemy.y, length = Math.hypot(dx, dy) || 1; enemy.x += dx / length * enemy.speed * delta; enemy.y += dy / length * enemy.speed * delta; } enemy.life -= delta; if (isNearPlayer(enemy, enemy.radius + 8)) dealDamage(DAMAGE.enemy); if (enemy.life <= 0) enemy.dead = true; }
    game.enemies = game.enemies.filter(enemy => !enemy.dead);
  }
  function updateLasers(delta) {
    for (const laser of game.lasers) { laser.timeLeft -= delta; laser.angle += laser.spin * delta; if (laser.phase === PHASE.WARNING && laser.timeLeft <= 0) { laser.phase = PHASE.ACTIVE; laser.timeLeft = .5; } else if (laser.phase === PHASE.ACTIVE) { const normal = { x: -Math.sin(laser.angle), y: Math.cos(laser.angle) }; if (Math.abs((player.x - laser.x) * normal.x + (player.y - laser.y) * normal.y) < laser.width / 2) dealDamage(DAMAGE.laser); if (laser.timeLeft <= 0) laser.dead = true; } }
    game.lasers = game.lasers.filter(laser => !laser.dead);
  }
  function updateCoins(delta) {
    for (const coin of game.coins) {
      coin.age += delta;
      coin.life -= delta;
      if (coin.isMoving) { coin.x += coin.velocityX * delta; coin.y += coin.velocityY * delta; }
      if (isNearPlayer(coin, coin.radius + 8)) {
        addCoins(coin.value);
        game.runCoinsCollected += coin.value;
        addPoints({ 1: 5, 5: 10, 10: 20, 25: 50 }[coin.value]);
        game.coinPopups.push({ x: player.x, y: player.y - 14, value: coin.value, life: .75 });
        coin.collected = true;
      }
      if (coin.life <= 0 || coin.x < -40 || coin.x > ARENA_WIDTH + 40 || coin.y < -40 || coin.y > ARENA_HEIGHT + 40) coin.dead = true;
    }
    for (const popup of game.coinPopups) { popup.y -= 36 * delta; popup.life -= delta; }
    game.coins = game.coins.filter(coin => !coin.dead && !coin.collected);
    game.coinPopups = game.coinPopups.filter(popup => popup.life > 0);
  }
  function completePhase() {
    clearArena();
    addPoints(10);
    game.isPaused = true;
    game.phaseChoices = selectPowerChoices();
    canvas.classList.remove('game-running');
    ui.phaseTitle.innerHTML = `PHASE ${game.level} <i>SURVIVED</i>`;
    ui.phaseSummary.textContent = `Points earned: +${game.phasePoints} · Current points: ${game.points}`;
    renderPowerChoices();
    ui.powerModal.classList.add('open');
    ui.powerModal.setAttribute('aria-hidden', 'false');
    updateHud();
  }
  function beginNextPhase() {
    ui.powerModal.classList.remove('open');
    ui.powerModal.setAttribute('aria-hidden', 'true');
    game.level++;
    game.levelElapsed = 0;
    game.phasePoints = 0;
    game.intermission = 1.2;
    game.nextAttackIn = .35;
    game.nextCoinIn = 4;
    game.banner = `PHASE ${game.level}`;
    game.isPaused = false;
    canvas.classList.add('game-running');
    previousFrameTime = performance.now();
    updateHud();
  }
  function updateGame(delta) {
    if (!game.isRunning || game.isPaused) return;
    game.elapsed += delta; game.score += delta * (8 + game.level * 2);
    game.invulnerability = Math.max(0, game.invulnerability - delta); game.screenShake = Math.max(0, game.screenShake - delta * 35); game.damageFlash = Math.max(0, game.damageFlash - delta);
    if (game.intermission > 0) { game.intermission -= delta; if (game.intermission <= 0) { game.banner = ''; game.levelElapsed = 0; game.nextAttackIn = .35; } updateHud(); return; }
    addPoints(delta);
    updatePowerUps(delta);
    game.levelElapsed += delta;
    if (game.levelElapsed > 12) { completePhase(); return; }
    game.nextAttackIn -= delta; if (game.nextAttackIn <= 0) { spawnAttack(); game.nextAttackIn = currentDifficulty().attackInterval * random(.7, 1.25); }
    game.nextCoinIn -= delta; if (game.nextCoinIn <= 0) { spawnCoin(); game.nextCoinIn = random(Math.max(4.2, 7 - game.level * .12), Math.max(6.2, 10 - game.level * .12)); }
    const attackDelta = delta * attackTimeScale();
    updateProjectiles(attackDelta); updateSlashes(attackDelta); updatePatches(attackDelta); updateBursts(attackDelta); updateEnemies(attackDelta); updateLasers(attackDelta); updateCoins(delta);
    for (const particle of game.particles) { particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vx *= .96; particle.vy *= .96; particle.life -= delta; }
    game.particles = game.particles.filter(particle => particle.life > 0);
    updateHud();
  }

  // Rendering ----------------------------------------------------------------
  function strokeLine(start, end, color, width = 1) { context.strokeStyle = color; context.lineWidth = width; context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke(); }
  function drawCircle(x, y, radius, fill, stroke, width = 1) { context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); if (fill) { context.fillStyle = fill; context.fill(); } if (stroke) { context.strokeStyle = stroke; context.lineWidth = width; context.stroke(); } }
  function coinStyle(value) {
    return { 1: { fill: '#dce7f8', edge: '#718099' }, 5: { fill: '#68e594', edge: '#278d56' }, 10: { fill: '#64aafc', edge: '#2e65c3' }, 25: { fill: '#d17cff', edge: '#ffce65' } }[value];
  }
  function drawCoin(coin) {
    const style = coinStyle(coin.value), bob = Math.sin(coin.age * 5) * 3;
    context.save(); context.translate(coin.x, coin.y + bob); context.rotate(Math.sin(coin.age * 3) * .15);
    context.shadowColor = style.fill; context.shadowBlur = 13;
    drawCircle(0, 0, coin.radius, style.fill, style.edge, 2);
    context.shadowBlur = 0; context.fillStyle = '#07101b'; context.font = '700 10px IBM Plex Mono'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(`$${coin.value}`, 0, 1); context.restore();
  }
  function cursorFill() {
    if (game.health <= 39) return '#ff4e60';
    if (game.health <= 74) return '#ffb64d';
    const skin = getSkin();
    if (skin.type === 'solid') return skin.color;
    const gradient = context.createLinearGradient(player.x - 7, player.y - 7, player.x + 7, player.y + 7);
    skin.colors.forEach((color, index) => gradient.addColorStop(index / (skin.colors.length - 1), color));
    return gradient;
  }
  function cursorRingColor() {
    if (game.health <= 39) return '#ff4e60';
    if (game.health <= 74) return '#ffb64d';
    const skin = getSkin(); return skin.type === 'solid' ? skin.color : skin.colors[0];
  }
  function drawGame() {
    context.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT); context.fillStyle = '#090e17'; context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    for (let x = 30; x < ARENA_WIDTH; x += 55) strokeLine({ x, y: 0 }, { x, y: ARENA_HEIGHT }, '#101925'); for (let y = 30; y < ARENA_HEIGHT; y += 55) strokeLine({ x: 0, y }, { x: ARENA_WIDTH, y }, '#101925');
    context.save(); context.translate(game.screenShake ? random(-game.screenShake, game.screenShake) : 0, game.screenShake ? random(-game.screenShake, game.screenShake) : 0);
    for (const patch of game.patches) { const active = patch.phase === PHASE.ACTIVE, pulse = active ? 1 : 1 + Math.sin(performance.now() / 90) * .08; context.setLineDash(active ? [] : [6, 6]); drawCircle(patch.x, patch.y, patch.radius * pulse, active ? 'rgba(255,51,75,.25)' : 'rgba(255,103,68,.08)', active ? '#ff3557' : '#ff9a5b', active ? 3 : 2); context.setLineDash([]); }
    for (const burst of game.bursts) { drawCircle(burst.x, burst.y, 18 + (1 - burst.timeLeft / .9) * 34, null, '#ffca61', 2); drawCircle(burst.x, burst.y, 5, '#ffca61'); }
    for (const slash of game.slashes) { const start = { x: slash.centerX - slash.direction.x * 900, y: slash.centerY - slash.direction.y * 900 }, end = { x: slash.centerX + slash.direction.x * 900, y: slash.centerY + slash.direction.y * 900 }; if (slash.phase === PHASE.WARNING) { strokeLine(start, end, 'rgba(255,91,87,.4)', slash.width); strokeLine(start, end, '#ffad7a'); } else { const offset = { x: slash.direction.x * slash.position, y: slash.direction.y * slash.position }; strokeLine({ x: start.x + offset.x, y: start.y + offset.y }, { x: end.x + offset.x, y: end.y + offset.y }, '#ff3251', slash.width); strokeLine({ x: start.x + offset.x, y: start.y + offset.y }, { x: end.x + offset.x, y: end.y + offset.y }, '#fff0db', 2); } }
    for (const laser of game.lasers) { const direction = { x: Math.cos(laser.angle), y: Math.sin(laser.angle) }, start = { x: laser.x - direction.x * 900, y: laser.y - direction.y * 900 }, end = { x: laser.x + direction.x * 900, y: laser.y + direction.y * 900 }; strokeLine(start, end, laser.phase === PHASE.ACTIVE ? '#d92cff' : 'rgba(206,97,255,.38)', laser.phase === PHASE.ACTIVE ? laser.width : 2); if (laser.phase === PHASE.WARNING) strokeLine(start, end, 'rgba(240,201,255,.6)'); }
    for (const projectile of game.projectiles) { drawCircle(projectile.x, projectile.y, projectile.radius, projectile.color || '#ff5972'); drawCircle(projectile.x, projectile.y, projectile.radius + 4, null, 'rgba(255,89,114,.28)'); }
    for (const coin of game.coins) drawCoin(coin);
    for (const particle of game.particles) { context.globalAlpha = Math.max(0, particle.life / particle.maxLife); context.fillStyle = particle.color; context.beginPath(); context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2); context.fill(); }
    context.globalAlpha = 1;
    for (const enemy of game.enemies) drawCircle(enemy.x, enemy.y, enemy.radius, '#b44dff', '#efc5ff', 2);
    for (const popup of game.coinPopups) { context.globalAlpha = popup.life / .75; context.fillStyle = '#ffd36b'; context.font = '700 13px IBM Plex Mono'; context.textAlign = 'center'; context.fillText(`+$${popup.value}`, popup.x, popup.y); context.globalAlpha = 1; }
    if (player.inside && !game.isOver) { const ringColor = cursorRingColor(); if (game.powers.shield > 0) drawCircle(player.x, player.y, 19 + Math.sin(performance.now() / 100) * 2, null, game.shieldFlash ? '#ffffff' : '#70dcff', 2); if (game.powers.invincibility > 0) { context.globalAlpha = .5 + Math.sin(performance.now() / 65) * .25; drawCircle(player.x, player.y, 25, null, '#ffef75', 2); context.globalAlpha = 1; } if (game.powers.invisibility > 0) { context.setLineDash([3, 4]); drawCircle(player.x, player.y, 17, null, '#b4a6ff', 1); context.setLineDash([]); } context.globalAlpha = game.health <= 39 ? .55 : .35; drawCircle(player.x, player.y, 15 + (game.invulnerability ? 3 : 0), null, ringColor, 2); context.globalAlpha = 1; drawCircle(player.x, player.y, 7, cursorFill()); }
    context.restore();
    if (game.damageFlash) { context.fillStyle = `rgba(255,40,55,${game.damageFlash * .35})`; context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT); }
    if (game.banner) { context.fillStyle = 'rgba(4,7,12,.72)'; context.fillRect(0, ARENA_HEIGHT / 2 - 52, ARENA_WIDTH, 104); context.textAlign = 'center'; context.fillStyle = '#ff5470'; context.font = '11px IBM Plex Mono'; context.fillText(game.intermission ? 'PREPARE YOUR CURSOR' : 'SURVIVE', ARENA_WIDTH / 2, ARENA_HEIGHT / 2 - 17); context.fillStyle = '#eef4ff'; context.font = '900 34px Orbitron'; context.fillText(game.banner, ARENA_WIDTH / 2, ARENA_HEIGHT / 2 + 22); }
  }

  // Phase and power-up selection --------------------------------------------
  function renderPowerChoices() {
    selectedPowerId = null;
    ui.powerGrid.replaceChildren();
    for (const power of game.phaseChoices) {
      const affordable = game.points >= power.cost;
      const card = document.createElement('div');
      card.className = 'power-card';
      const boostedDuration = powerDurationFor(power);
      const actionText = affordable ? `${power.cost} POINTS · SELECT` : `${power.cost} POINTS · NEED MORE`;
      card.innerHTML = `
        <button type="button" class="power-select-button">
          <span class="power-icon">${power.icon}</span>
          <span class="power-name">${power.name}</span>
          <span class="power-description">${power.description}${power.duration ? `<br>${boostedDuration.toFixed(1)}s duration` : ''}</span>
          <span class="power-cost">${actionText}</span>
        </button>
      `;
      const selectButton = card.querySelector('.power-select-button');
      selectButton.onclick = () => {
        selectedPowerId = power.id;
        for (const choice of ui.powerGrid.children) {
          const current = choice.querySelector('.power-select-button');
          current.disabled = false;
          choice.classList.toggle('selected', choice === card);
        }
        choosePower(power, card);
      };
      ui.powerGrid.append(card);
    }
    ui.continueWithoutPower.hidden = false;
  }
  function choosePower(power, card) {
    if (game.powerSelecting) return;
    if (game.points < power.cost) {
      ui.phaseSummary.textContent = `${power.name} costs ${power.cost} points. Earn more to claim it or continue without a power-up.`;
      return;
    }
    game.powerSelecting = true;
    if (card) card.classList.add('selected');
    for (const choice of ui.powerGrid.children) choice.querySelector('.power-select-button').disabled = true;
    game.points -= power.cost;
    activatePower(power);
    ui.phaseSummary.textContent = `${power.name} acquired — entering the next phase.`;
    updateHud();
    setTimeout(() => { game.powerSelecting = false; beginNextPhase(); }, 220);
  }
  function continueWithoutPower() {
    selectedPowerId = null;
    beginNextPhase();
  }

  // Cosmetic shop ------------------------------------------------------------
  function previewStyle(skin) {
    return skin.type === 'solid' ? `background:${skin.color};color:${skin.color}` : `background:linear-gradient(135deg, ${skin.colors.join(',')});color:${skin.colors[0]}`;
  }
  function renderShop() {
    ui.skinGrid.replaceChildren();
    for (const skin of SKINS) {
      const owned = ownedSkinIds.has(skin.id);
      const equipped = skin.id === equippedSkinId;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `skin-card${skin.id === selectedSkinId ? ' selected' : ''}${equipped ? ' equipped' : ''}`;
      card.innerHTML = `<span class="skin-preview"><span class="skin-orb" style="${previewStyle(skin)}"></span></span><span class="skin-name">${skin.name}</span><span class="skin-price">${skin.price === 0 ? 'FREE' : `${skin.price} COINS`}</span>${equipped ? '<span class="skin-tag">EQUIPPED</span>' : owned ? '<span class="skin-tag">OWNED</span>' : ''}`;
      card.onclick = () => { selectedSkinId = skin.id; renderShop(); };
      ui.skinGrid.append(card);
    }
    updateCoinUi();
    updateShopAction();
  }
  function updateShopAction() {
    const selected = selectedSkinId ? getSkin(selectedSkinId) : null;
    if (!selected) {
      ui.shopStatus.textContent = 'Select a cursor skin.';
      ui.shopAction.textContent = 'SELECT A SKIN';
      ui.shopAction.disabled = true;
      ui.shopAction.onclick = () => {};
      return;
    }
    if (selected.id === equippedSkinId) {
      ui.shopStatus.textContent = `${selected.name} is currently equipped.`;
      ui.shopAction.textContent = 'EQUIPPED';
      ui.shopAction.disabled = true;
      ui.shopAction.onclick = () => {};
      return;
    }
    if (ownedSkinIds.has(selected.id)) {
      ui.shopStatus.textContent = `${selected.name} is in your collection.`;
      ui.shopAction.textContent = 'EQUIP';
      ui.shopAction.disabled = false;
      ui.shopAction.onclick = buyOrEquipSelectedSkin;
      return;
    }
    ui.shopStatus.textContent = `You need ${selected.price - wallet} more coins for ${selected.name}.`;
    ui.shopAction.textContent = `BUY · ${selected.price} COINS`;
    ui.shopAction.disabled = wallet < selected.price;
    ui.shopAction.onclick = buyOrEquipSelectedSkin;
  }
  function buyOrEquipSelectedSkin() {
    const skin = selectedSkinId ? getSkin(selectedSkinId) : null;
    if (!skin || skin.id === equippedSkinId) return;
    if (!ownedSkinIds.has(skin.id)) {
      if (wallet < skin.price) return;
      wallet -= skin.price;
      ownedSkinIds.add(skin.id);
    }
    equippedSkinId = skin.id;
    saveEconomy();
    renderShop();
  }
  function openShop() {
    game.isPaused = game.isRunning;
    selectedSkinId = equippedSkinId;
    canvas.classList.remove('game-running');
    ui.shopModal.classList.add('open');
    ui.shopModal.setAttribute('aria-hidden', 'false');
    renderShop();
  }
  function closeShop() {
    ui.shopModal.classList.remove('open');
    ui.shopModal.setAttribute('aria-hidden', 'true');
    if (game.isRunning) { game.isPaused = false; canvas.classList.add('game-running'); previousFrameTime = performance.now(); }
  }

  // Frame loop and controls --------------------------------------------------
  function frame(now) { const delta = Math.min(.05, (now - previousFrameTime) / 1000 || 0); previousFrameTime = now; updateGame(delta); drawGame(); requestAnimationFrame(frame); }
  function showTitleScreen() {
    ui.message.innerHTML = '<span>MOVE YOUR MOUSE INSIDE THE ARENA</span><h2>CURSOR SURVIVAL</h2><p>Survive the patterns. Every attack warns before it strikes.</p><button id="start">ENTER ARENA</button>';
    ui.overlay.style.display = 'grid';
    const startButton = document.getElementById('start');
    if (startButton) startButton.onclick = startGame;
  }
  function applyBackgroundTint() {
    const baseR = 7 + Math.random() * 6;
    const baseG = 10 + Math.random() * 6;
    const baseB = 16 + Math.random() * 6;
    document.body.style.setProperty('--bg-tint-rgb', `${baseR}, ${baseG}, ${baseB}`);
  }
  function startGame() { applyBackgroundTint(); closeShop(); ui.powerModal.classList.remove('open'); ui.powerModal.setAttribute('aria-hidden', 'true'); resetGame(); game.isRunning = true; game.runCoinsCollected = 0; canvas.classList.add('game-running'); ui.overlay.style.display = 'none'; previousFrameTime = performance.now(); }
  function endGame() {
    game.isRunning = false; game.isOver = true; canvas.classList.remove('game-running');
    const bestScore = Math.max(readStoredNumber(STORAGE_KEY.bestScore), Math.floor(game.score));
    const bestPhase = Math.max(readStoredNumber(STORAGE_KEY.bestPhase), game.level);
    const collectedCoins = Math.max(0, Number(game.runCoinsCollected) || 0);
    const hadNewBest = game.score > readStoredNumber(STORAGE_KEY.bestScore) || game.level > readStoredNumber(STORAGE_KEY.bestPhase);
    const newBestNotice = hadNewBest ? '<br><b>NEW BEST RUN!</b>' : '';
    ui.message.innerHTML = `<span>RUN TERMINATED</span><h2>GAME OVER</h2><p>Phase reached: <b>${game.level}</b><br>Survival time: <b>${formatTime(game.elapsed)}</b><br>Score: <b>${Math.floor(game.score)}</b><br>Coins collected: <b>${collectedCoins}</b><br>Best score: <b>${bestScore}</b><br>Best phase: <b>${bestPhase}</b>${newBestNotice}</p><button id="again">RESTART</button>`;
    ui.overlay.style.display = 'grid';
    document.getElementById('again').onclick = showTitleScreen;
  }
  ui.start.onclick = startGame; ui.restart.onclick = showTitleScreen;
  ui.shop.onclick = openShop; ui.closeShop.onclick = closeShop; ui.shopAction.onclick = buyOrEquipSelectedSkin;
  ui.continueWithoutPower.onclick = continueWithoutPower;
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && ui.shopModal.classList.contains('open')) closeShop(); });
  loadEconomy(); updateCoinUi(); resetGame(); renderShop(); showTitleScreen(); requestAnimationFrame(frame);
})();
