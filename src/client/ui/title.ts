/** The title screen: pick a name and enter. */
import { HERO_ORDER, HEROES } from '../../shared/content/classes.js';
import { h } from '../dom.js';
import { musicControl } from './musicControl.js';
import { showHero } from '../art/sprites.js';
import { standingIn } from '../art/heroLook.js';
import { savedName } from '../net.js';

export function titleScreen(onEnter: (name: string) => void): HTMLElement {
  const input = h('input', { class: 'input', placeholder: 'Your hero’s name', maxlength: '16', value: savedName(), autofocus: true, 'aria-label': 'Hero name' });
  const go = (): void => {
    const name = input.value.trim();
    if (name.length < 2) {
      input.focus();
      input.classList.add('shake');
      return;
    }
    onEnter(name);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
  });
  const el = h(
    'div',
    { class: 'title-screen' },
    h('div', { class: 'title-music' }, musicControl()),
    h(
      'div',
      { class: 'title-card' },
      h('div', { class: 'logo-pre' }, 'Land of'),
      h('h1', { class: 'logo' }, 'RHUIN'),
      h('div', { class: 'logo-rule' }),
      h('div', { class: 'tagline' }, 'Four heroes · Endless ruin'),
      h(
        'div',
        { class: 'hero-line' },
        // Every hero with artwork of their own (one drawn as a stand-in for now would show twice).
        HERO_ORDER.filter((hero) => !standingIn(hero)).map((hero) => {
          const img = h('img', { alt: HEROES[hero].name });
          showHero(img, hero);
          return img;
        }),
      ),
      h('div', { class: 'title-form' }, input, h('button', { class: 'btn primary', onclick: go }, 'Enter')),
      h('p', { class: 'title-hint' }, 'Form a party of four — Tank, Mage, Ranger and Duelist — and hack and slash through a dungeon that is never the same twice. Empty roles are filled by AI companions.'),
    ),
  );
  setTimeout(() => input.focus(), 50);
  return el;
}
