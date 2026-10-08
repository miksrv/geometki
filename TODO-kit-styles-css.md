# TODO: убрать временное решение для CSS кита (CLS)

Сейчас `simple-react-ui-kit@2.0.0` вставляет CSS компонентов в `<head>` из JavaScript, только после гидратации. Из-за этого страницы сначала отрисовываются с нестилизованными кнопками и карточками, а потом «прыгают» (CLS > 0.1 в Google Search Console).

**Временное решение в geometki** (ветка `release/1.13.0`):

- `client/scripts/kit-components-css.mjs` — при сборке извлекает CSS кита;
- `client/next.config.js` — запускает скрипт и передаёт CSS в `env.KIT_COMPONENTS_CSS`;
- `client/pages/_document.tsx` — вставляет этот CSS в `<head>` после стилей Next.

**Исправление в ките** подготовлено локально в `../simple-react-ui-kit` (не закоммичено): компонентные стили собираются в `dist/styles.css` и экспортируются как `simple-react-ui-kit/styles.css`, вставка через JS убрана. Changeset `major` → 3.0.0, подробности в `MIGRATION.md` кита.

## Шаги после релиза кита

- [ ] Обновить `simple-react-ui-kit` в `client/package.json` до версии с `styles.css`.
- [ ] В `client/pages/_app.tsx` добавить `import 'simple-react-ui-kit/styles.css'` между `simple-react-ui-kit/theme.css` и `@/styles/theme.css`.
- [ ] Удалить временное решение: `client/scripts/kit-components-css.mjs` (и папку `scripts/`, если она пустая), блок `kitComponentsCss` и `env.KIT_COMPONENTS_CSS` в `client/next.config.js`, `getInitialProps` со `<style id="kit-components-css">` в `client/pages/_document.tsx`.
- [ ] Проверить каскад: раньше стили кита шли последними и перебивали одноклассовые правила проекта с той же специфичностью (`className` на компонентах кита). Теперь проект грузится после кита, и эти правила начнут применяться. Пройтись по местам, где в компоненты кита передаётся `className`, и сравнить вид.
- [ ] Замерить CLS (главная, место, списки мест, людей и коллекций, лента, профиль): должен остаться 0.
- [ ] Удалить этот файл.
