'use strict';
/* ============================================================
 *  Yükseliş — oyun döngüsü
 * ============================================================ */
const MIN_PER_SEC = 2;   // 1× hızda gerçek saniye başına oyun dakikası

(function boot() {
  initRender(document.getElementById('game'));
  const loaded = trySaved();
  if (!loaded) startNewGame();
  setupUI();
  if (innerWidth < 720) { Cam.z = 1.1; Cam.y = -0.22 * innerHeight / Cam.z; }
  if (loaded) {
    document.getElementById('modal-help').classList.add('hidden');
    UI.toast('Kaydedilen kule yüklendi', 'info');
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (S.speed > 0) {
      let g = dt * MIN_PER_SEC * S.speed;
      while (g > 1e-6) { const s = Math.min(0.25, g); simStep(s); g -= s; }
    }
    keyPan(dt);
    render();
    UI.tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
