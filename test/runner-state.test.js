import { describe, expect, it } from 'vitest';
import { RunnerState } from '../src/game-state.js';

describe('RunnerState', () => {
  it('moves exactly one lane per queued input and clamps at track edges', () => {
    const state = new RunnerState();
    state.moveLane(1);
    expect(state.lane).toBe(1);
    state.moveLane(1);
    expect(state.lane).toBe(1);
    state.moveLane(-1);
    expect(state.lane).toBe(0);
    state.moveLane(-1);
    expect(state.lane).toBe(-1);
    state.moveLane(-1);
    expect(state.lane).toBe(-1);
  });

  it('starts a jump only while grounded and lands predictably', () => {
    const state = new RunnerState();
    expect(state.jump()).toBe(true);
    expect(state.jump()).toBe(false);
    for (let frame = 0; frame < 300; frame += 1) state.step(1 / 60);
    expect(state.y).toBe(0);
    expect(state.grounded).toBe(true);
  });

  it('raises score and speed as distance accumulates', () => {
    const state = new RunnerState();
    const initialSpeed = state.speed;
    state.step(10);
    expect(state.score).toBeGreaterThan(0);
    expect(state.speed).toBeGreaterThan(initialSpeed);
  });

  it('preserves unused dash time for a consecutive re-press', () => {
    const state = new RunnerState();
    const normalSpeed = state.currentSpeed();
    expect(state.dash()).toBe(true);
    state.step(1);
    state.releaseDash();
    expect(state.dashCharge).toBeCloseTo(1, 3);
    expect(state.currentSpeed()).toBe(state.speed);

    expect(state.dash()).toBe(true);
    state.step(.9);
    expect(state.dashing).toBe(true);
    state.step(.2);
    expect(state.dashing).toBe(false);
    expect(state.dashCharge).toBeCloseTo(0, 3);
  });

  it('recharges a depleted dash only after its recovery cooldown', () => {
    const state = new RunnerState();
    state.dash();
    state.step(2.1);
    expect(state.dashCharge).toBeCloseTo(0, 3);
    expect(state.dashReady).toBe(false);
    state.step(2.4);
    expect(state.dashReady).toBe(true);
    expect(state.dashCharge).toBeCloseTo(2, 3);
  });

  it('builds a shard combo and awards a multiplier to the score', () => {
    const state = new RunnerState();
    state.collectShard();
    state.collectShard();
    state.collectShard();
    expect(state.combo).toBe(3);
    expect(state.score).toBe(180);
    state.step(2.1);
    expect(state.combo).toBe(0);
  });

  it('keeps an activated shield up until it absorbs one lethal collision', () => {
    const state = new RunnerState();
    state.activateShield();
    state.step(1);
    expect(state.shieldActive).toBe(true);
    expect(state.checkCollision({ lane: 0, z: 0.15, type: 'wall' })).toBe(false);
    expect(state.shieldActive).toBe(false);
    expect(state.gameOver).toBe(false);
    expect(state.shieldBreakTimer).toBeGreaterThan(0);
    expect(state.checkCollision({ lane: 0, z: 0.15, type: 'wall' })).toBe(false);
    state.step(1);
    expect(state.checkCollision({ lane: 0, z: 0.15, type: 'wall' })).toBe(true);
    expect(state.gameOver).toBe(true);
  });

  it('ranks a run from its score and peak combo', () => {
    const state = new RunnerState();
    state.score = 12500;
    state.bestCombo = 12;
    expect(state.rank()).toBe('S');
  });

  it('triggers focus time when a near miss is reported and awards a style bonus', () => {
    const state = new RunnerState();
    expect(state.nearMiss()).toBe(true);
    expect(state.focusTimer).toBeGreaterThan(0);
    expect(state.score).toBe(250);
    expect(state.nearMiss()).toBe(false);
  });

  it('uses pulse energy to remove a hostile target in the active lane', () => {
    const state = new RunnerState();
    expect(state.pulse()).toBe(true);
    expect(state.pulseEnergy).toBe(0);
    expect(state.canPulseTarget({ lane: 0, z: -10, type: 'drone' })).toBe(true);
    expect(state.canPulseTarget({ lane: 1, z: -10, type: 'drone' })).toBe(false);
  });

  it('applies selected loadout bonuses only once', () => {
    const state = new RunnerState();
    state.applyLoadout('magnet', 'overcharge');
    state.applyLoadout('magnet', 'overcharge');
    expect(state.magnetRange).toBeGreaterThan(1);
    expect(state.maxPulseEnergy).toBe(2);
    expect(state.pulseEnergy).toBe(2);
  });

  it('builds a perfect-line chain and rewards the completed sequence', () => {
    const state = new RunnerState();
    state.perfectLineGate();
    state.perfectLineGate();
    expect(state.lineChain).toBe(2);
    state.perfectLineGate();
    expect(state.lineChain).toBe(0);
    expect(state.score).toBe(900);
  });

  it('allows one revive after a terminal collision and restores a shield', () => {
    const state = new RunnerState();
    state.checkCollision({ lane: 0, z: 0, type: 'wall' });
    expect(state.gameOver).toBe(true);
    expect(state.revive()).toBe(true);
    expect(state.gameOver).toBe(false);
    expect(state.shieldActive).toBe(true);
    expect(state.revive()).toBe(false);
  });

  it('converts completed mission progress into credits', () => {
    const state = new RunnerState();
    state.completeMission('drone-hunter');
    expect(state.missionCredits()).toBe(150);
    expect(state.missionCredits()).toBe(0);
  });

  it('refreshes a short grind window while the runner remains in rail contact', () => {
    const state = new RunnerState();
    expect(state.y).toBe(0);
    expect(state.grind(.12)).toBe(true);
    state.step(.08);
    expect(state.grind(.12)).toBe(true);
    state.step(.08);
    expect(state.grinding).toBe(true);
    state.step(.13);
    expect(state.grinding).toBe(false);
  });

  it('activates overdrive after three perfect dodges and expires it', () => {
    const state = new RunnerState();
    state.nearMiss();
    state.focusTimer = 0;
    state.nearMiss();
    state.focusTimer = 0;
    state.nearMiss();
    expect(state.overdrive).toBe(true);
    state.step(6);
    expect(state.overdrive).toBe(false);
  });

  it('requires a pulse during the exposed phase to damage a boss and awards credits on defeat', () => {
    const state = new RunnerState();
    state.startBoss(2);
    expect(state.damageBoss()).toBe(false);
    state.bossExposed = true;
    expect(state.pulseBoss()).toBe(true);
    expect(state.bossHealth).toBe(1);
    state.pulseEnergy = 1;
    state.bossExposed = true;
    expect(state.pulseBoss()).toBe(true);
    expect(state.bossDefeated).toBe(true);
    expect(state.runCredits()).toBeGreaterThanOrEqual(500);
  });

  it('treats a boss sweep in the player lane as a lethal collision unless protected', () => {
    const state = new RunnerState();
    state.startBoss(3);
    expect(state.checkBossSweep({ lane: 0, z: .2 })).toBe(true);
    expect(state.gameOver).toBe(true);
  });

  it('adds rail score while snapped and exits cleanly', () => {
    const state = new RunnerState();
    state.startRail(0);
    expect(state.railLocked).toBe(true);
    state.step(1);
    expect(state.score).toBeGreaterThan(0);
    state.endRail();
    expect(state.railLocked).toBe(false);
  });
});
