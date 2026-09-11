/**
 * MobileLayoutManager.js
 * Specialized Mobile-Native Focused Experience for Harmonix Lab.
 *
 * Guiding Principles:
 * 1. ZERO CONTENT LOSS:
 *    Every single sub-lab, panel, and educational theory section is 100% visible and accessible.
 *    No container is ever hidden with display: none.
 * 2. STICKY QUICK-JUMP ANCHOR BAR (.mobile-subnav):
 *    Provides one-tap instant smooth jump to any experiment within the active tab,
 *    with automatic active pill highlighting via IntersectionObserver.
 * 3. COMPACT ERGONOMIC DUAL-PANEL CARDS:
 *    Dual-panel experiments (Standing Waves & Beats, ADSR & Blind Test) are cleanly stacked,
 *    with quick anchor switchers to jump between panels.
 * 4. FULL DESKTOP PRESERVATION:
 *    Restores full wide layout seamlessly on large screens or when desktop view is forced.
 */

import { i18n } from '../i18n/i18n.js';

export class MobileLayoutManager {
  constructor() {
    this.tabsConfig = {
      games: {
        containerIds: ['styleChameleonContainer', 'polyrhythmTapContainer', 'earHeroQuestContainer', 'melodyMatrixContainer'],
        i18nKeys: ['mobile.subLabStyle', 'mobile.subLabTap', 'mobile.subLabEar', 'mobile.subLabMatrix'],
        activeIndex: 0
      },
      physics: {
        containerIds: ['waveformLabContainer', 'harmonicSeriesContainer', 'consonanceGraphContainer'],
        i18nKeys: ['mobile.subLabWaveform', 'mobile.subLabHarmonics', 'mobile.subLabConsonance'],
        activeIndex: 0
      },
      theory: {
        containerIds: ['modeExplorerContainer', 'circleOfFifthsContainer', 'globalTraditionsContainer', 'tonnetzMatrixContainer'],
        i18nKeys: ['mobile.subLabModes', 'mobile.subLabCircle', 'mobile.subLabTraditions', 'mobile.subLabTonnetz'],
        activeIndex: 0
      },
      rhythm: {
        containerIds: ['euclideanContainer', 'polyrhythmContainer', 'worldGroovesContainer'],
        i18nKeys: ['mobile.subLabEuclidean', 'mobile.subLabOrbital', 'mobile.subLabGrooves'],
        activeIndex: 0
      },
      timbre: {
        containerIds: ['fourierLabContainer', 'adsrLabContainer'],
        i18nKeys: ['mobile.subLabFourier', 'mobile.subLabAdsr'],
        activeIndex: 0
      }
    };

    this.dualPanelConfig = [
      {
        containerId: 'waveformLabContainer',
        panelKeys: ['mobile.panelStanding', 'mobile.panelBeats'],
        activePanel: 0
      },
      {
        containerId: 'adsrLabContainer',
        panelKeys: ['mobile.panelAdsr', 'mobile.panelBlind'],
        activePanel: 0
      }
    ];

    this.currentTab = 'games';
    this.isMobile = false;
    this.scrollObservers = [];

    this.init();
    if (typeof i18n.onLanguageChange === 'function') {
      this.unsubscribeI18n = i18n.onLanguageChange(() => this.updateLanguage());
    }
  }

  init() {
    this.createSubNavbars();
    this.setupDualPanelSwitchers();
    this.setupTheoryAccordions();
    this.setupScrollSpy();
  }

  /**
   * Builds sticky horizontal quick-jump pill navigation in each tab section
   */
  createSubNavbars() {
    for (const [tabId, conf] of Object.entries(this.tabsConfig)) {
      const section = document.getElementById(`tab-${tabId}`);
      if (!section) continue;

      let subnav = section.querySelector('.mobile-subnav');
      if (!subnav) {
        subnav = document.createElement('div');
        subnav.className = 'mobile-subnav';
        subnav.setAttribute('data-tab', tabId);

        const hero = section.querySelector('.tab-hero');
        if (hero && hero.nextSibling) {
          section.insertBefore(subnav, hero.nextSibling);
        } else {
          section.prepend(subnav);
        }
      }

      this.renderSubNavButtons(subnav, tabId, conf);
    }
  }

  renderSubNavButtons(subnav, tabId, conf) {
    subnav.innerHTML = conf.containerIds.map((cId, idx) => {
      const label = i18n.t(conf.i18nKeys[idx]);
      const isActive = conf.activeIndex === idx;
      return `
        <button class="mobile-subnav-btn ${isActive ? 'active' : ''}" 
                data-tab="${tabId}" 
                data-index="${idx}" 
                data-target="${cId}"
                data-i18n="${conf.i18nKeys[idx]}">
          ${label}
        </button>
      `;
    }).join('');

    const btns = subnav.querySelectorAll('.mobile-subnav-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const targetId = btn.dataset.target;
        this.jumpToSubLab(tabId, idx, targetId);
      });
    });
  }

  /**
   * Smoothly scrolls directly to the chosen sub-lab without hiding any content
   */
  jumpToSubLab(tabId, index, targetId) {
    const conf = this.tabsConfig[tabId];
    if (conf) {
      conf.activeIndex = index;
    }

    const section = document.getElementById(`tab-${tabId}`);
    if (section) {
      const subnav = section.querySelector('.mobile-subnav');
      if (subnav) {
        const btns = subnav.querySelectorAll('.mobile-subnav-btn');
        btns.forEach((b, i) => b.classList.toggle('active', i === index));
        const activeBtn = btns[index];
        if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
          activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }

    const targetEl = document.getElementById(targetId);
    if (targetEl && typeof targetEl.getBoundingClientRect === 'function') {
      const headerOffset = 115;
      const rect = targetEl.getBoundingClientRect();
      const scrollY = (typeof window !== 'undefined' && window.pageYOffset) || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
      const offsetTop = rect.top + scrollY - headerOffset;
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({
          top: Math.max(0, offsetTop),
          behavior: 'smooth'
        });
      }
    }
  }

  /**
   * Sets up IntersectionObserver to synchronize active subnav pill as the user scrolls
   */
  setupScrollSpy() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    if (this.scrollObservers) {
      this.scrollObservers.forEach(obs => obs.disconnect());
    }
    this.scrollObservers = [];

    for (const [tabId, conf] of Object.entries(this.tabsConfig)) {
      const observer = new IntersectionObserver((entries) => {
        const visibleEntries = entries.filter(e => e.isIntersecting);
        if (visibleEntries.length > 0) {
          visibleEntries.sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
          const topEntry = visibleEntries[0];
          const matchedIdx = conf.containerIds.indexOf(topEntry.target.id);
          if (matchedIdx !== -1 && conf.activeIndex !== matchedIdx) {
            conf.activeIndex = matchedIdx;
            const section = document.getElementById(`tab-${tabId}`);
            if (section) {
              const subnav = section.querySelector('.mobile-subnav');
              if (subnav) {
                const btns = subnav.querySelectorAll('.mobile-subnav-btn');
                btns.forEach((b, i) => b.classList.toggle('active', i === matchedIdx));
                if (btns[matchedIdx] && typeof btns[matchedIdx].scrollIntoView === 'function') {
                  btns[matchedIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
              }
            }
          }
        }
      }, {
        root: null,
        rootMargin: '-120px 0px -40% 0px',
        threshold: [0.1, 0.5]
      });

      conf.containerIds.forEach(cId => {
        const el = document.getElementById(cId);
        if (el) observer.observe(el);
      });

      this.scrollObservers.push(observer);
    }
  }

  /**
   * Sets up dual-panel jump switchers for WaveformLab & AdsrLab
   */
  setupDualPanelSwitchers() {
    this.dualPanelConfig.forEach(cfg => {
      const container = document.getElementById(cfg.containerId);
      if (!container) return;

      const grid = container.querySelector('.lab-grid');
      if (!grid) return;

      const panels = grid.querySelectorAll('.panel');
      if (panels.length < 2) return;

      let switcher = container.querySelector('.mobile-panel-switcher');
      if (!switcher) {
        switcher = document.createElement('div');
        switcher.className = 'mobile-panel-switcher';
        grid.parentNode.insertBefore(switcher, grid);
      }

      this.renderDualPanelSwitcher(switcher, cfg, panels);
    });
  }

  renderDualPanelSwitcher(switcher, cfg, panels) {
    switcher.innerHTML = cfg.panelKeys.map((key, i) => {
      const label = i18n.t(key);
      const isActive = cfg.activePanel === i;
      return `
        <button class="mobile-switcher-btn ${isActive ? 'active' : ''}" 
                data-index="${i}" 
                data-i18n="${key}">
          ${label}
        </button>
      `;
    }).join('');

    const btns = switcher.querySelectorAll('.mobile-switcher-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        this.selectDualPanel(cfg, idx, panels, switcher);
      });
    });

    // Ensure BOTH panels are visible!
    panels.forEach(p => {
      p.style.display = '';
      p.classList.remove('mobile-panel-hidden');
    });
  }

  selectDualPanel(cfg, index, panels, switcher) {
    cfg.activePanel = index;
    const btns = switcher.querySelectorAll('.mobile-switcher-btn');
    btns.forEach((b, i) => b.classList.toggle('active', i === index));

    // Smoothly scroll to the target panel
    const targetPanel = panels[index];
    if (targetPanel && typeof targetPanel.getBoundingClientRect === 'function') {
      const headerOffset = 115;
      const rect = targetPanel.getBoundingClientRect();
      const scrollY = (typeof window !== 'undefined' && window.pageYOffset) || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
      const offsetTop = rect.top + scrollY - headerOffset;
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({
          top: Math.max(0, offsetTop),
          behavior: 'smooth'
        });
      }
    }
  }

  /**
   * Sets up theory callout cards so all content is preserved
   */
  setupTheoryAccordions() {
    const callouts = document.querySelectorAll('.theory-callout');
    callouts.forEach(callout => {
      // Ensure theory callouts are always displayed
      callout.style.display = '';
      if (callout.dataset.hasAccordion === 'true') return;
      callout.dataset.hasAccordion = 'true';
      callout.classList.add('mobile-collapsible');
    });
  }

  /**
   * Called when active main tab changes
   */
  onTabChange(tabId) {
    this.currentTab = tabId;
    const conf = this.tabsConfig[tabId];
    if (conf) {
      const section = document.getElementById(`tab-${tabId}`);
      if (section) {
        const subnav = section.querySelector('.mobile-subnav');
        if (subnav) {
          const btns = subnav.querySelectorAll('.mobile-subnav-btn');
          btns.forEach((b, i) => b.classList.toggle('active', i === conf.activeIndex));
        }
      }
    }
    // Refresh scroll spy
    setTimeout(() => this.setupScrollSpy(), 100);
  }

  /**
   * Called when screen mode changes between mobile and desktop
   */
  updateMobileState(isMobile) {
    this.isMobile = !!isMobile;

    // Ensure ALL containers are visible at all times! Zero content loss!
    for (const [tabId, conf] of Object.entries(this.tabsConfig)) {
      conf.containerIds.forEach((cId) => {
        const el = document.getElementById(cId);
        if (el) {
          el.style.display = '';
          el.classList.remove('mobile-active-sublab');
        }
      });
    }

    // Ensure all dual-panels are visible
    this.dualPanelConfig.forEach(cfg => {
      const container = document.getElementById(cfg.containerId);
      if (!container) return;
      const grid = container.querySelector('.lab-grid');
      const panels = grid ? grid.querySelectorAll('.panel') : container.querySelectorAll('.panel');
      panels.forEach(p => {
        p.style.display = '';
        p.classList.remove('mobile-panel-hidden');
      });
    });

    // Ensure all theory callouts are visible
    const callouts = document.querySelectorAll('.theory-callout');
    callouts.forEach(c => {
      c.style.display = '';
    });
  }

  /**
   * Updates all dynamic text when user changes language
   */
  updateLanguage() {
    // Update subnav buttons
    for (const [tabId, conf] of Object.entries(this.tabsConfig)) {
      const section = document.getElementById(`tab-${tabId}`);
      if (!section) continue;
      const subnav = section.querySelector('.mobile-subnav');
      if (subnav) {
        this.renderSubNavButtons(subnav, tabId, conf);
      }
    }

    // Update dual panel switcher buttons
    this.dualPanelConfig.forEach(cfg => {
      const container = document.getElementById(cfg.containerId);
      if (!container) return;
      const switcher = container.querySelector('.mobile-panel-switcher');
      const panels = container.querySelectorAll('.lab-grid .panel');
      if (switcher && panels.length >= 2) {
        this.renderDualPanelSwitcher(switcher, cfg, panels);
      }
    });
  }

  destroy() {
    if (this.scrollObservers) {
      this.scrollObservers.forEach(obs => obs.disconnect());
      this.scrollObservers = [];
    }
    if (this.unsubscribeI18n) {
      this.unsubscribeI18n();
    }
  }
}
