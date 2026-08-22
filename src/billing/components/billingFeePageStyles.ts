/** Shared flat billing page styles (Manual Payments, …). */
export const BILLING_FEE_PAGE_STYLES = `
  .fee-root * { box-sizing: border-box; }

  .fee-card {
    background-color: hsl(var(--card) / 0.92);
    background-image: url('/assets/media/bg-3.png');
    background-size: cover;
    background-repeat: no-repeat;
    background-position: right top -1.7rem;
    border: 1px solid hsl(var(--border));
    border-radius: 12px;
    box-shadow: 0 1px 2px hsl(var(--foreground) / 0.04);
  }

  .dark .fee-card {
    background-color: hsl(var(--card) / 0.88);
    background-image: url('/assets/media/bg-3-dark.png');
  }

  .fee-btn-primary {
    display: inline-flex; align-items: center; gap: 6px;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground)); border: none; border-radius: 8px;
    font-weight: 600; font-size: 13.5px;
    padding: 11px 20px; cursor: pointer; white-space: nowrap;
  }
  .fee-btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  .fee-btn-sm {
    display: inline-flex; align-items: center; gap: 6px;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground)); border: none; border-radius: 8px;
    font-weight: 600; font-size: 12.5px; padding: 7px 13px;
    cursor: pointer; white-space: nowrap;
  }

  .fee-btn-outline {
    display: inline-flex; align-items: center; gap: 6px;
    background: hsl(var(--background)); color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border)); border-radius: 8px;
    font-weight: 600; font-size: 12.5px; padding: 7px 13px;
    cursor: pointer; white-space: nowrap;
  }
  .fee-btn-outline:hover { background: hsl(var(--muted) / 0.5); }
  .fee-btn-outline:disabled { opacity: .5; cursor: not-allowed; }

  .section-title {
    font-size: 15px; font-weight: 600; color: hsl(var(--foreground));
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding-bottom: 16px;
    border-bottom: 1px solid hsl(var(--border));
    margin-bottom: 18px;
  }
  .section-icon {
    width: 34px; height: 34px; border-radius: 8px;
    background: hsl(var(--muted));
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }

  .fee-empty {
    text-align: center; padding: 30px 20px; color: hsl(var(--muted-foreground)); font-size: 13px;
    background: hsl(var(--muted) / 0.35);
    border-radius: 8px; border: 1px dashed hsl(var(--border)); line-height: 1.6;
  }

  .amount-chip {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-weight: 500; font-size: 13px;
    background: hsl(var(--muted));
    color: hsl(var(--foreground)); border: 1px solid hsl(var(--border));
    border-radius: 6px; padding: 3px 10px; white-space: nowrap;
  }

  .fee-bg { background: hsl(var(--background)); }

  .fee-input {
    border-radius: 8px !important; border: 1px solid hsl(var(--input)) !important;
    background: hsl(var(--background)) !important; color: hsl(var(--foreground)) !important; font-size: 13.5px !important;
  }
  .fee-input:focus { border-color: hsl(var(--ring)) !important; box-shadow: 0 0 0 2px hsl(var(--ring) / 0.15) !important; }

  .fee-stat-label { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: hsl(var(--muted-foreground)); }
  .fee-stat-value { font-size: 24px; font-weight: 600; color: hsl(var(--foreground)); margin-top: 4px; }
  .fee-stat-sub { font-size: 11.5px; color: hsl(var(--muted-foreground)); margin-top: 2px; }
  .fee-loading { padding: 24px 0; text-align: center; font-size: 13px; color: hsl(var(--muted-foreground)); }

  @media (max-width: 900px) {
    .fee-grid-2 { grid-template-columns: 1fr !important; }
  }
`;
