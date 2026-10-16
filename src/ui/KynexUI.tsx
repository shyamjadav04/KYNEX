import { useEffect, useRef } from "react";

export default function KynexUI({ boot }: { boot: () => void }) {
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    boot();
  }, [boot]);

  return (
    <div dangerouslySetInnerHTML={{ __html: KYNEX_MARKUP }} />
  );
}

const KYNEX_MARKUP = `<canvas id="app"></canvas>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <symbol id="i-score" viewBox="0 0 24 24"><path d="M12 2 14.4 8.6 21 9.3 16 14 17.5 21 12 17.4 6.5 21 8 14 3 9.3 9.6 8.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></symbol>
    <symbol id="i-distance" viewBox="0 0 24 24"><path d="M12 2c-4 0-7 3.1-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3-7-7-7Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9" r="2.2" fill="currentColor"/></symbol>
    <symbol id="i-pause" viewBox="0 0 24 24"><rect x="6" y="5" width="4.5" height="14" rx="1"/><rect x="13.5" y="5" width="4.5" height="14" rx="1"/></symbol>
    <symbol id="i-up" viewBox="0 0 24 24"><path d="M4 15 12 6 20 15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-down" viewBox="0 0 24 24"><path d="M4 9 12 18 20 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-gear" viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M19.4 13.5c.05-.5.05-1 0-1.5l1.9-1.2-2-3.4-2.1.9a7.9 7.9 0 0 0-1.3-.75L15.6 5h-3.9l-.3 2.55c-.47.2-.9.45-1.3.75l-2.1-.9-2 3.4 1.9 1.2a5.7 5.7 0 0 0 0 1.5l-1.9 1.2 2 3.4 2.1-.9c.4.3.83.55 1.3.75L11.7 19h3.9l.3-2.55c.47-.2.9-.45 1.3-.75l2.1.9 2-3.4Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></symbol>
    <symbol id="i-keys" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 10h2M11 10h2M15 10h2M7 14h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
    <symbol id="i-body" viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8.5v6M8 12h8M9 20l3-5.5L15 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 2c-4 0-7 3.1-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3-7-7-7Z" fill="currentColor"/></symbol>
  </defs>
</svg>

<div id="ui">
  <!-- HUD -->
  <div id="hud" class="layer">
    <div class="stat-stack">
      <div class="plate cut"><svg class="ic"><use href="#i-score"/></svg><div><div class="k">Score</div><div class="v" id="score">0</div></div></div>
      <div class="plate cut"><svg class="ic"><use href="#i-distance"/></svg><div><div class="k">Distance</div><div class="v"><span id="dist">0</span><span class="unit">m</span></div></div></div>
      <div class="plate coins cut"><div class="coin-ico"></div><div><div class="k">Coins</div><div class="v" id="coins">0</div></div></div>
    </div>
    <button id="btnPause" class="round-btn cut" aria-label="Pause"><svg class="ic"><use href="#i-pause"/></svg></button>
    <div id="zoneChip" class="cut"><svg class="ic sm"><use href="#i-pin"/></svg><span id="zoneName">Neon Downtown</span></div>
    <div id="runStateChip" class="cut live"><span class="state-dot"></span><span id="runState">LIVE</span></div>
    <div id="comboChip" class="cut"><span id="comboVal">x1</span><span id="comboMeta">streak 0</span></div>
    <div id="speedWrap"><div id="speedMeta"><span>PACE</span><b id="speedReadout">8%</b></div><div id="speedBar"><div id="speedFill"></div></div></div>
    <button id="btnSlide" class="touch-btn touch-l cut" aria-label="Slide"><svg class="ic lg"><use href="#i-down"/></svg><span>SLIDE</span></button>
    <button id="btnJump" class="touch-btn touch-r cut" aria-label="Jump"><svg class="ic lg"><use href="#i-up"/></svg><span>JUMP</span></button>
    <div id="toast"></div>
  </div>

  <!-- Main menu -->
  <div id="menu" class="layer">
    <div class="scrim"></div>
    <div class="stack">
      <div class="brand">
        <h1 class="wordmark">KYNEX</h1>
        <p class="tagline">Move your body. Control the run.</p>
        <div class="rule"></div>
      </div>
      <div class="best-plate cut" id="bestPlate"><svg class="ic"><use href="#i-score"/></svg><span class="k">Best score</span><span class="v" id="bestScore">0</span><span class="best-live">PERSONAL</span></div>
      <div class="ready-chip cut"><span class="ready-dot"></span><span>RUN SYSTEM READY</span></div>
      <div class="menu">
        <button class="btn primary" id="btnPlay"><svg class="ic"><use href="#i-up"/></svg>Play</button>
        <button class="btn ghost" id="btnControls"><svg class="ic"><use href="#i-keys"/></svg>Controls</button>
        <button class="btn ghost" id="btnSettings"><svg class="ic"><use href="#i-gear"/></svg>Settings</button>
        <button class="btn ghost" id="btnBody" aria-pressed="false"><svg class="ic"><use href="#i-body"/></svg>Body control<span class="sub">Enable lightweight webcam control</span></button>
      </div>
      <p class="hint" id="menuHint">Arrow keys or A / D to switch lanes &middot; Space to jump &middot; S to slide &middot; swipe or tap on touch</p>
    </div>
  </div>

  <!-- Controls -->
  <div id="controls" class="layer">
    <div class="scrim"></div>
    <div class="sheet cut" id="controlsSheet">
      <p class="eyebrow">Every input speaks the same four commands</p>
      <h2>Controls</h2>
      <div class="keys">
        <kbd>A</kbd><p>Move left<small>Arrow left, or swipe left</small></p>
        <kbd>D</kbd><p>Move right<small>Arrow right, or swipe right</small></p>
        <kbd>Space</kbd><p>Jump<small>Arrow up, W, or swipe up</small></p>
        <kbd>S</kbd><p>Slide<small>Arrow down, or swipe down</small></p>
        <kbd>P</kbd><p>Pause<small>Esc also pauses</small></p>
      </div>
      <div class="actions"><button class="btn" id="btnControlsBack">Back</button></div>
    </div>
  </div>

  <!-- Settings -->
  <div id="settings" class="layer">
    <div class="scrim"></div>
    <div class="sheet cut" id="settingsSheet">
      <p class="eyebrow">Tune it for your machine</p>
      <h2>Settings</h2>
      <div class="toggle" id="tgMusic" role="button" tabindex="0" aria-pressed="true"><span>Music</span><div class="sw"></div></div>
      <div class="toggle" id="tgSfx" role="button" tabindex="0" aria-pressed="true"><span>Sound effects</span><div class="sw"></div></div>
      <div class="toggle" id="tgShadows" role="button" tabindex="0" aria-pressed="true"><span>Real-time shadows</span><div class="sw"></div></div>
      <div class="toggle" id="tgShake" role="button" tabindex="0" aria-pressed="true"><span>Camera shake</span><div class="sw"></div></div>
      <div class="toggle" id="tgQuality" role="button" tabindex="0" aria-pressed="true"><span>High resolution<span class="badge" id="fpsTag">--  fps</span></span><div class="sw"></div></div>
      <div class="actions"><button class="btn" id="btnSettingsBack">Back</button></div>
    </div>
  </div>

  <!-- Pause -->
  <div id="pause" class="layer">
    <div class="scrim"></div>
    <div class="sheet cut" id="pauseSheet">
      <p class="eyebrow">The city is holding its breath</p>
      <h2>Paused</h2>
      <div class="pause-status"><span class="state-dot idle"></span>Run state suspended. Your progress is safe.</div>
      <div class="actions">
        <button class="btn primary" id="btnResume">Resume</button>
        <button class="btn ghost" id="btnQuit">Quit to menu</button>
      </div>
    </div>
  </div>

  <!-- Game over -->
  <div id="over" class="layer">
    <div class="scrim"></div>
    <div class="sheet cut" id="overSheet">
      <p class="eyebrow" id="overNote">The run ended at speed</p>
      <h2>Run over</h2>
      <div class="stat"><span><svg class="ic sm"><use href="#i-score"/></svg>Score</span><b id="oScore">0</b></div>
      <div class="stat"><span><div class="coin-ico sm"></div>Coins</span><b id="oCoins">0</b></div>
      <div class="stat"><span><svg class="ic sm"><use href="#i-distance"/></svg>Distance</span><b id="oDist">0 m</b></div>
      <div class="stat best"><span><svg class="ic sm"><use href="#i-score"/></svg>Best</span><b id="oBest">0</b></div>
      <div class="stat"><span><span class="mini-combo">×</span>Max combo</span><b id="oMaxCombo">x1</b></div>
      <div class="actions">
        <button class="btn primary" id="btnRetry">Run again</button>
        <button class="btn ghost" id="btnMenu">Main menu</button>
      </div>
    </div>
  </div>

  <div id="flash"></div>
</div>

<div id="boot">
  <h1 class="wordmark" style="font-size:clamp(40px,9vw,74px);margin:0">KYNEX</h1>
  <div id="bootBar"><div id="bootFill"></div></div>
  <div id="bootTxt">Starting engine</div>
  <div class="err" id="bootErr" hidden></div>
</div>`;
