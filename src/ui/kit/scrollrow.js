/**
 * A row that scrolls sideways on its own. It never drags the page, shows a soft fade on the side that has more,
 * and brings the selected item into view. Call again after the row is rebuilt.
 * @param {HTMLElement} row @returns {HTMLElement}
 */
export function scrollRow(row) {
  row.classList.add('hrow');
  const mark = () => {
    const max = row.scrollWidth - row.clientWidth;
    row.classList.toggle('more-l', row.scrollLeft > 4);
    row.classList.toggle('more-r', max > 4 && row.scrollLeft < max - 4);
  };
  row.addEventListener('scroll', mark, { passive: true });
  const settle = () => {
    const on = row.querySelector('.on');
    if (on && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
    mark();
  };
  requestAnimationFrame(() => requestAnimationFrame(settle));
  if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(mark); ro.observe(row); [...row.children].forEach((c) => ro.observe(c)); }
  return row;
}
