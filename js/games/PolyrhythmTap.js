/**
 * PolyrhythmTap.js
 * Polyrhythm Tap Hero: An arcade-style rhythm coordination game.
 * Features:
 * - Unified single-panel arcade cabinet console with integrated HUD
 * - Automatic sequential stage progression:
 *   1A: Right Hand Solo (8 hits) -> 1B: Left Hand Solo (8 hits) ->
 *   2: Dual Hands Coordination (16 hits) -> 3: Ghost Pulse (16 hits) ->
 *   4: Speed Hyperdrive (Dynamic accelerando survival) -> Victory
 * - Particle explosion FX on PERFECT, screen shake & red flash on MISS
 * - Floating judgment popups & celebratory stage transition splashes
 */

import { instruments } from '../audio/SynthInstruments.js';
import { audioEngine } from '../audio/AudioEngine.js';
import { i18n } from '../i18n/i18n.js';

export class PolyrhythmTap {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.r1 = 3; // Left Hand (Track 1)
    this.r2 = 2; // Right Hand (Track 2)
    this.baseBpm = 72;
    this.bpm = 72;
    this.isPlaying = false;
    this.isVictory = false;
    this.isCountingDown = false;
    this.countdownTimers = [];

    // Performance Stats
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalHits = 0;
    this.totalPerfects = 0;
    this.totalGoods = 0;
    this.totalMisses = 0;

    // Sequential Progression State:
    // 1: Stage 1A (Right hand solo, 8 hits @ 72 BPM)
    // 2: Stage 1B (Left hand solo, 8 hits @ 72 BPM)
    // 3: Stage 2 (Dual hands coordination, 16 hits @ 72 BPM)
    // 4: Stage 3 (Ghost pulse internal mental counting, 32 hits @ 72 BPM - doubled duration!)
    // 5: Stage 4A (Speed Tier 1: 90 BPM, 12 hits)
    // 6: Stage 4B (Speed Tier 2: 120 BPM, 12 hits)
    // 7: Stage 4C (Speed Tier 3: 144 BPM, 12 hits) -> Victory
    this.stageIndex = 1;
    this.stageHitsCurrent = 0;
    this.stageHitsNeeded = 8;
    this.lastCycleIndex = -1;

    // FX & Animation Engines
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.redFlashAlpha = 0;

    // Banner Announcement
    this.stageBannerText = '';
    this.stageBannerSub = '';
    this.stageBannerTimer = 0;

    this.cycleStartTime = 0;
    this.cycleDuration = (60 / this.bpm) * 2;

    this.initDOM();
    this.initCanvas();
    this.bindEvents();
    this.updateStatsUI();
    this.updatePadsState();
    this.render();
  }

  getStageConfig(stageIndex = this.stageIndex) {
    const configs = {
      1: {
        stageIndex: 1,
        stepCardNum: 1,
        titleKey: 'games.step1Title',
        descKey: 'games.stage1Right',
        hintKey: 'games.hintStage1Right',
        speedTierKey: null,
        bpm: 72,
        hitsNeeded: 20,
        hands: 'right'
      },
      2: {
        stageIndex: 2,
        stepCardNum: 1,
        titleKey: 'games.step1Title',
        descKey: 'games.stage1Left',
        hintKey: 'games.hintStage1Left',
        speedTierKey: null,
        bpm: 72,
        hitsNeeded: 24,
        hands: 'left'
      },
      3: {
        stageIndex: 3,
        stepCardNum: 2,
        titleKey: 'games.step2Title',
        descKey: 'games.stage2',
        hintKey: 'games.hintStage2',
        speedTierKey: null,
        bpm: 72,
        hitsNeeded: 36,
        hands: 'both'
      },
      4: {
        stageIndex: 4,
        stepCardNum: 3,
        titleKey: 'games.step3Title',
        descKey: 'games.stage3',
        hintKey: 'games.hintStage3',
        speedTierKey: null,
        bpm: 72,
        hitsNeeded: 48,
        hands: 'both',
        ghost: true
      },
      5: {
        stageIndex: 5,
        stepCardNum: 4,
        titleKey: 'games.step4Title',
        descKey: 'games.speedTier1',
        hintKey: 'games.hintStage4A',
        speedTierKey: 'games.speedTier1',
        bpm: 90,
        hitsNeeded: 24,
        hands: 'both'
      },
      6: {
        stageIndex: 6,
        stepCardNum: 4,
        titleKey: 'games.step4Title',
        descKey: 'games.speedTier2',
        hintKey: 'games.hintStage4B',
        speedTierKey: 'games.speedTier2',
        bpm: 120,
        hitsNeeded: 30,
        hands: 'both'
      },
      7: {
        stageIndex: 7,
        stepCardNum: 4,
        titleKey: 'games.step4Title',
        descKey: 'games.speedTier3',
        hintKey: 'games.hintStage4C',
        speedTierKey: 'games.speedTier3',
        bpm: 144,
        hitsNeeded: 36,
        hands: 'both'
      }
    };
    return configs[stageIndex] || configs[1];
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="arcade-cabinet panel glass-panel">
        <!-- Arcade Header & Ratio Selector -->
        <div class="panel-header" style="padding-bottom: 0.5rem;">
          <div>
            <h3 style="margin-bottom: 0.2rem;"><span class="icon">🎮</span> <span data-i18n="games.tapTitle">${i18n.t('games.tapTitle')}</span></h3>
            <span class="panel-desc" style="font-size: 0.8rem; margin: 0;" data-i18n="games.tapDesc">${i18n.t('games.tapDesc')}</span>
          </div>
          <div class="inline-flex gap-sm align-center">
            <span class="badge" id="tapRatioBadge" data-i18n="${this.r1 === 3 ? 'games.tapRatio32' : 'games.tapRatio43'}">${i18n.t(this.r1 === 3 ? 'games.tapRatio32' : 'games.tapRatio43')}</span>
            <span class="badge highlight-cyan" id="stageBadge">STAGE 1/4</span>
          </div>
        </div>

        <!-- Consolidated HUD Telemetry Row -->
        <div class="arcade-hud">
          <div class="hud-stat-item">
            <span class="hud-stat-label">SCORE</span>
            <span class="hud-stat-value highlight-amber" id="scoreDisplay">0 PTS</span>
          </div>
          <div class="arcade-hud-stats">
            <div class="hud-stat-item">
              <span class="hud-stat-label" data-i18n="games.currentCombo">COMBO</span>
              <span class="hud-stat-value highlight-cyan" id="comboDisplay">0x</span>
            </div>
            <div class="hud-stat-item">
              <span class="hud-stat-label" data-i18n="games.maxCombo">MAX COMBO</span>
              <span class="hud-stat-value highlight-violet" id="maxComboDisplay">0x</span>
            </div>
            <div class="hud-stat-item">
              <span class="hud-stat-label" data-i18n="games.speed">TEMPO</span>
              <span class="hud-stat-value" id="gameBpmVal">${this.bpm} BPM</span>
            </div>
          </div>
          <div class="hud-stat-item">
            <span class="hud-stat-label">JUDGMENT</span>
            <span class="judgment-text" id="judgmentLabel" data-i18n="games.pressStart">${i18n.t('games.pressStart')}</span>
          </div>
        </div>

        <!-- Stage Stepper Progress Bar -->
        <div class="stage-stepper-container">
          <div class="stage-stepper-track" id="stageStepperTrack">
            <div class="stage-step-card active" id="cardStep1">
              <div class="step-card-num">STAGE 1</div>
              <div class="step-card-title" data-i18n="games.step1Title">${i18n.t('games.step1Title')}</div>
              <div class="stage-progress-fill" id="fillStep1" style="width: 0%;"></div>
            </div>
            <div class="stage-step-card" id="cardStep2">
              <div class="step-card-num">STAGE 2</div>
              <div class="step-card-title" data-i18n="games.step2Title">${i18n.t('games.step2Title')}</div>
              <div class="stage-progress-fill" id="fillStep2" style="width: 0%;"></div>
            </div>
            <div class="stage-step-card" id="cardStep3">
              <div class="step-card-num">STAGE 3</div>
              <div class="step-card-title" data-i18n="games.step3Title">${i18n.t('games.step3Title')}</div>
              <div class="stage-progress-fill" id="fillStep3" style="width: 0%;"></div>
            </div>
            <div class="stage-step-card" id="cardStep4">
              <div class="step-card-num">STAGE 4</div>
              <div class="step-card-title" data-i18n="games.step4Title">${i18n.t('games.step4Title')}</div>
              <div class="stage-progress-fill" id="fillStep4" style="width: 0%;"></div>
            </div>
          </div>
          <div class="stage-objective-hint">
            <span id="stageObjectiveDesc">${i18n.t('games.stage1Right')}</span>
            <span class="stage-objective-counter" id="stageObjectiveCount">0 / 8 Hits</span>
          </div>
        </div>

        <!-- Central Falling Lanes Canvas with Particles, Screen Shake & Countdown Overlay -->
        <div class="canvas-wrapper flex-center" style="position: relative; margin: 1rem 0 0.5rem 0;">
          <canvas id="tapCanvas" width="760" height="290"></canvas>
          <div class="countdown-overlay" id="countdownOverlay" style="display: none;">
            <div class="countdown-card">
              <div class="countdown-badges">
                <span class="badge highlight-cyan" id="cdStageBadge">STAGE 1/4</span>
                <span class="badge highlight-amber" id="cdBpmBadge">72 BPM</span>
              </div>
              <div class="countdown-hint-text" id="cdHintText"></div>
              <div class="countdown-demo-status" id="cdDemoStatus">
                <span id="cdDemoIcon">🔊</span>
                <span id="cdDemoText">${i18n.t('games.rhythmDemo')}</span>
              </div>
              <div class="countdown-big-num" id="cdBigNum">3</div>
            </div>
          </div>

          <!-- Arcade Settlement / Victory Performance Screen -->
          <div class="settlement-overlay" id="settlementOverlay" style="display: none;">
            <div class="settlement-card">
              <div class="settlement-header">
                <span class="settlement-badge" data-i18n="games.stageClear">★ STAGE CLEAR! ★</span>
                <h2 class="settlement-title" data-i18n="games.settlementTitle">${i18n.t('games.settlementTitle')}</h2>
              </div>

              <div class="settlement-rank-container">
                <div class="settlement-rank-circle rank-sss" id="settlementRankCircle">
                  <span class="settlement-rank-letter" id="settlementRankLetter">SSS</span>
                </div>
                <div class="settlement-rank-title" id="settlementRankTitle" data-i18n="games.rankGod">${i18n.t('games.rankGod')}</div>
              </div>

              <div class="settlement-stats-grid">
                <div class="settlement-stat-item">
                  <span class="settlement-stat-label" data-i18n="games.finalScore">${i18n.t('games.finalScore')}</span>
                  <span class="settlement-stat-val text-amber" id="settlementScore">0</span>
                </div>
                <div class="settlement-stat-item">
                  <span class="settlement-stat-label" data-i18n="games.maxCombo">${i18n.t('games.maxCombo')}</span>
                  <span class="settlement-stat-val text-cyan" id="settlementMaxCombo">0x</span>
                </div>
                <div class="settlement-stat-item">
                  <span class="settlement-stat-label" data-i18n="games.accuracy">${i18n.t('games.accuracy')}</span>
                  <span class="settlement-stat-val text-emerald" id="settlementAccuracy">100%</span>
                </div>
                <div class="settlement-stat-item">
                  <span class="settlement-stat-label" data-i18n="games.totalHits">${i18n.t('games.totalHits')}</span>
                  <span class="settlement-stat-val text-violet" id="settlementTotalHits">0</span>
                </div>
              </div>

              <div class="settlement-judgments-row">
                <div class="judgment-badge badge-perfect">
                  <span class="j-label">PERFECT</span>
                  <span class="j-count" id="settlementPerfects">0</span>
                </div>
                <div class="judgment-badge badge-good">
                  <span class="j-label">GOOD</span>
                  <span class="j-count" id="settlementGoods">0</span>
                </div>
                <div class="judgment-badge badge-miss">
                  <span class="j-label">MISS</span>
                  <span class="j-count" id="settlementMisses">0</span>
                </div>
              </div>

              <div class="settlement-actions">
                <button class="btn btn-primary btn-lg" id="btnSettlementReplay" data-i18n="games.playAgain">▶ ${i18n.t('games.playAgain')}</button>
                <button class="btn btn-pill" id="btnSettlementDiff">🔄 ${this.r1 === 3 ? '4:3 Hard' : '3:2 Normal'}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Integrated Dual Tap Pads -->
        <div class="dual-tap-pads" style="margin: 0.5rem 1.25rem 1rem 1.25rem;">
          <button class="tap-pad pad-left" id="padLeft">
            <span class="pad-key">A</span>
            <span class="pad-label" id="padLeftLabel"><span data-i18n="games.leftTrack">${i18n.t('games.leftTrack')}</span> (${this.r1})</span>
          </button>
          <button class="tap-pad pad-right" id="padRight">
            <span class="pad-key">L</span>
            <span class="pad-label" id="padRightLabel"><span data-i18n="games.rightTrack">${i18n.t('games.rightTrack')}</span> (${this.r2})</span>
          </button>
        </div>

        <!-- Transport & Difficulty Switcher Controls -->
        <div class="controls-row justify-center align-center" style="padding: 0 1.25rem 1.25rem 1.25rem; gap: 1.25rem; flex-wrap: wrap;">
          <button class="btn btn-primary btn-lg" id="btnStartGame" data-i18n="games.startGame">▶ ${i18n.t('games.startGame')}</button>
          <div class="rhythm-mode-select inline-flex align-center gap-sm">
            <span style="font-size: 0.78rem; color: var(--text-muted);" data-i18n="games.difficulty">${i18n.t('games.difficulty')}</span>
            <button class="btn btn-pill active" data-r1="3" data-r2="2" data-i18n="games.normal32">${i18n.t('games.normal32')}</button>
            <button class="btn btn-pill" data-r1="4" data-r2="3" data-i18n="games.hard43">${i18n.t('games.hard43')}</button>
          </div>
        </div>
      </div>
    `;

    if (typeof i18n.onLanguageChange === 'function') {
      this.unsubscribeI18n = i18n.onLanguageChange(() => this.updateLanguage());
    }
  }

  initCanvas() {
    this.canvas = document.getElementById('tapCanvas');
    if (this.canvas && typeof this.canvas.getContext === 'function') {
      this.ctx = this.canvas.getContext('2d');
    }
  }

  bindEvents() {
    const startBtn = this.container.querySelector('#btnStartGame');
    if (startBtn) {
      let isPending = false;
      startBtn.addEventListener('click', async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (isPending) return;
        isPending = true;
        try {
          await audioEngine.init();
          if (this.isPlaying) {
            this.stop();
          } else {
            this.start();
          }
        } finally {
          isPending = false;
        }
      });
    }

    const diffBtns = this.container.querySelectorAll('.rhythm-mode-select button');
    diffBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isPlaying) this.stop();
        diffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.r1 = parseInt(btn.dataset.r1, 10);
        this.r2 = parseInt(btn.dataset.r2, 10);
        const ratioKey = this.r1 === 3 ? 'games.tapRatio32' : 'games.tapRatio43';
        const badge = this.container.querySelector('#tapRatioBadge');
        if (badge) {
          badge.textContent = i18n.t(ratioKey);
          badge.setAttribute('data-i18n', ratioKey);
        }
        this.updatePadsState();
        this.render();
      });
    });

    // Keyboard controls
    this.keyHandler = (e) => {
      if (!this.isPlaying || this.isCountingDown) return;
      const config = this.getStageConfig(this.stageIndex);
      if (e.key === 'a' || e.key === 'A') {
        // In Stage 1A (Right hand solo), Left hand is muted
        if (config.hands === 'right') return;
        this.handleTap(1);
        this.flashPad('#padLeft');
      } else if (e.key === 'l' || e.key === 'L') {
        // In Stage 1B (Left hand solo), Right hand is muted
        if (config.hands === 'left') return;
        this.handleTap(2);
        this.flashPad('#padRight');
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    // On-screen touch pads
    const pLeft = this.container.querySelector('#padLeft');
    const pRight = this.container.querySelector('#padRight');
    if (pLeft) {
      pLeft.addEventListener('mousedown', () => {
        if (this.isPlaying && !this.isCountingDown) {
          const config = this.getStageConfig(this.stageIndex);
          if (config.hands === 'right') return;
          this.handleTap(1);
        }
        this.flashPad('#padLeft');
      });
    }
    if (pRight) {
      pRight.addEventListener('mousedown', () => {
        if (this.isPlaying && !this.isCountingDown) {
          const config = this.getStageConfig(this.stageIndex);
          if (config.hands === 'left') return;
          this.handleTap(2);
        }
        this.flashPad('#padRight');
      });
    }

    const btnReplay = this.container.querySelector('#btnSettlementReplay');
    if (btnReplay) {
      btnReplay.addEventListener('click', () => {
        const overlay = this.container.querySelector('#settlementOverlay');
        if (overlay) overlay.style.display = 'none';
        this.start();
      });
    }

    const btnDiff = this.container.querySelector('#btnSettlementDiff');
    if (btnDiff) {
      btnDiff.addEventListener('click', () => {
        const overlay = this.container.querySelector('#settlementOverlay');
        if (overlay) overlay.style.display = 'none';
        const targetR1 = this.r1 === 3 ? 4 : 3;
        const targetBtn = this.container.querySelector(`.rhythm-mode-select button[data-r1="${targetR1}"]`);
        if (targetBtn) {
          targetBtn.click();
        } else {
          this.r1 = targetR1;
          this.r2 = targetR1 === 4 ? 3 : 2;
        }
        this.start();
      });
    }
  }

  flashPad(selector) {
    const pad = this.container.querySelector(selector);
    if (!pad) return;
    pad.classList.add('hit');
    setTimeout(() => pad.classList.remove('hit'), 120);
  }

  clearCountdown() {
    this.isCountingDown = false;
    if (this.countdownTimers && this.countdownTimers.length) {
      this.countdownTimers.forEach(t => clearTimeout(t));
      this.countdownTimers = [];
    }
    const overlay = this.container ? this.container.querySelector('#countdownOverlay') : null;
    if (overlay) overlay.style.display = 'none';
  }

  triggerStageCountdown(config) {
    this.clearCountdown();
    this.isCountingDown = true;
    this.bpm = config.bpm;
    this.cycleDuration = (60 / this.bpm) * 2;

    const overlay = this.container.querySelector('#countdownOverlay');
    const cdStageBadge = this.container.querySelector('#cdStageBadge');
    const cdBpmBadge = this.container.querySelector('#cdBpmBadge');
    const cdHintText = this.container.querySelector('#cdHintText');
    const cdDemoStatus = this.container.querySelector('#cdDemoStatus');
    const cdDemoIcon = this.container.querySelector('#cdDemoIcon');
    const cdDemoText = this.container.querySelector('#cdDemoText');
    const cdBigNum = this.container.querySelector('#cdBigNum');

    if (overlay) overlay.style.display = 'flex';

    // Badge information
    const stageNum = config.stepCardNum;
    const tierText = config.speedTierKey ? ` (${config.bpm} BPM)` : '';
    if (cdStageBadge) cdStageBadge.textContent = `STAGE ${stageNum}/4${tierText}`;
    if (cdBpmBadge) cdBpmBadge.textContent = `${config.bpm} BPM`;

    // Educational Hint
    if (cdHintText) cdHintText.textContent = i18n.t(config.hintKey);

    // Initial state: Rhythmic Demo Phase
    if (cdDemoStatus) cdDemoStatus.className = 'countdown-demo-status';
    if (cdDemoIcon) cdDemoIcon.textContent = '🔊';
    if (cdDemoText) cdDemoText.textContent = i18n.t('games.rhythmDemo');
    if (cdBigNum) {
      cdBigNum.textContent = '♪';
      cdBigNum.className = 'countdown-big-num';
    }

    this.updatePadsState();
    this.updateStatsUI();

    // Play 2 full measures of rhythm demo so the player can comfortably internalize the pulse
    const measureMs = this.cycleDuration * 1000;
    const demoMeasures = 2;
    const totalDemoMs = measureMs * demoMeasures;
    const hands = config.hands;
    const r1 = this.r1;
    const r2 = this.r2;

    for (let m = 0; m < demoMeasures; m++) {
      const measureOffset = m * measureMs;
      // Schedule demonstration clicks
      if (hands === 'right' || hands === 'both') {
        for (let i = 0; i < r2; i++) {
          const delay = measureOffset + (i / r2) * measureMs;
          const timerId = setTimeout(() => {
            if (!this.isPlaying) return;
            instruments.playDrum('clave', null, 0.95);
            this.flashPad('#padRight');
          }, delay);
          this.countdownTimers.push(timerId);
        }
      }

      if (hands === 'left' || hands === 'both') {
        for (let i = 0; i < r1; i++) {
          const delay = measureOffset + (i / r1) * measureMs;
          const timerId = setTimeout(() => {
            if (!this.isPlaying) return;
            instruments.playDrum('woodblock', null, 0.95);
            this.flashPad('#padLeft');
          }, delay);
          this.countdownTimers.push(timerId);
        }
      }
    }

    // After 2-measure rhythm demonstration finishes, begin relaxed 3-2-1 countdown
    const cdStartDelay = Math.max(1800, totalDemoMs + 350);
    const stepDelay = 850; // Relaxed from 650ms to 850ms so players have time to prepare

    // Tick 3
    const t3 = setTimeout(() => {
      if (!this.isPlaying) return;
      if (cdDemoStatus) cdDemoStatus.className = 'countdown-demo-status ready';
      if (cdDemoIcon) cdDemoIcon.textContent = '🎯';
      if (cdDemoText) cdDemoText.textContent = i18n.t('games.getReady');
      if (cdBigNum) {
        cdBigNum.textContent = '3';
        cdBigNum.className = 'countdown-big-num';
      }
      instruments.playTone(880, 0.08, 'sine', null, 0.22);
    }, cdStartDelay);
    this.countdownTimers.push(t3);

    // Tick 2
    const t2 = setTimeout(() => {
      if (!this.isPlaying) return;
      if (cdBigNum) {
        cdBigNum.textContent = '2';
        cdBigNum.className = 'countdown-big-num';
      }
      instruments.playTone(880, 0.08, 'sine', null, 0.22);
    }, cdStartDelay + stepDelay);
    this.countdownTimers.push(t2);

    // Tick 1
    const t1 = setTimeout(() => {
      if (!this.isPlaying) return;
      if (cdBigNum) {
        cdBigNum.textContent = '1';
        cdBigNum.className = 'countdown-big-num';
      }
      instruments.playTone(880, 0.08, 'sine', null, 0.22);
    }, cdStartDelay + stepDelay * 2);
    this.countdownTimers.push(t1);

    // GO!
    const tGo = setTimeout(() => {
      if (!this.isPlaying) return;
      if (cdBigNum) {
        cdBigNum.textContent = i18n.t('games.go');
        cdBigNum.className = 'countdown-big-num go';
      }
      instruments.playTone(1760, 0.18, 'sine', null, 0.3);
      instruments.playDrum('clave', null, 1.0);
    }, cdStartDelay + stepDelay * 3);
    this.countdownTimers.push(tGo);

    // Finish countdown & resume game notes!
    const tEnd = setTimeout(() => {
      if (!this.isPlaying) return;
      if (overlay) overlay.style.display = 'none';
      this.isCountingDown = false;
      this.cycleStartTime = performance.now() / 1000;
    }, cdStartDelay + stepDelay * 3 + 550);
    this.countdownTimers.push(tEnd);
  }

  start() {
    audioEngine.requestPlayback('polyrhythmTap', () => this.stop());
    this.isPlaying = true;
    this.isVictory = false;
    const settlement = this.container ? this.container.querySelector('#settlementOverlay') : null;
    if (settlement) settlement.style.display = 'none';
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalHits = 0;
    this.totalPerfects = 0;
    this.totalGoods = 0;
    this.totalMisses = 0;

    // Reset progression
    this.stageIndex = 1;
    this.stageHitsCurrent = 0;
    const config = this.getStageConfig(1);
    this.stageHitsNeeded = config.hitsNeeded;
    this.bpm = config.bpm;
    this.cycleDuration = (60 / this.bpm) * 2;
    this.lastCycleIndex = -1;

    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.shakeDuration = 0;
    this.redFlashAlpha = 0;

    const startBtn = this.container.querySelector('#btnStartGame');
    if (startBtn) {
      startBtn.textContent = `⏹ ${i18n.t('games.stopGame')}`;
      startBtn.setAttribute('data-i18n', 'games.stopGame');
      startBtn.classList.remove('btn-primary');
      startBtn.classList.add('btn-danger');
    }

    // Launch initial countdown & rhythmic example
    this.triggerStageCountdown(config);
    this.gameLoop();
  }

  stop() {
    this.isPlaying = false;
    this.clearCountdown();
    if (this.animId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.animId);
    audioEngine.releasePlayback('polyrhythmTap');

    const settlement = this.container ? this.container.querySelector('#settlementOverlay') : null;
    if (settlement) settlement.style.display = 'none';

    const startBtn = this.container.querySelector('#btnStartGame');
    if (startBtn) {
      startBtn.textContent = `▶ ${i18n.t('games.startGame')}`;
      startBtn.setAttribute('data-i18n', 'games.startGame');
      startBtn.classList.remove('btn-danger');
      startBtn.classList.add('btn-primary');
    }

    const judgment = this.container.querySelector('#judgmentLabel');
    if (judgment) {
      judgment.textContent = i18n.t('games.pressStart');
      judgment.className = 'judgment-text';
    }

    this.updatePadsState();
    this.render();
  }

  advanceStage() {
    this.stageHitsCurrent = 0;
    const nextIndex = this.stageIndex + 1;

    if (nextIndex > 7) {
      // Completed Stage 7 (4C: 144 BPM) -> Show full arcade victory settlement screen!
      this.showSettlementScreen();
      return;
    }

    this.stageIndex = nextIndex;
    const config = this.getStageConfig(this.stageIndex);
    this.stageHitsNeeded = config.hitsNeeded;

    // Splash banner announcement
    this.triggerBanner(i18n.t('games.stageClear'), i18n.t(config.descKey));

    // Trigger rhythmic demo & 3-2-1 countdown for new stage/speed
    this.triggerStageCountdown(config);
  }

  showSettlementScreen() {
    this.isVictory = true;
    this.isPlaying = false;
    this.clearCountdown();
    audioEngine.releasePlayback('polyrhythmTap');

    // Synthesize victory fanfare arpeggio (C5 - E5 - G5 - C6)
    try {
      const fanfareNotes = [523.25, 659.25, 783.99, 1046.50];
      fanfareNotes.forEach((freq, i) => {
        setTimeout(() => {
          instruments.playTone(freq, 0.45, 'triangle', null, 0.35);
        }, i * 110);
      });
      setTimeout(() => {
        instruments.playDrum('clave', null, 0.95);
      }, 440);
    } catch (e) {}

    // Compute accuracy & rank
    const total = Math.max(1, this.totalHits);
    const accScore = ((this.totalPerfects * 100 + this.totalGoods * 60) / total);
    const accPercent = Math.min(100, Math.max(0, accScore)).toFixed(1);

    let rankLetter = 'B';
    let rankTitleKey = 'games.rankNovice';
    let rankClass = 'rank-b';

    if (accScore >= 95) {
      rankLetter = 'SSS';
      rankTitleKey = 'games.rankGod';
      rankClass = 'rank-sss';
    } else if (accScore >= 85) {
      rankLetter = 'S';
      rankTitleKey = 'games.rankMaster';
      rankClass = 'rank-s';
    } else if (accScore >= 70) {
      rankLetter = 'A';
      rankTitleKey = 'games.rankPro';
      rankClass = 'rank-a';
    }

    // Populate settlement overlay
    const overlay = this.container.querySelector('#settlementOverlay');
    if (overlay) {
      const rankCircle = overlay.querySelector('#settlementRankCircle');
      const rankLetterEl = overlay.querySelector('#settlementRankLetter');
      const rankTitleEl = overlay.querySelector('#settlementRankTitle');

      if (rankCircle) rankCircle.className = `settlement-rank-circle ${rankClass}`;
      if (rankLetterEl) rankLetterEl.textContent = rankLetter;
      if (rankTitleEl) {
        rankTitleEl.textContent = i18n.t(rankTitleKey);
        rankTitleEl.setAttribute('data-i18n', rankTitleKey);
      }

      const scoreEl = overlay.querySelector('#settlementScore');
      if (scoreEl) scoreEl.textContent = this.score.toLocaleString();

      const comboEl = overlay.querySelector('#settlementMaxCombo');
      if (comboEl) comboEl.textContent = `${this.maxCombo}x`;

      const accEl = overlay.querySelector('#settlementAccuracy');
      if (accEl) accEl.textContent = `${accPercent}%`;

      const hitsEl = overlay.querySelector('#settlementTotalHits');
      if (hitsEl) hitsEl.textContent = this.totalHits;

      const pEl = overlay.querySelector('#settlementPerfects');
      if (pEl) pEl.textContent = this.totalPerfects;

      const gEl = overlay.querySelector('#settlementGoods');
      if (gEl) gEl.textContent = this.totalGoods;

      const mEl = overlay.querySelector('#settlementMisses');
      if (mEl) mEl.textContent = this.totalMisses;

      const diffBtn = overlay.querySelector('#btnSettlementDiff');
      if (diffBtn) {
        diffBtn.textContent = this.r1 === 3 ? `🔄 ${i18n.t('games.hard43')}` : `🔄 ${i18n.t('games.normal32')}`;
      }

      overlay.style.display = 'flex';
    }

    // Update transport button
    const startBtn = this.container.querySelector('#btnStartGame');
    if (startBtn) {
      startBtn.textContent = `▶ ${i18n.t('games.playAgain')}`;
      startBtn.setAttribute('data-i18n', 'games.playAgain');
      startBtn.classList.remove('btn-danger');
      startBtn.classList.add('btn-primary');
    }

    // Spawn celebratory fireworks on canvas
    for (let f = 0; f < 8; f++) {
      setTimeout(() => {
        const cx = 150 + Math.random() * 460;
        const cy = 60 + Math.random() * 120;
        const col = f % 2 === 0 ? '#00f2fe' : (f % 3 === 0 ? '#f59e0b' : '#a855f7');
        this.spawnParticles(cx, cy, col, 35);
        this.spawnShockwave(cx, cy, col);
      }, f * 180);
    }

    this.updatePadsState();
    this.updateStatsUI();
  }

  triggerBanner(title, sub) {
    this.stageBannerText = title;
    this.stageBannerSub = sub;
    this.stageBannerTimer = 90; // ~1.5 seconds at 60fps
  }

  handleTap(trackNum) {
    if (this.isCountingDown) return;
    const now = performance.now() / 1000;
    const elapsed = (now - this.cycleStartTime) % this.cycleDuration;
    const progress = elapsed / this.cycleDuration;

    const r = trackNum === 1 ? this.r1 : this.r2;

    // Closest beat time calculation
    let minDiff = 999;
    for (let i = 0; i < r; i++) {
      const targetProg = i / r;
      let diff = Math.abs(progress - targetProg);
      if (diff > 0.5) diff = 1 - diff;
      const diffSec = diff * this.cycleDuration;
      if (diffSec < minDiff) minDiff = diffSec;
    }

    const width = this.canvas ? this.canvas.width : 760;
    const height = this.canvas ? this.canvas.height : 290;
    const laneWidth = 140;
    const hitX = trackNum === 1 ? (width / 2 - laneWidth + 65) : (width / 2 + 10 + 65);
    const hitY = height - 42;

    // Percussion sound
    if (trackNum === 1) instruments.playDrum('woodblock', null, 0.9);
    else instruments.playDrum('clave', null, 0.9);

    this.totalHits++;

    // Judgment timing window evaluation
    if (minDiff <= 0.055) {
      // PERFECT
      this.score += 100 + this.combo * 15;
      this.combo++;
      this.totalPerfects++;
      this.stageHitsCurrent++;
      this.setJudgment(i18n.t('games.perfect'), 'text-success');

      // Visual Special FX: Particle Fireworks + Shockwave
      this.spawnParticles(hitX, hitY, trackNum === 1 ? '#00f2fe' : '#f59e0b', 22);
      this.spawnShockwave(hitX, hitY, trackNum === 1 ? '#00f2fe' : '#f59e0b');
      this.addFloatingText(`PERFECT! +${100 + this.combo * 15}`, hitX, hitY - 15, '#10b981');
    } else if (minDiff <= 0.12) {
      // GOOD
      this.score += 50;
      this.combo++;
      this.totalGoods++;
      this.stageHitsCurrent++;
      this.setJudgment(i18n.t('games.good'), 'text-warning');

      // Smaller particle burst
      this.spawnParticles(hitX, hitY, '#f59e0b', 10);
      this.addFloatingText('GOOD! +50', hitX, hitY - 15, '#f59e0b');
    } else {
      // MISS / OFF BEAT
      this.combo = 0;
      this.totalMisses++;
      this.setJudgment(i18n.t('games.offBeat'), 'text-danger');

      // Visual Special FX: Screen Shake + Red Flash Vignette
      this.shakeDuration = 12;
      this.shakeIntensity = 7;
      this.redFlashAlpha = 0.35;
      this.spawnParticles(hitX, hitY, '#ef4444', 12);
      this.addFloatingText(i18n.t('games.offBeat'), hitX, hitY - 15, '#ef4444');
    }

    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    // Check Stage Progress Completion
    if (this.stageHitsCurrent >= this.stageHitsNeeded) {
      this.advanceStage();
    } else {
      this.updateStatsUI();
    }
  }

  spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        color: Math.random() > 0.3 ? color : '#ffffff',
        size: 3 + Math.random() * 3.5,
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.025
      });
    }
  }

  spawnShockwave(x, y, color) {
    this.shockwaves.push({
      x,
      y,
      radius: 8,
      maxRadius: 42,
      alpha: 1.0,
      color
    });
  }

  addFloatingText(text, x, y, color) {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      alpha: 1.0,
      vy: -1.2
    });
  }

  setJudgment(text, className) {
    const banner = this.container.querySelector('#judgmentLabel');
    if (!banner) return;
    banner.textContent = text;
    banner.className = `judgment-text ${className}`;
  }

  updatePadsState() {
    const pLeft = this.container.querySelector('#padLeft');
    const pRight = this.container.querySelector('#padRight');
    const pLeftLabel = this.container.querySelector('#padLeftLabel');
    const pRightLabel = this.container.querySelector('#padRightLabel');
    if (!pLeft || !pRight) return;

    const config = this.getStageConfig(this.stageIndex);

    if (config.hands === 'right') {
      // Stage 1A: Right Hand Solo (Left is Muted)
      pLeft.classList.add('muted');
      pRight.classList.remove('muted');
      if (pLeftLabel) pLeftLabel.innerHTML = `<span data-i18n="games.leftTrack">${i18n.t('games.leftTrack')}</span> [${i18n.t('games.step1Muted')}]`;
      if (pRightLabel) pRightLabel.innerHTML = `<span data-i18n="games.rightTrack">${i18n.t('games.rightTrack')}</span> (${this.r2})`;
    } else if (config.hands === 'left') {
      // Stage 1B: Left Hand Solo (Right is Muted)
      pRight.classList.add('muted');
      pLeft.classList.remove('muted');
      if (pRightLabel) pRightLabel.innerHTML = `<span data-i18n="games.rightTrack">${i18n.t('games.rightTrack')}</span> [${i18n.t('games.step1Muted')}]`;
      if (pLeftLabel) pLeftLabel.innerHTML = `<span data-i18n="games.leftTrack">${i18n.t('games.leftTrack')}</span> (${this.r1})`;
    } else {
      // Stages 2, 3, 4: Both Hands Active
      pLeft.classList.remove('muted');
      pRight.classList.remove('muted');
      if (pLeftLabel) pLeftLabel.innerHTML = `<span data-i18n="games.leftTrack">${i18n.t('games.leftTrack')}</span> (${this.r1})`;
      if (pRightLabel) pRightLabel.innerHTML = `<span data-i18n="games.rightTrack">${i18n.t('games.rightTrack')}</span> (${this.r2})`;
    }
  }

  updateStatsUI() {
    const sDisplay = this.container.querySelector('#scoreDisplay');
    const cDisplay = this.container.querySelector('#comboDisplay');
    const mDisplay = this.container.querySelector('#maxComboDisplay');
    const bpmDisplay = this.container.querySelector('#gameBpmVal');
    const sBadge = this.container.querySelector('#stageBadge');

    if (sDisplay) sDisplay.textContent = `${this.score.toLocaleString()} PTS`;
    if (cDisplay) {
      cDisplay.textContent = `${this.combo}x`;
      if (this.combo >= 10) cDisplay.classList.add('combo-fire');
      else cDisplay.classList.remove('combo-fire');
    }
    if (mDisplay) mDisplay.textContent = `${this.maxCombo}x`;
    if (bpmDisplay) bpmDisplay.textContent = `${this.bpm} BPM`;

    const config = this.getStageConfig(this.stageIndex);
    const stepNum = config.stepCardNum;

    // Stage Badge
    if (sBadge) {
      if (config.speedTierKey) {
        sBadge.textContent = `STAGE 4/4 (${this.bpm} BPM)`;
      } else {
        sBadge.textContent = `STAGE ${stepNum}/4`;
      }
    }

    // Update 4 Stage Step Cards
    for (let i = 1; i <= 4; i++) {
      const card = this.container.querySelector(`#cardStep${i}`);
      const fill = this.container.querySelector(`#fillStep${i}`);
      if (!card || !fill) continue;

      if (i < stepNum) {
        card.className = 'stage-step-card cleared';
        fill.style.width = '100%';
      } else if (i === stepNum) {
        card.className = 'stage-step-card active';
        let pct = 0;
        if (i === 1) {
          // Stage 1: 1A (8 hits) + 1B (8 hits) = 16 hits total
          const hitsDone = this.stageIndex === 1 ? this.stageHitsCurrent : (8 + this.stageHitsCurrent);
          pct = Math.min(100, Math.round((hitsDone / 16) * 100));
        } else if (i === 4) {
          // Stage 4: 4A (12 hits) + 4B (12 hits) + 4C (12 hits) = 36 hits total
          const tierOffset = this.stageIndex === 5 ? 0 : (this.stageIndex === 6 ? 12 : 24);
          pct = Math.min(100, Math.round(((tierOffset + this.stageHitsCurrent) / 36) * 100));
        } else {
          // Stage 2 (16 hits) or Stage 3 (32 hits)
          pct = Math.min(100, Math.round((this.stageHitsCurrent / this.stageHitsNeeded) * 100));
        }
        fill.style.width = `${pct}%`;
      } else {
        card.className = 'stage-step-card';
        fill.style.width = '0%';
      }
    }

    // Objective description text & hit counter
    const objDesc = this.container.querySelector('#stageObjectiveDesc');
    const objCount = this.container.querySelector('#stageObjectiveCount');

    if (objDesc) {
      objDesc.textContent = i18n.t(config.descKey);
    }

    if (objCount) {
      objCount.textContent = `${this.stageHitsCurrent} / ${this.stageHitsNeeded} Hits`;
    }
  }

  updateLanguage() {
    const ratioKey = this.r1 === 3 ? 'games.tapRatio32' : 'games.tapRatio43';
    const badge = this.container.querySelector('#tapRatioBadge');
    if (badge) {
      badge.textContent = i18n.t(ratioKey);
      badge.setAttribute('data-i18n', ratioKey);
    }

    const startBtn = this.container.querySelector('#btnStartGame');
    if (startBtn) {
      const key = this.isPlaying ? 'games.stopGame' : (this.isVictory ? 'games.playAgain' : 'games.startGame');
      startBtn.textContent = `${this.isPlaying ? '⏹' : '▶'} ${i18n.t(key)}`;
      startBtn.setAttribute('data-i18n', key);
    }

    const judgment = this.container.querySelector('#judgmentLabel');
    if (judgment && !this.isPlaying && !this.isVictory) {
      judgment.textContent = i18n.t('games.pressStart');
    }

    // Update countdown overlay if visible
    if (this.isCountingDown) {
      const config = this.getStageConfig(this.stageIndex);
      const cdHintText = this.container.querySelector('#cdHintText');
      if (cdHintText) cdHintText.textContent = i18n.t(config.hintKey);
      const cdDemoText = this.container.querySelector('#cdDemoText');
      if (cdDemoText) cdDemoText.textContent = i18n.t('games.rhythmDemo');
    }

    this.updateStatsUI();
    this.updatePadsState();
    i18n.applyDomTranslations(this.container);
  }

  gameLoop() {
    if (!this.isPlaying) return;
    this.render();
    if (typeof requestAnimationFrame === 'function') {
      this.animId = requestAnimationFrame(() => this.gameLoop());
    }
  }

  render() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Screen Shake Offset on Miss/Bad Tap
    if (this.shakeDuration > 0) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(sx, sy);
      this.shakeDuration--;
    }

    const laneWidth = 140;
    const lane1X = width / 2 - laneWidth;
    const lane2X = width / 2 + 10;
    const judgmentY = height - 42;

    // Draw Lanes
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fillRect(lane1X, 15, laneWidth - 10, height - 30);
    ctx.fillRect(lane2X, 15, laneWidth - 10, height - 30);

    // Judgment Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lane1X - 10, judgmentY);
    ctx.lineTo(lane2X + laneWidth, judgmentY);
    ctx.stroke();

    // Judgment line label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('TARGET LINE', lane1X - 8, judgmentY - 6);

    const now = performance.now() / 1000;
    const elapsed = this.isPlaying ? ((now - this.cycleStartTime) % this.cycleDuration) : 0;
    const progress = elapsed / this.cycleDuration;

    // Alpha modulation for lanes
    let r1Alpha = 1.0;
    let r2Alpha = 1.0;

    const config = this.getStageConfig(this.stageIndex);

    if (config.hands === 'right') {
      // Stage 1A: Right Hand Solo (Left is Muted)
      r1Alpha = 0.08;
      r2Alpha = 1.0;
    } else if (config.hands === 'left') {
      // Stage 1B: Left Hand Solo (Right is Muted)
      r1Alpha = 1.0;
      r2Alpha = 0.08;
    } else if (config.ghost) {
      // Stage 3: Ghost Pulse (Doubled duration, internal mental counting)
      if (this.isPlaying && !this.isCountingDown) {
        const t = (now - this.cycleStartTime) / this.cycleDuration;
        const phase = (t % 8.0 + 8.0) % 8.0;
        let alpha = 1.0;
        if (phase < 2.0) alpha = 1.0;
        else if (phase < 3.2) alpha = 1.0 - (phase - 2.0) / 1.2;
        else if (phase < 6.5) alpha = 0.0; // Completely invisible ghost pulse!
        else if (phase < 7.8) alpha = (phase - 6.5) / 1.3;
        else alpha = 1.0;

        r1Alpha = alpha;
        r2Alpha = alpha;

        if (alpha < 0.5) {
          ctx.save();
          ctx.fillStyle = `rgba(192, 132, 252, ${Math.min(1.0, (1 - alpha) * 1.6)})`;
          ctx.font = 'bold 12px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('👻 ' + i18n.t('games.step3GhostActive'), width / 2, 70);
          ctx.restore();
        }
      }
    }

    // Helper: Draw Falling Beat Orbs
    const drawTrackBeats = (r, laneX, color, alpha) => {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      for (let i = 0; i < r; i++) {
        const beatProg = i / r;
        let delta = beatProg - progress;
        if (delta < -0.1) delta += 1.0;

        const y = 25 + (1 - delta) * (judgmentY - 25);
        if (y >= 15 && y <= height - 5) {
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 10 * alpha;
          ctx.beginPath();
          ctx.arc(laneX + (laneWidth - 10) / 2, y, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };

    drawTrackBeats(this.r1, lane1X, '#00f2fe', r1Alpha);
    drawTrackBeats(this.r2, lane2X, '#f59e0b', r2Alpha);

    // Render Expanding Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 2.2;
      sw.alpha -= 0.045;
      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Render Particle Explosions
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // Gravity
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Floating Judgment Popups
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.022;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.font = '800 13px var(--font-mono, monospace)';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // Render Red Flash Vignette on Miss
    if (this.redFlashAlpha > 0.01) {
      ctx.save();
      ctx.fillStyle = `rgba(239, 68, 68, ${this.redFlashAlpha})`;
      ctx.fillRect(0, 0, width, height);
      this.redFlashAlpha *= 0.86;
      ctx.restore();
    }

    // Render Stage Transition Splash Banner
    if (this.stageBannerTimer > 0) {
      this.stageBannerTimer--;
      const bannerAlpha = Math.min(1.0, this.stageBannerTimer / 25);
      ctx.save();
      ctx.fillStyle = `rgba(15, 23, 42, ${bannerAlpha * 0.85})`;
      ctx.fillRect(0, height / 2 - 38, width, 76);
      ctx.strokeStyle = `rgba(0, 242, 254, ${bannerAlpha * 0.7})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, height / 2 - 38, width, 76);

      ctx.fillStyle = `rgba(255, 255, 255, ${bannerAlpha})`;
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.stageBannerText, width / 2, height / 2 - 8);

      ctx.fillStyle = `rgba(0, 242, 254, ${bannerAlpha})`;
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText(this.stageBannerSub, width / 2, height / 2 + 16);
      ctx.restore();
    }

    // Render Victory Summary Overlay
    if (this.isVictory) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 15, 30, 0.9)';
      ctx.fillRect(0, 0, width, height);

      const acc = this.totalHits > 0 ? Math.round(((this.totalPerfects + this.totalGoods * 0.5) / this.totalHits) * 100) : 0;
      let rank = 'S';
      let rankColor = '#f59e0b';
      if (acc < 65) { rank = 'C'; rankColor = '#94a3b8'; }
      else if (acc < 80) { rank = 'B'; rankColor = '#00f2fe'; }
      else if (acc < 92) { rank = 'A'; rankColor = '#10b981'; }

      ctx.fillStyle = '#f59e0b';
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏆 ' + i18n.t('games.victory'), width / 2, 60);

      ctx.fillStyle = rankColor;
      ctx.font = '900 48px monospace';
      ctx.fillText(`RANK ${rank}`, width / 2, 120);

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(`Accuracy: ${acc}%  |  Score: ${this.score.toLocaleString()} PTS  |  Max Combo: ${this.maxCombo}x`, width / 2, 160);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(`Perfects: ${this.totalPerfects}  |  Goods: ${this.totalGoods}  |  Misses: ${this.totalMisses}`, width / 2, 195);
      ctx.restore();
    }

    ctx.restore();
  }

  destroy() {
    this.stop();
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
    if (this.unsubscribeI18n) {
      this.unsubscribeI18n();
    }
  }
}
