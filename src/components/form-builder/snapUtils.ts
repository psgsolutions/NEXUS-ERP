import { FormElement } from '../../types/formBuilder';

export interface SnapResult {
  x: number;
  y: number;
  lines: SnapLine[];
}

export interface SnapLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  direction: 'vertical' | 'horizontal';
}

export function calculateMagneticSnap(
  currentPos: { x: number; y: number },
  activeSize: { width: number; height: number },
  activeId: string,
  elements: FormElement[],
  threshold: number = 3
): SnapResult {
  let snappedX = currentPos.x;
  let snappedY = currentPos.y;
  const lines: SnapLine[] = [];

  // Define active element edges and centers
  const activeLeft = currentPos.x;
  const activeRight = currentPos.x + activeSize.width;
  const activeCenterX = currentPos.x + activeSize.width / 2;

  const activeTop = currentPos.y;
  const activeBottom = currentPos.y + activeSize.height;
  const activeCenterY = currentPos.y + activeSize.height / 2;

  let xSnapped = false;
  let ySnapped = false;

  for (const el of elements) {
    if (el.id === activeId || el.properties?.visible === false) continue;

    const elWidth = Number(el.size.width);
    const elHeight = Number(el.size.height);

    const elLeft = el.position.x;
    const elRight = el.position.x + elWidth;
    const elCenterX = el.position.x + elWidth / 2;

    const elTop = el.position.y;
    const elBottom = el.position.y + elHeight;
    const elCenterY = el.position.y + elHeight / 2;

    // --- X Axis Snapping ---
    if (!xSnapped) {
      const snapPointsX = [
        { activeOffset: 0, target: elLeft },
        { activeOffset: 0, target: elRight },
        { activeOffset: activeSize.width, target: elLeft },
        { activeOffset: activeSize.width, target: elRight },
        { activeOffset: activeSize.width / 2, target: elCenterX },
      ];

      for (const sp of snapPointsX) {
        const potentialX = sp.target - sp.activeOffset;
        if (Math.abs(currentPos.x - potentialX) <= threshold) {
          snappedX = potentialX;
          xSnapped = true;
          lines.push({
            x1: sp.target,
            y1: Math.min(currentPos.y, el.position.y) - 50,
            x2: sp.target,
            y2: Math.max(currentPos.y + activeSize.height, el.position.y + elHeight) + 50,
            direction: 'vertical'
          });
          break;
        }
      }
    }

    // --- Y Axis Snapping ---
    if (!ySnapped) {
      const snapPointsY = [
        { activeOffset: 0, target: elTop },
        { activeOffset: 0, target: elBottom },
        { activeOffset: activeSize.height, target: elTop },
        { activeOffset: activeSize.height, target: elBottom },
        { activeOffset: activeSize.height / 2, target: elCenterY },
      ];

      for (const sp of snapPointsY) {
        const potentialY = sp.target - sp.activeOffset;
        if (Math.abs(currentPos.y - potentialY) <= threshold) {
          snappedY = potentialY;
          ySnapped = true;
          lines.push({
            x1: Math.min(currentPos.x, el.position.x) - 50,
            y1: sp.target,
            x2: Math.max(currentPos.x + activeSize.width, el.position.x + elWidth) + 50,
            y2: sp.target,
            direction: 'horizontal'
          });
          break;
        }
      }
    }

    if (xSnapped && ySnapped) break;
  }

  // --- Grid Snapping (fallback) ---
  if (!xSnapped) {
    const gridX = Math.round(currentPos.x / 5) * 5;
    if (Math.abs(currentPos.x - gridX) <= threshold) {
      snappedX = gridX;
    }
  }
  
  if (!ySnapped) {
    const gridY = Math.round(currentPos.y / 5) * 5;
    if (Math.abs(currentPos.y - gridY) <= threshold) {
      snappedY = gridY;
    }
  }

  return { x: snappedX, y: snappedY, lines };
}
