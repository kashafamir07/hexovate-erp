import type { ReactNode } from "react";

export interface Column<T> {
  id: string;
  header?: ReactNode;
  render: (row: T) => ReactNode;
  /** extra class for the cell (widths, alignment, action column) */
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** highlight every second row (Figma zebra) */
  zebra?: boolean;
}

/** Shared table used by My Tasks / Time Tracker / My Requests, etc. */
export function DataTable<T>({ columns, rows, keyOf, onRowClick, zebra = true }: DataTableProps<T>) {
  if (rows.length === 0) return null;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.id} className={col.className}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={keyOf(row)}
              className={`${zebra && i % 2 === 1 ? "striped" : ""} ${onRowClick ? "clickable" : ""}`.trim()}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter") onRowClick(row);
                    }
                  : undefined
              }
            >
              {columns.map((col) => (
                <td key={col.id} className={col.className}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
