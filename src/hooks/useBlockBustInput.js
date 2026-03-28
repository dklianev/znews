import { useEffectEvent, useRef, useState } from 'react';

const DRAG_OFFSET_ROWS = 2;

function createIdleDragState() {
  return {
    active: false,
    pointerId: null,
    pieceIndex: null,
    moved: false,
    anchorCell: null,
  };
}

export function useBlockBustInput({
  controlMode,
  gridRef,
  tray,
  run,
  selectedPiece,
  setRun,
  setAnchorCell,
  setFocusCell,
  placeSelectedPiece,
  playTone,
  clearFlashActive,
}) {
  const dragStateRef = useRef(createIdleDragState());
  const dragGhostRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const hideGhost = useEffectEvent(() => {
    if (dragGhostRef.current) {
      dragGhostRef.current.style.display = 'none';
    }
  });

  const moveGhost = useEffectEvent((clientX, clientY) => {
    if (!dragGhostRef.current) return;
    const grid = gridRef.current;
    const cellPx = grid ? grid.getBoundingClientRect().height / 8 : 40;
    const offsetPx = (DRAG_OFFSET_ROWS + 0.5) * cellPx;

    dragGhostRef.current.style.display = 'block';
    dragGhostRef.current.style.transform = `translate(${clientX}px, ${clientY - offsetPx}px) translate(-50%, -50%) scale(1.4)`;
  });

  const updateAnchor = useEffectEvent((clientX, clientY, pieceOverride = null) => {
    const grid = gridRef.current;
    if (!grid) return;

    const rect = grid.getBoundingClientRect();
    const cellW = rect.width / 8;
    const cellH = rect.height / 8;
    const marginX = rect.width * 0.4;
    const marginTop = rect.height * 0.4;
    const marginBottom = rect.height * 0.8;

    if (
      clientX < rect.left - marginX
      || clientX > rect.right + marginX
      || clientY < rect.top - marginTop
      || clientY > rect.bottom + marginBottom
    ) {
      setAnchorCell(null);
      dragStateRef.current.anchorCell = null;
      return;
    }

    const dragPiece = pieceOverride
      || (dragStateRef.current.active && typeof dragStateRef.current.pieceIndex === 'number'
        ? tray[dragStateRef.current.pieceIndex]
        : selectedPiece);

    let row = Math.floor((clientY - rect.top) / cellH);
    let col = Math.floor((clientX - rect.left) / cellW);

    if (dragStateRef.current.active && dragPiece) {
      col -= Math.floor(dragPiece.width / 2);
      row -= Math.floor(dragPiece.height / 2) + DRAG_OFFSET_ROWS;
    } else {
      row = Math.max(0, Math.min(7, row));
      col = Math.max(0, Math.min(7, col));
    }

    const nextCell = { row, col };
    setAnchorCell((current) => (
      current && current.row === row && current.col === col ? current : nextCell
    ));
    setFocusCell((current) => (
      current && current.row === row && current.col === col ? current : nextCell
    ));
    dragStateRef.current.anchorCell = nextCell;
  });

  const finishDrag = useEffectEvent((commitPlacement = true) => {
    const state = dragStateRef.current;
    if (!state.active) return;

    dragStateRef.current = createIdleDragState();
    setIsDragging(false);
    hideGhost();

    if (typeof state.pieceIndex !== 'number') return;

    const piece = tray[state.pieceIndex];
    if (commitPlacement && piece && state.anchorCell) {
      const placed = placeSelectedPiece(state.anchorCell.row, state.anchorCell.col, piece, state.pieceIndex);
      if (!placed && state.moved) {
        setRun((current) => ({ ...current, selectedSlotIndex: null }));
        setAnchorCell(null);
      }
      return;
    }

    if (state.moved) {
      setRun((current) => ({ ...current, selectedSlotIndex: null }));
      setAnchorCell(null);
    }
  });

  const handleStartDrag = useEffectEvent((event, index) => {
    if (controlMode !== 'drag-tap' || clearFlashActive || run.status === 'over' || !tray[index]) return;

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      pieceIndex: index,
      moved: false,
      anchorCell: null,
    };
    setIsDragging(true);
    setRun((current) => ({ ...current, selectedSlotIndex: index }));
    playTone('select');
    moveGhost(event.clientX, event.clientY);
    updateAnchor(event.clientX, event.clientY, tray[index]);
  });

  const handleDragPointerMove = useEffectEvent((event) => {
    const state = dragStateRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;

    state.moved = true;
    moveGhost(event.clientX, event.clientY);
    updateAnchor(event.clientX, event.clientY, tray[state.pieceIndex] || null);
  });

  const releaseCapture = useEffectEvent((event) => {
    try {
      if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {}
  });

  const handleDragPointerUp = useEffectEvent((event) => {
    if (dragStateRef.current.pointerId !== event.pointerId) return;
    releaseCapture(event);
    finishDrag(true);
  });

  const handleDragPointerCancel = useEffectEvent((event) => {
    if (dragStateRef.current.pointerId !== event.pointerId) return;
    releaseCapture(event);
    finishDrag(false);
  });

  const handleBoardCellEnter = useEffectEvent((row, col) => {
    if (dragStateRef.current.active) return;
    setAnchorCell({ row, col });
    setFocusCell({ row, col });
  });

  const handleBoardLeave = useEffectEvent(() => {
    if (!dragStateRef.current.active) {
      setAnchorCell(null);
    }
  });

  return {
    dragGhostRef,
    isDragging,
    handleStartDrag,
    handleDragPointerMove,
    handleDragPointerUp,
    handleDragPointerCancel,
    handleBoardCellEnter,
    handleBoardLeave,
  };
}

export default useBlockBustInput;
