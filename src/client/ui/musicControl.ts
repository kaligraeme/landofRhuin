/** A small music toggle and volume slider, kept in step with the music director. */
import { music } from '../audio/music.js';
import { h } from '../dom.js';

export function musicControl(): HTMLElement {
  const btn = h('button', { class: 'music-btn', type: 'button', title: 'Music on/off (M in a dungeon)', onclick: () => { music.unlock(); music.toggleMute(); } });
  const slider = h('input', { class: 'music-vol', type: 'range', min: '0', max: '100', step: '1', 'aria-label': 'Music volume' });
  slider.addEventListener('input', () => {
    music.unlock();
    music.setVolume(Number(slider.value) / 100);
  });
  const wrap = h('div', { class: 'music-control' }, btn, slider);
  let seen = false;
  const render = (): void => {
    // Controls on screens that have gone away stop listening.
    if (wrap.isConnected) seen = true;
    else if (seen) {
      off();
      return;
    }
    const silent = music.muted || music.volume === 0;
    btn.textContent = '♪';
    btn.classList.toggle('muted', silent);
    btn.setAttribute('aria-label', silent ? 'Unmute music' : 'Mute music');
    btn.setAttribute('aria-pressed', String(!silent));
    slider.value = String(Math.round(music.volume * 100));
  };
  const off = music.onChange(render);
  render();
  return wrap;
}
