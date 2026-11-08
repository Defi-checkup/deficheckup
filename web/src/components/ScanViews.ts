// Loaded alongside the engine after input count validation on submit.
// A URL import prevents Astro from hoisting these styles into the idle island's HTML.
import scanStyles from '../styles/scan.css?url';
export { default as Report } from './Report';
export { default as ScanProgress } from './ScanProgress';

let stylesReady: Promise<void> | undefined;

/** Wait for local styles before mounting either view, including on a slow connection. */
export function loadStyles(): Promise<void> {
  return (stylesReady ??= new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = scanStyles;
    link.onload = () => resolve();
    link.onerror = () => {
      link.remove();
      stylesReady = undefined;
      reject(new Error('Scan styles could not be loaded.'));
    };
    document.head.append(link);
  }));
}
