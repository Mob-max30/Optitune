/**
 * Earth Jukebox (EJB) — Accessible Grid Overlay & Data View Table
 * Specification: Amendment B, Section 7 ("Accessibility of the canvas")
 *
 * Implements:
 * 1. A roving-tabindex HTML role="grid" layered over the canvas for screen-readers & keyboards.
 * 2. An alternative "Data view" HTML table replacement displaying all 32 cells with full precision.
 */

import type { UiViewModel, UiGridCell } from './view-model';

export class GridOverlay {
  private container: HTMLElement;
  private gridElement: HTMLElement;
  private tableElement: HTMLElement;
  private isTableView = false;
  private focusedIndex = 0;
  private viewModel: UiViewModel | null = null;
  private onCellSelect?: (cell: UiGridCell) => void;

  constructor(container: HTMLElement, onCellSelect?: (cell: UiGridCell) => void) {
    this.container = container;
    this.onCellSelect = onCellSelect;

    this.gridElement = document.createElement('div');
    this.gridElement.className = 'ejb-grid-overlay';
    this.gridElement.setAttribute('role', 'grid');
    this.gridElement.setAttribute('aria-label', 'Earth observation spatial grid (4 bands by 8 sectors)');

    this.tableElement = document.createElement('div');
    this.tableElement.className = 'ejb-data-table-container';
    this.tableElement.style.display = 'none';

    this.container.appendChild(this.gridElement);
    this.container.appendChild(this.tableElement);

    this.setupKeyboardNavigation();
  }

  setTableView(active: boolean): void {
    this.isTableView = active;
    this.gridElement.style.display = active ? 'none' : 'grid';
    this.tableElement.style.display = active ? 'block' : 'none';
    if (active) {
      this.renderTable();
    }
  }

  toggleTableView(): boolean {
    this.setTableView(!this.isTableView);
    return this.isTableView;
  }

  updateViewModel(vm: UiViewModel): void {
    this.viewModel = vm;
    this.renderGrid();
    if (this.isTableView) {
      this.renderTable();
    }
  }

  private renderGrid(): void {
    if (!this.viewModel) return;
    this.gridElement.innerHTML = '';

    const cells = this.viewModel.grid.cells;
    for (let r = 0; r < 4; r++) {
      const rowEl = document.createElement('div');
      rowEl.setAttribute('role', 'row');
      rowEl.className = 'ejb-grid-row';

      for (let c = 0; c < 8; c++) {
        const idx = r * 8 + c;
        const cell = cells[idx];
        const cellEl = document.createElement('div');
        cellEl.setAttribute('role', 'gridcell');
        cellEl.className = 'ejb-grid-cell';
        cellEl.setAttribute('tabindex', idx === this.focusedIndex ? '0' : '-1');
        cellEl.setAttribute('aria-label', cell?.readout || `Cell ${r + 1}, ${c + 1}`);
        cellEl.dataset.index = String(idx);

        cellEl.addEventListener('click', () => {
          this.focusedIndex = idx;
          this.updateTabIndices();
          if (cell) this.onCellSelect?.(cell);
        });

        rowEl.appendChild(cellEl);
      }
      this.gridElement.appendChild(rowEl);
    }
  }

  private renderTable(): void {
    if (!this.viewModel) return;
    const isGeoref = this.viewModel.source.isGeoreferenced;
    const cells = this.viewModel.grid.cells;

    let html = `
      <table class="ejb-data-table" role="table" aria-label="Detailed 32-cell spatial measurement matrix">
        <caption class="sr-only">Detailed spatial measurements across 4 rows and 8 columns</caption>
        <thead>
          <tr>
            <th scope="col">Band</th>
            <th scope="col">Col 1</th><th scope="col">Col 2</th><th scope="col">Col 3</th><th scope="col">Col 4</th>
            <th scope="col">Col 5</th><th scope="col">Col 6</th><th scope="col">Col 7</th><th scope="col">Col 8</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (let r = 0; r < 4; r++) {
      const bandName = isGeoref
        ? (r === 0 ? 'N. Polar' : r === 1 ? 'N. Mid' : r === 2 ? 'S. Mid' : 'S. Polar')
        : `Band ${r + 1}`;

      html += `<tr><th scope="row">${bandName}</th>`;
      for (let c = 0; c < 8; c++) {
        const cell = cells[r * 8 + c];
        if (!cell || !cell.isValid) {
          html += `<td class="cell-missing" title="No usable data">—</td>`;
        } else {
          html += `<td title="${cell.readout}">${cell.value.toFixed(2)}</td>`;
        }
      }
      html += `</tr>`;
    }

    html += `</tbody></table>`;
    this.tableElement.innerHTML = html;
  }

  private updateTabIndices(): void {
    const allCells = this.gridElement.querySelectorAll('.ejb-grid-cell');
    allCells.forEach((el, i) => {
      el.setAttribute('tabindex', i === this.focusedIndex ? '0' : '-1');
      if (i === this.focusedIndex) {
        (el as HTMLElement).focus();
      }
    });
  }

  private setupKeyboardNavigation(): void {
    this.gridElement.addEventListener('keydown', (e) => {
      const row = Math.floor(this.focusedIndex / 8);
      const col = this.focusedIndex % 8;

      let nextIndex = this.focusedIndex;
      if (e.key === 'ArrowRight') {
        nextIndex = col < 7 ? this.focusedIndex + 1 : this.focusedIndex;
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        nextIndex = col > 0 ? this.focusedIndex - 1 : this.focusedIndex;
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        nextIndex = row < 3 ? this.focusedIndex + 8 : this.focusedIndex;
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        nextIndex = row > 0 ? this.focusedIndex - 8 : this.focusedIndex;
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === ' ') {
        const cell = this.viewModel?.grid.cells[this.focusedIndex];
        if (cell) this.onCellSelect?.(cell);
        e.preventDefault();
      }

      if (nextIndex !== this.focusedIndex) {
        this.focusedIndex = nextIndex;
        this.updateTabIndices();
      }
    });
  }
}
