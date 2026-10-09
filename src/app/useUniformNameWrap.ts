import { useLayoutEffect, useRef, useState } from 'react';

const NAME_GAP = 6; // matches .dash-first margin-right

/**
 * Decides once for the whole table whether names fit on one line, so rows never mix
 * one-line and two-line names. Compares the widest one-line name against the width the
 * driver column can get after every other column takes its share. A column that gives up
 * width (data-min-width, e.g. Strategy's stint bars) counts only at its minimum.
 */
export function useUniformNameWrap(deps: unknown[]) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [wrapped, setWrapped] = useState(false);

  useLayoutEffect(() => {
    const table = tableRef.current;
    const container = table?.parentElement;
    if (!table || !container) return;

    const measure = () => {
      const headCells = [...table.querySelectorAll<HTMLTableCellElement>('thead th')];
      const driverIdx = headCells.findIndex((th) => th.classList.contains('left'));
      const driverTh = headCells[driverIdx];
      if (!driverTh) return;
      const widthOf = (th: HTMLTableCellElement) => (th.dataset.minWidth ? Number(th.dataset.minWidth) : th.getBoundingClientRect().width);
      const others = headCells.reduce((sum, th, i) => (i === driverIdx ? sum : sum + widthOf(th)), 0);
      const pad = parseFloat(getComputedStyle(driverTh).paddingLeft) + parseFloat(getComputedStyle(driverTh).paddingRight);
      const box = getComputedStyle(container);
      const inner = container.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
      const available = inner - others - pad;

      // Measure the text itself: in wrapped mode the name spans are blocks as wide as the
      // column, so their box width would never let the table switch back.
      const range = document.createRange();
      const textWidth = (el: Element) => {
        range.selectNodeContents(el);
        return range.getBoundingClientRect().width;
      };
      let widest = 0;
      for (const cell of table.querySelectorAll('tbody td.left')) {
        const first = cell.querySelector('.dash-first');
        const last = cell.querySelector('.dash-last');
        if (first && last) widest = Math.max(widest, textWidth(first) + NAME_GAP + textWidth(last));
      }
      setWrapped(widest > available);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { tableRef, wrapped };
}
