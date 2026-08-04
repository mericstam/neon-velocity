export class RunnerState {
  constructor() {
    this.lane = 0;
    this.y = 0;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.distance = 0;
    this.score = 0;
    this.speed = 20;
    this.gameOver = false;
    this.dashing = false;
    this.dashReady = true;
    // A 2-second battery that is spent only while Shift/X is held.
    // Re-pressing during the same charge window resumes the remaining time.
    this.dashCharge = 2;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboTimer = 0;
    this.shieldActive = false;
    this.shieldCharges = 1;
    this.shieldBreakTimer = 0;
    this.focusTimer = 0;
    this.grinding = false;
    this.grindTimer = 0;
    this.railLocked = false;
    this.railLane = 0;
    this.perfectDodges = 0;
    this.overdrive = false;
    this.overdriveTimer = 0;
    this.bossActive = false;
    this.bossHealth = 0;
    this.bossExposed = false;
    this.bossDefeated = false;
    this.pulseEnergy = 1;
    this.maxPulseEnergy = 1;
    this.magnetRange = 1;
    this.loadoutApplied = false;
    this.lineChain = 0;
    this.reviveAvailable = true;
    this.completedMissions = new Set();
  }

  currentSpeed() {
    return this.speed * (this.dashing ? 5 : 1);
  }

  moveLane(direction) {
    this.lane = Math.max(-1, Math.min(1, this.lane + Math.sign(direction)));
  }

  jump() {
    if (!this.grounded || this.gameOver) return false;
    this.grounded = false;
    this.verticalVelocity = 11.8;
    return true;
  }

  dash() {
    if (this.gameOver || this.dashCharge <= 0) return false;
    this.dashing = true;
    this.dashReady = true;
    return true;
  }

  releaseDash() {
    if (!this.dashing) return false;
    this.dashing = false;
    return true;
  }

  activateShield() {
    if (this.shieldActive || this.shieldCharges <= 0 || this.gameOver) return false;
    this.shieldCharges -= 1;
    this.shieldActive = true;
    return true;
  }

  collectShard() {
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = 2;
    this.score += 60;
  }

  nearMiss() {
    if (this.focusTimer > 0 || this.gameOver) return false;
    this.focusTimer = 0.65;
    this.perfectDodges += 1;
    this.score += 250;
    if (this.perfectDodges >= 3) {
      this.perfectDodges = 0;
      this.overdrive = true;
      this.overdriveTimer = 5;
    }
    return true;
  }

  pulse() {
    if (this.pulseEnergy <= 0 || this.gameOver) return false;
    this.pulseEnergy -= 1;
    return true;
  }

  grind(duration = 0.12) {
    if (this.gameOver) return false;
    this.grinding = true;
    this.grindTimer = duration;
    return true;
  }

  canPulseTarget(target) {
    return target.type === 'drone' && target.lane === this.lane && target.z < 0 && target.z > -24;
  }

  startRail(lane) {
    if (this.gameOver) return false;
    this.railLocked = true;
    this.railLane = lane;
    this.grind(.12);
    return true;
  }

  endRail() {
    this.railLocked = false;
    this.grinding = false;
    this.grindTimer = 0;
  }

  startBoss(health = 3) {
    this.bossActive = true;
    this.bossHealth = health;
    this.bossExposed = false;
    this.bossDefeated = false;
  }

  damageBoss() {
    if (!this.bossActive || !this.bossExposed || this.bossDefeated) return false;
    this.bossHealth -= 1;
    this.bossExposed = false;
    if (this.bossHealth <= 0) {
      this.bossHealth = 0;
      this.bossActive = false;
      this.bossDefeated = true;
      this.score += 2500;
    }
    return true;
  }

  pulseBoss() {
    if (!this.pulse()) return false;
    return this.damageBoss();
  }

  checkBossSweep(sweep) {
    if (!this.bossActive || sweep.lane !== this.lane || Math.abs(sweep.z) > 1.1) return false;
    return this.checkCollision({ lane: sweep.lane, z: sweep.z, type: 'wall' });
  }

  runCredits() {
    const credits = (this.bossDefeated ? 500 : 0) + Math.floor(this.score / 1000) * 25;
    return credits;
  }

  perfectLineGate() {
    this.lineChain += 1;
    if (this.lineChain < 3) return false;
    this.lineChain = 0;
    this.score += 900;
    return true;
  }

  revive() {
    if (!this.gameOver || !this.reviveAvailable) return false;
    this.reviveAvailable = false;
    this.gameOver = false;
    this.shieldActive = true;
    return true;
  }

  completeMission(id) {
    this.completedMissions.add(id);
  }

  missionCredits() {
    const credits = this.completedMissions.size * 150;
    this.completedMissions.clear();
    return credits;
  }

  applyLoadout(active, passive) {
    if (this.loadoutApplied) return;
    this.loadoutApplied = true;
    if (active === 'aegis') this.shieldCharges += 1;
    if (active === 'overcharge') {
      this.maxPulseEnergy += 1;
      this.pulseEnergy = this.maxPulseEnergy;
    }
    if (passive === 'magnet' || active === 'magnet') this.magnetRange = 2.25;
    if (passive === 'overcharge') {
      this.maxPulseEnergy += 1;
      this.pulseEnergy = this.maxPulseEnergy;
    }
  }

  step(delta) {
    if (this.gameOver) return;
    const dt = Math.min(Math.max(0, delta), 0.05);
    const simulationSeconds = Math.max(0, delta);
    this.speed = Math.min(42, 20 + this.distance * 0.016);
    const travelSpeed = this.currentSpeed();
    this.distance += travelSpeed * simulationSeconds;
    this.speed = Math.min(42, 20 + this.distance * 0.016);
    this.score += Math.floor(travelSpeed * simulationSeconds * (1 + this.combo * 0.08));

    if (this.dashing) {
      this.dashCharge = Math.max(0, this.dashCharge - simulationSeconds);
      if (this.dashCharge <= 0) {
        this.dashing = false;
        this.dashReady = false;
        this.dashCooldown = 2.35;
      }
    }
    if (!this.dashReady && this.dashCharge <= 0) {
      this.dashCooldown = Math.max(0, this.dashCooldown - simulationSeconds);
      if (this.dashCooldown <= 0) {
        this.dashCharge = 2;
        this.dashReady = true;
      }
    }
    if (this.combo > 0) {
      this.comboTimer -= simulationSeconds;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.focusTimer > 0) this.focusTimer = Math.max(0, this.focusTimer - simulationSeconds);
    if (this.overdrive) {
      this.overdriveTimer -= simulationSeconds;
      if (this.overdriveTimer <= 0) this.overdrive = false;
    }
    if (this.shieldBreakTimer > 0) this.shieldBreakTimer = Math.max(0, this.shieldBreakTimer - simulationSeconds);
    if (this.railLocked) this.score += Math.floor(120 * simulationSeconds);
    if (this.grinding) {
      this.grindTimer -= simulationSeconds;
      if (this.grindTimer <= 0) this.grinding = false;
    }
    if (!this.grounded) {
      this.verticalVelocity -= 30 * dt;
      this.y += this.verticalVelocity * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.verticalVelocity = 0;
        this.grounded = true;
      }
    }
  }

  checkCollision(obstacle) {
    if (this.gameOver || obstacle.lane !== this.lane || Math.abs(obstacle.z) > 1.1) return false;
    const canClear = obstacle.type === 'low' && this.y > 1.15;
    if (canClear || this.dashing || this.shieldBreakTimer > 0) return false;
    if (this.shieldActive) {
      this.shieldActive = false;
      // The collision can span several frames while an obstacle passes through the player.
      // Keep a short immunity window so one impact spends only one shield charge.
      this.shieldBreakTimer = 1;
      return false;
    }
    this.gameOver = true;
    return true;
  }

  rank() {
    const rating = this.score + this.bestCombo * 300;
    if (rating >= 10000) return 'S';
    if (rating >= 6000) return 'A';
    if (rating >= 3000) return 'B';
    if (rating >= 1200) return 'C';
    return 'D';
  }

  reset() {
    Object.assign(this, new RunnerState());
  }
}

export const laneX = (lane) => lane * 3.25;
