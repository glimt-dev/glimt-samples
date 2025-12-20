"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Move, ZoomIn, ZoomOut } from "lucide-react";

type Player = "X" | "O";
type CellKey = `${number},${number}`;
type GameState = Map<CellKey, Player>;

const CELL_SIZE = 48;
const WIN_LENGTH = 5;
const DIRECTIONS = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal up-right
] as const;

function cellKey(x: number, y: number): CellKey {
  return `${x},${y}`;
}

function parseKey(key: CellKey): [number, number] {
  const [x, y] = key.split(",").map(Number);
  return [x, y];
}

function checkWin(
  state: GameState,
  x: number,
  y: number,
  player: Player
): [number, number][] | null {
  for (const [dx, dy] of DIRECTIONS) {
    const line: [number, number][] = [[x, y]];

    // Check in positive direction
    for (let i = 1; i < WIN_LENGTH; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (state.get(cellKey(nx, ny)) === player) {
        line.push([nx, ny]);
      } else break;
    }

    // Check in negative direction
    for (let i = 1; i < WIN_LENGTH; i++) {
      const nx = x - dx * i;
      const ny = y - dy * i;
      if (state.get(cellKey(nx, ny)) === player) {
        line.unshift([nx, ny]);
      } else break;
    }

    if (line.length >= WIN_LENGTH) {
      return line;
    }
  }
  return null;
}

function XMark({ isWinning }: { isWinning?: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className="w-7 h-7"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <motion.path
        d="M6 6L18 18M18 6L6 18"
        stroke="var(--player-x)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{
          filter: isWinning
            ? "drop-shadow(0 0 8px var(--win-glow))"
            : undefined,
        }}
      />
    </motion.svg>
  );
}

function OMark({ isWinning }: { isWinning?: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className="w-7 h-7"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <motion.circle
        cx="12"
        cy="12"
        r="7"
        stroke="var(--player-o)"
        strokeWidth="3"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          filter: isWinning
            ? "drop-shadow(0 0 8px var(--win-glow))"
            : undefined,
        }}
      />
    </motion.svg>
  );
}

function Cell({
  x,
  y,
  value,
  onClick,
  isWinning,
  disabled,
}: {
  x: number;
  y: number;
  value: Player | undefined;
  onClick: () => void;
  isWinning: boolean;
  disabled: boolean;
}) {
  return (
    <motion.button
      className={`
        absolute flex items-center justify-center
        border border-grid-line/50 rounded-sm
        transition-colors duration-150
        ${!value && !disabled ? "hover:bg-accent/10 cursor-pointer" : ""}
        ${isWinning ? "bg-accent/20 border-accent" : ""}
        ${disabled && !value ? "cursor-not-allowed" : ""}
      `}
      style={{
        left: x * CELL_SIZE,
        top: y * CELL_SIZE,
        width: CELL_SIZE,
        height: CELL_SIZE,
      }}
      onClick={onClick}
      disabled={!!value || disabled}
      whileHover={!value && !disabled ? { scale: 1.05 } : {}}
      whileTap={!value && !disabled ? { scale: 0.95 } : {}}
    >
      {value === "X" && <XMark isWinning={isWinning} />}
      {value === "O" && <OMark isWinning={isWinning} />}
    </motion.button>
  );
}

export default function Luffarschack() {
  const [gameState, setGameState] = useState<GameState>(new Map());
  const [currentPlayer, setCurrentPlayer] = useState<Player>("X");
  const [winner, setWinner] = useState<Player | null>(null);
  const [winningCells, setWinningCells] = useState<Set<CellKey>>(new Set());
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const initializedRef = useRef(false);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        setViewSize({ width, height });
        // Center view on first measurement only
        if (!initializedRef.current && width > 0 && height > 0) {
          initializedRef.current = true;
          setOffset({ x: width / 2, y: height / 2 });
        }
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Calculate visible cell range
  const visibleRange = {
    minX: Math.floor(-offset.x / (CELL_SIZE * zoom)) - 2,
    maxX: Math.ceil((viewSize.width - offset.x) / (CELL_SIZE * zoom)) + 2,
    minY: Math.floor(-offset.y / (CELL_SIZE * zoom)) - 2,
    maxY: Math.ceil((viewSize.height - offset.y) / (CELL_SIZE * zoom)) + 2,
  };

  // Generate cells to render (visible area + cells with marks)
  const cellsToRender: { x: number; y: number; value: Player | undefined }[] =
    [];

  // Add visible empty cells (for clicking)
  for (let x = visibleRange.minX; x <= visibleRange.maxX; x++) {
    for (let y = visibleRange.minY; y <= visibleRange.maxY; y++) {
      const key = cellKey(x, y);
      cellsToRender.push({ x, y, value: gameState.get(key) });
    }
  }

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      // Don't place a mark if we just finished dragging
      if (hasDraggedRef.current) return;
      if (winner) return;

      const key = cellKey(x, y);
      if (gameState.has(key)) return;

      const newState = new Map(gameState);
      newState.set(key, currentPlayer);
      setGameState(newState);

      const winLine = checkWin(newState, x, y, currentPlayer);
      if (winLine) {
        setWinner(currentPlayer);
        setWinningCells(new Set(winLine.map(([wx, wy]) => cellKey(wx, wy))));
      } else {
        setCurrentPlayer(currentPlayer === "X" ? "O" : "X");
      }
    },
    [gameState, currentPlayer, winner]
  );

  const activePointerIdRef = useRef<number | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Left mouse button OR any touch/pen pointer
      const isMouse = e.pointerType === "mouse";
      const isAllowedMouseButton = e.button === 0 || e.button === 1;
      if ((isMouse && !isAllowedMouseButton) || activePointerIdRef.current !== null) {
        return;
      }

      activePointerIdRef.current = e.pointerId;
      // Capture ensures we keep receiving moves even when pointer leaves the element
      e.currentTarget.setPointerCapture(e.pointerId);

      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      hasDraggedRef.current = false;
    },
    [offset]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || activePointerIdRef.current !== e.pointerId) return;

      // Check if we've moved enough to count as a drag (not a tap/click)
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDraggedRef.current = true;
      }

      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handlePointerUpOrCancel = useCallback((e: React.PointerEvent) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.3), 2);

      // Zoom toward mouse position
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setOffset((prev) => ({
          x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
          y: mouseY - (mouseY - prev.y) * (newZoom / zoom),
        }));
      }

      setZoom(newZoom);
    },
    [zoom]
  );

  const resetGame = useCallback(
    (skipConfirm = false) => {
      // Only confirm if game is in progress (has moves and no winner)
      if (!skipConfirm && gameState.size > 0 && !winner) {
        if (!window.confirm("Start a new game? Current progress will be lost.")) {
          return;
        }
      }
      setGameState(new Map());
      setCurrentPlayer("X");
      setWinner(null);
      setWinningCells(new Set());
      setOffset({ x: viewSize.width / 2, y: viewSize.height / 2 });
      setZoom(1);
    },
    [viewSize, gameState.size, winner]
  );

  const centerView = useCallback(() => {
    if (gameState.size === 0) {
      setOffset({ x: viewSize.width / 2, y: viewSize.height / 2 });
      return;
    }

    // Center on the bounding box of placed markers
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const key of gameState.keys()) {
      const [x, y] = parseKey(key);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const centerX = ((minX + maxX) / 2) * CELL_SIZE * zoom;
    const centerY = ((minY + maxY) / 2) * CELL_SIZE * zoom;

    setOffset({
      x: viewSize.width / 2 - centerX,
      y: viewSize.height / 2 - centerY,
    });
  }, [gameState, viewSize, zoom]);


  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-grid-line/50">
        <div className="flex items-center gap-3">
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Luffarschack
          </h1>
          <span className="text-sm text-muted hidden sm:inline">
            Five in a row
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Current player indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10">
            <span className="text-sm text-muted">Turn:</span>
            <motion.span
              key={currentPlayer}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-lg font-bold ${
                currentPlayer === "X" ? "text-player-x" : "text-player-o"
              }`}
            >
              {currentPlayer}
            </motion.span>
          </div>

          {/* Move counter */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10">
            <span className="text-sm text-muted">Moves:</span>
            <span className="text-sm font-medium">{gameState.size}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom((z) => Math.min(z * 1.2, 2))}
              className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
              title="Zoom in"
            >
              <ZoomIn size={18} className="text-muted" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z * 0.8, 0.3))}
              className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
              title="Zoom out"
            >
              <ZoomOut size={18} className="text-muted" />
            </button>
            <button
              onClick={centerView}
              className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
              title="Center view"
            >
              <Move size={18} className="text-muted" />
            </button>
            <button
              onClick={() => resetGame()}
              className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
              title="New game"
            >
              <RotateCcw size={18} className="text-muted" />
            </button>
          </div>
        </div>
      </header>

      {/* Game area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing grid-background select-none"
        style={{
          backgroundPosition: `${offset.x}px ${offset.y}px`,
          backgroundSize: `${48 * zoom}px ${48 * zoom}px`,
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onWheel={handleWheel}
      >
        {/* Grid container */}
        <div
          className="absolute origin-top-left"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        >
          {/* Origin marker */}
          <div
            className="absolute w-2 h-2 rounded-full bg-accent/40"
            style={{
              left: -4,
              top: -4,
            }}
          />

          {/* Cells */}
          {cellsToRender.map(({ x, y, value }) => (
            <Cell
              key={cellKey(x, y)}
              x={x}
              y={y}
              value={value}
              onClick={() => handleCellClick(x, y)}
              isWinning={winningCells.has(cellKey(x, y))}
              disabled={!!winner}
            />
          ))}
        </div>

        {/* Winner overlay */}
        <AnimatePresence>
          {winner && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="text-center p-8 rounded-2xl bg-background border border-grid-line shadow-2xl"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className={`text-6xl font-bold mb-4 ${
                    winner === "X" ? "text-player-x" : "text-player-o"
                  }`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {winner}
                </motion.div>
                <p
                  className="text-xl text-foreground mb-6"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  wins the game!
                </p>
                <p className="text-sm text-muted mb-6">
                  Game ended after {gameState.size} moves
                </p>
                <button
                  onClick={() => resetGame(true)}
                  className="px-6 py-3 rounded-xl bg-accent/20 hover:bg-accent/30 
                           transition-colors font-medium flex items-center gap-2 mx-auto"
                >
                  <RotateCcw size={18} />
                  Play again
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer hints */}
      <footer className="px-6 py-3 border-t border-grid-line/50 text-center">
        <p className="text-xs text-muted">
          Drag to pan • Scroll to zoom • Click to place • Get 5 in a row to win
        </p>
      </footer>
    </div>
  );
}

